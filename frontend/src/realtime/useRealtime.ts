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
  const senderRef = useRef<RTCRtpSender | null>(null);
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
        case "conversation.item.added":
        case "conversation.item.created":
          // La transcripción del usuario llega después de que empieza la respuesta:
          // se reserva su lugar al crearse el ítem para que quede antes de la respuesta.
          if (ev.item?.role === "user" && ev.item.id) {
            const id: string = ev.item.id;
            const prevId: string | null | undefined = ev.previous_item_id;
            setMessages((prev) => {
              if (prev.some((m) => m.id === id)) return prev;
              const at = prevId ? prev.findIndex((m) => m.id === prevId) : -1;
              const slot = { id, role: "user" as const, text: "" };
              if (at === -1) return [...prev, slot];
              return [...prev.slice(0, at + 1), slot, ...prev.slice(at + 1)];
            });
          }
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
    micRef.current?.stop();
    pcRef.current?.close();
    audioCtxRef.current?.close();
    if (audioElRef.current) audioElRef.current.srcObject = null;
    pcRef.current = dcRef.current = micRef.current = senderRef.current = audioCtxRef.current = analyserRef.current = null;
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

      // Canal de audio de ida y vuelta, sin pista todavía: el micrófono se pide
      // recién cuando el usuario lo activa y se engancha sin renegociar.
      senderRef.current = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;

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
      // No crypto.randomUUID(): solo existe con HTTPS y rompería el envío de texto por HTTP
      upsert(`local-${Date.now()}-${Math.random().toString(36).slice(2)}`, "user", text.trim());
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

  const toggleMic = useCallback(async () => {
    const sender = senderRef.current;
    if (!sender) return;
    setError(null);
    if (!micRef.current) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar el micrófono aquí. Abre la página en Chrome o Safari.");
        return;
      }
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const track = mic.getAudioTracks()[0];
        await sender.replaceTrack(track);
        micRef.current = track;
        setMicOn(true);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Permiso de micrófono denegado. Actívalo en el candado de la barra de direcciones y en Ajustes del Sistema → Privacidad → Micrófono."
            : name === "NotFoundError"
              ? "No se encontró ningún micrófono conectado."
              : `No se pudo abrir el micrófono (${name || "error desconocido"}).`,
        );
      }
      return;
    }
    micRef.current.enabled = !micRef.current.enabled;
    setMicOn(micRef.current.enabled);
  }, []);

  useEffect(() => disconnect, [disconnect]);

  // Los ítems de voz sin transcribir todavía solo reservan su posición
  const visibleMessages = messages.filter((m) => m.text);

  return { status, messages: visibleMessages, micOn, error, analyserRef, connect, disconnect, sendText, toggleMic };
}
