import { Scene } from "./avatar/Scene";
import { ChatPanel } from "./components/ChatPanel";
import { useRealtime } from "./realtime/useRealtime";
import { useIntro } from "./effects/intro";

// Fondo del escenario: se puede cambiar por una foto (por ejemplo /backgrounds/subestacion.jpg)
const BACKGROUND_URL = "/backgrounds/subestacion.svg";

export default function App() {
  const rt = useRealtime();
  const intro = useIntro(rt.status);

  return (
    <main className="app">
      <section className="stage">
        <img className="stage__bg" src={BACKGROUND_URL} alt="" />
        <Scene status={rt.status} analyserRef={rt.analyserRef} intro={intro} />
        {intro.present && <div key={intro.at} className="stage__flash" />}
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
