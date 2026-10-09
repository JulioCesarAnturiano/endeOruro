import { Scene } from "./avatar/Scene";
import { ChatPanel } from "./components/ChatPanel";
import { useRealtime } from "./realtime/useRealtime";

export default function App() {
  const rt = useRealtime();

  return (
    <main className="app">
      <section className="stage">
        <Scene status={rt.status} analyserRef={rt.analyserRef} />
      </section>
      <ChatPanel
        status={rt.status}
        messages={rt.messages}
        micOn={rt.micOn}
        error={rt.error}
        onConnect={rt.connect}
        onDisconnect={rt.disconnect}
        onSend={rt.sendText}
        onToggleMic={rt.toggleMic}
      />
    </main>
  );
}
