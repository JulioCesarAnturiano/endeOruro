import { useEffect, useRef, useState } from "react";
import type { Status } from "../realtime/useRealtime";
import { playThunder } from "./thunder";

// Tiempos de la entrada, en segundos desde que se pulsa "Iniciar conversación"
export const STRIKE = 0.25; // cae el rayo y aparece el personaje
export const DROP = 0.22; // lo que tarda en tocar el suelo
export const LEAVE = 0.35; // lo que tarda en desaparecer al terminar

export type Intro = { at: number; present: boolean };

export const now = () => performance.now() / 1000;

/** El personaje entra con un rayo al iniciar la conversación y se va al terminarla. */
export function useIntro(status: Status): Intro {
  const [intro, setIntro] = useState<Intro>({ at: -1, present: false });
  const prev = useRef<Status>(status);

  useEffect(() => {
    const was = prev.current;
    prev.current = status;
    if (was === "idle" && status !== "idle") {
      setIntro({ at: now(), present: true });
      playThunder(STRIKE);
    } else if (was !== "idle" && status === "idle") {
      setIntro({ at: now(), present: false });
    }
  }, [status]);

  return intro;
}
