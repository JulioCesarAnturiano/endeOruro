import { Suspense, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { Mascot } from "./Mascot";
import type { Status } from "../realtime/useRealtime";

type Props = { status: Status; analyserRef: RefObject<AnalyserNode | null> };

export function Scene({ status, analyserRef }: Props) {
  return (
    <Canvas camera={{ position: [0, 0.62, 2.1], fov: 30 }} dpr={[1, 2]} onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <Suspense fallback={null}>
        <Mascot status={status} analyserRef={analyserRef} />
        <Environment preset="city" />
        <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={3} blur={2.4} far={1} />
      </Suspense>
    </Canvas>
  );
}
