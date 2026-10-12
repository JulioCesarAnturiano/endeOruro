import { Suspense, useRef, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Mascot } from "./Mascot";
import { Lightning } from "../effects/Lightning";
import { DROP, LEAVE, now, STRIKE, type Intro } from "../effects/intro";
import type { Status } from "../realtime/useRealtime";

type Props = { status: Status; analyserRef: RefObject<AnalyserNode | null>; intro: Intro };

const CAMERA = new THREE.Vector3(0, 0.62, 2.1);
const TARGET = new THREE.Vector3(0, 0.5, 0);

// Aparece al caer el rayo, cae al suelo con un pequeño rebote y desaparece al terminar
function Entrance({ intro, children }: { intro: Intro; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = intro.at > 0 ? now() - intro.at : 99;
    if (!intro.present) {
      const k = intro.at > 0 ? 1 - THREE.MathUtils.clamp(t / LEAVE, 0, 1) : 0;
      g.visible = k > 0;
      g.scale.setScalar(Math.max(k, 0.0001));
      g.position.y = 0;
      return;
    }
    const d = t - STRIKE;
    g.visible = d >= 0;
    if (d < 0) return;
    const fall = THREE.MathUtils.clamp(d / DROP, 0, 1);
    g.position.y = 0.45 * (1 - fall * fall);
    const l = d - DROP;
    const squash = l >= 0 ? Math.exp(-l * 7) * Math.cos(l * 24) : 0;
    g.scale.set(1 + 0.06 * squash, 1 - 0.12 * squash, 1 + 0.06 * squash);
  });
  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  );
}

// Sacudida corta de cámara con el impacto
function CameraShake({ intro }: { intro: Intro }) {
  useFrame(({ camera }) => {
    const d = intro.present && intro.at > 0 ? now() - intro.at - STRIKE : 99;
    camera.position.copy(CAMERA);
    if (d >= 0 && d < 0.5) {
      const a = 0.02 * (1 - d / 0.5);
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    camera.lookAt(TARGET);
  });
  return null;
}

export function Scene({ status, analyserRef, intro }: Props) {
  return (
    <Canvas className="stage__canvas" camera={{ position: CAMERA.toArray(), fov: 30 }} dpr={[1, 2]} gl={{ alpha: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 3]} intensity={1.5} />
      <directionalLight position={[-2, 2, -2]} intensity={0.9} color="#7fb2ff" />
      <CameraShake intro={intro} />
      <Suspense fallback={null}>
        <Entrance intro={intro}>
          <Mascot status={status} analyserRef={analyserRef} />
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={3} blur={2.4} far={1} />
        </Entrance>
        <Lightning intro={intro} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
