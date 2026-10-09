import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INSTRUCTIONS } from "./instructions.js";

const { OPENAI_API_KEY, OPENAI_REALTIME_MODEL = "gpt-realtime", OPENAI_VOICE = "cedar", PORT = 3001 } = process.env;

if (!OPENAI_API_KEY) {
  console.error("Falta OPENAI_API_KEY. Copia backend/.env.example como backend/.env y pon tu clave.");
  process.exit(1);
}

const app = express();

// El navegador nunca ve la API key: pide aquí una clave efímera de un solo uso
// y con ella abre la conexión WebRTC directamente con OpenAI.
app.post("/api/session", async (_req, res) => {
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: OPENAI_REALTIME_MODEL,
          instructions: INSTRUCTIONS,
          audio: {
            input: { transcription: { model: "gpt-4o-mini-transcribe", language: "es" } },
            output: { voice: OPENAI_VOICE },
          },
        },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("OpenAI respondió", r.status, data);
      return res.status(r.status).json({ error: data?.error?.message ?? "Error al crear la sesión" });
    }
    res.json({ clientSecret: data.value, model: OPENAI_REALTIME_MODEL });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "No se pudo contactar a OpenAI" });
  }
});

// En producción sirve el frontend compilado (npm run build)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend", "dist");
app.use(express.static(dist));

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
