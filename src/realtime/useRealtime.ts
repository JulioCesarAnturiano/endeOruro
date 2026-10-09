import { useCallback, useEffect, useRef, useState } from "react";

export type Status = "idle" | "connecting" | "listening" | "thinking" | "speaking";
export type Message = { id: string; role: "user" | "assistant"; text: string };

/**
 * Conversación en tiempo real con OpenAI por WebRTC.
 * El audio de respuesta llega como stream remoto; se expone un AnalyserNode
 * para que el avatar mueva la boca según el volumen.
 */
export function useRealtime() {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStreamTrack | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const upsert = useCallback((id: string, role: Message["role"], delta: string, replace = false) => {
    setMessages((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      if (i === -1) return [...prev, { id, role, text: delta }];
      const next = prev.slice();
      next[i] = { ...next[i], text: replace ? delta : next[i].text + delta };
      return next;
    });
  }, []);

  const onEvent = useCallback(
    (ev: any) => {
      switch (ev.type) {
        case "input_audio_buffer.speech_started":
          setStatus("listening");
          break;
        case "input_audio_buffer.speech_stopped":
        case "response.created":
          setStatus("thinking");
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (ev.transcript?.trim()) upsert(ev.item_id, "user", ev.transcript.trim(), true);
          break;
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          upsert(ev.item_id, "assistant", ev.delta);
          break;
        case "output_audio_buffer.started":
          setStatus("speaking");
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setStatus("listening");
          break;
        case "error":
          setError(ev.error?.message ?? "Error en la sesión");
          break;
      }
    },
    [upsert],
  );

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    audioCtxRef.current?.close();
    if (audioElRef.current) audioElRef.current.srcObject = null;
    pcRef.current = dcRef.current = micRef.current = audioCtxRef.current = analyserRef.current = null;
    setMicOn(false);
    setStatus("idle");
  }, []);

  const connect = useCallback(async () => {
    if (pcRef.current) return;
    setError(null);
    setStatus("connecting");
    try {
      const session = await fetch("/api/session", { method: "POST" }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "No se pudo crear la sesión");
        return body as { clientSecret: string; model: string };
      });

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Audio de respuesta: se reproduce y se analiza para el movimiento de la boca
      const audioEl = (audioElRef.current ??= new Audio());
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        audioEl.srcObject = stream;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      };

      // Micrófono: empieza apagado; si el usuario lo niega se sigue solo con texto
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = mic.getAudioTracks()[0];
        track.enabled = false;
        micRef.current = track;
        pc.addTrack(track, mic);
      } catch {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => onEvent(JSON.parse(e.data));
      dc.onopen = () => setStatus("listening");
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) disconnect();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdp = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(session.model)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!sdp.ok) throw new Error(`OpenAI rechazó la conexión (${sdp.status})`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdp.text() });
    } catch (err) {
      disconnect();
      setError(err instanceof Error ? err.message : "Error de conexión");
    }
  }, [disconnect, onEvent]);

  const sendText = useCallback(
    (text: string) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open" || !text.trim()) return;
      upsert(crypto.randomUUID(), "user", text.trim());
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: [{ type: "input_text", text: text.trim() }] },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
      setStatus("thinking");
    },
    [upsert],
  );

  const toggleMic = useCallback(() => {
    const track = micRef.current;
    if (!track) {
      setError("No hay acceso al micrófono. Revisa los permisos del navegador.");
      return;
    }
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return { status, messages, micOn, error, analyserRef, connect, disconnect, sendText, toggleMic };
}
