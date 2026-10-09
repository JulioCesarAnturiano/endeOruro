import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Status } from "../realtime/useRealtime";

const MODEL_URL = "/models/mascota_ende.glb";

// Clip de cuerpo según el estado de la conversación
const CLIP_FOR: Record<Status, string> = {
  idle: "Idle",
  connecting: "Idle",
  listening: "Idle",
  thinking: "Think",
  speaking: "Talk",
};

// Eje local de la mandíbula y apertura (radianes). En reposo la boca queda sonriendo.
const JAW_AXIS = new THREE.Vector3(-1, 0, 0);
const JAW_CLOSED = THREE.MathUtils.degToRad(-10);
const JAW_OPEN = THREE.MathUtils.degToRad(12);

type Props = { status: Status; analyserRef: RefObject<AnalyserNode | null> };

export function Mascot({ status, analyserRef }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, mixer } = useAnimations(animations, group);

  const jaw = useMemo(() => scene.getObjectByName("Jaw") as THREE.Bone | undefined, [scene]);
  const jawRest = useMemo(() => jaw?.quaternion.clone(), [jaw]);
  const samples = useMemo(() => new Uint8Array(256), []);
  const level = useRef(0);
  const current = useRef<string>("");
  const wasConnected = useRef(false);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
  }, [scene]);

  // Cambio de clip con transición suave; saluda una vez al conectar
  useEffect(() => {
    const connected = status !== "idle" && status !== "connecting";
    const greet = connected && !wasConnected.current;
    wasConnected.current = connected;

    const play = (name: string, once = false) => {
      const next = actions[name];
      if (!next || current.current === name) return;
      const prev = actions[current.current];
      next.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      next.fadeIn(0.3).play();
      prev?.fadeOut(0.3);
      current.current = name;
    };

    if (greet && actions.Wave) {
      play("Wave", true);
      const back = () => play(CLIP_FOR[status]);
      mixer.addEventListener("finished", back);
      return () => mixer.removeEventListener("finished", back);
    }
    if (current.current !== "Wave") play(CLIP_FOR[status]);
  }, [status, actions, mixer]);

  // Boca: sigue el volumen de la voz mientras habla
  useFrame((_, dt) => {
    if (!jaw || !jawRest) return;
    let target = 0;
    const analyser = analyserRef.current;
    if (analyser && status === "speaking") {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = (samples[i] - 128) / 128;
        sum += v * v;
      }
      target = Math.min(1, Math.sqrt(sum / samples.length) * 6);
    }
    // abre rápido, cierra más lento
    const speed = target > level.current ? 30 : 12;
    level.current += (target - level.current) * Math.min(1, dt * speed);

    const angle = status === "speaking" ? THREE.MathUtils.lerp(JAW_CLOSED, JAW_OPEN, level.current) : 0;
    jaw.quaternion.copy(jawRest).multiply(new THREE.Quaternion().setFromAxisAngle(JAW_AXIS, angle));
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
