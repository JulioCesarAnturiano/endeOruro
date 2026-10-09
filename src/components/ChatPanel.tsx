import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Message, Status } from "../realtime/useRealtime";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Desconectado",
  connecting: "Conectando…",
  listening: "Te escucho",
  thinking: "Pensando…",
  speaking: "Hablando",
};

type Props = {
  status: Status;
  messages: Message[];
  micOn: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSend: (text: string) => void;
  onToggleMic: () => void;
};

export function ChatPanel({ status, messages, micOn, error, onConnect, onDisconnect, onSend, onToggleMic }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const connected = status !== "idle" && status !== "connecting";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(text);
    setText("");
  };

  return (
    <aside className="chat">
      <header className="chat__header">
        <span className={`dot dot--${status}`} />
        <span>{STATUS_LABEL[status]}</span>
        {connected && (
          <button className="link" onClick={onDisconnect}>
            Terminar
          </button>
        )}
      </header>

      <div className="chat__messages">
        {messages.map((m) => (
          <p key={m.id} className={`bubble bubble--${m.role}`}>
            {m.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="chat__error">{error}</p>}

      {connected ? (
        <form className="chat__input" onSubmit={submit}>
          <button type="button" className={`mic ${micOn ? "mic--on" : ""}`} onClick={onToggleMic} aria-pressed={micOn}>
            {micOn ? "Micrófono activo" : "Activar micrófono"}
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu pregunta…" />
          <button type="submit" disabled={!text.trim()}>
            Enviar
          </button>
        </form>
      ) : (
        <button className="start" onClick={onConnect} disabled={status === "connecting"}>
          {status === "connecting" ? "Conectando…" : "Iniciar conversación"}
        </button>
      )}
    </aside>
  );
}
