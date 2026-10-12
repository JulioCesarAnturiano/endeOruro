import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { now, STRIKE, type Intro } from "./intro";

type V3 = [number, number, number];

// Rayo quebrado por desplazamiento de punto medio
function zigzag(a: V3, b: V3, depth: number, spread: number): V3[] {
  if (depth === 0) return [a, b];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const m: V3 = [
    (a[0] + b[0]) / 2 + (Math.random() - 0.5) * len * spread,
    (a[1] + b[1]) / 2 + (Math.random() - 0.5) * len * spread * 0.3,
    (a[2] + b[2]) / 2 + (Math.random() - 0.5) * len * spread * 0.5,
  ];
  return [...zigzag(a, m, depth - 1, spread), ...zigzag(m, b, depth - 1, spread).slice(1)];
}

function makeBolt() {
  const main = zigzag([0.35 + Math.random() * 0.3, 2.8, -0.4], [0, 0.01, 0.08], 6, 0.45);
  const branches = [0.3, 0.5].map((f) => {
    const p = main[Math.floor(main.length * f)];
    const end: V3 = [p[0] + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.3), p[1] - 0.4 - Math.random() * 0.3, p[2]];
    return zigzag(p, end, 4, 0.5);
  });
  return { main, branches };
}

// Destellos del rayo: [inicio, fin, intensidad] relativos al impacto
const FLASHES: [number, number, number][] = [
  [-0.12, -0.07, 0.35],
  [0, 0.09, 1],
  [0.14, 0.19, 0.8],
  [0.26, 0.29, 0.5],
];

const SPARKS = 90;

// Punto redondo y difuso para las chispas
function sparkTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,230,160,0.8)");
  grad.addColorStop(1, "rgba(255,200,90,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function Lightning({ intro }: { intro: Intro }) {
  // un trazado distinto para cada destello, nuevo en cada entrada
  const bolts = useMemo(() => FLASHES.map(makeBolt), [intro.at]);
  const boltGroups = useRef<(THREE.Group | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const ring = useRef<THREE.Mesh>(null);
  const scorch = useRef<THREE.Mesh>(null);
  const sparks = useRef<THREE.Points>(null);
  const sparkMap = useMemo(sparkTexture, []);

  const spark = useMemo(() => {
    const pos = new Float32Array(SPARKS * 3);
    const vel = new Float32Array(SPARKS * 3);
    for (let i = 0; i < SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.3;
      vel.set([Math.cos(a) * r, 0.6 + Math.random() * 1.8, Math.sin(a) * r * 0.6], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo, vel };
  }, [intro.at]);

  useFrame(() => {
    const t = intro.present && intro.at > 0 ? now() - intro.at - STRIKE : 99;

    let peak = 0;
    FLASHES.forEach(([a, b, k], i) => {
      const on = t >= a && t < b;
      const g = boltGroups.current[i];
      if (g) {
        g.visible = on;
        g.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (!m) return;
          m.userData.base ??= m.opacity;
          m.opacity = m.userData.base * k;
        });
      }
      if (on) peak = Math.max(peak, k);
    });
    if (light.current) light.current.intensity = 10 * peak;

    if (ring.current) {
      const r = THREE.MathUtils.clamp(t / 0.5, 0, 1);
      ring.current.visible = t >= 0 && r < 1;
      ring.current.scale.setScalar(0.05 + r * 0.65);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - r) * (1 - r);
    }
    if (scorch.current) {
      const s = THREE.MathUtils.clamp(t / 4, 0, 1);
      scorch.current.visible = t >= 0 && s < 1;
      (scorch.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - s);
    }
    if (sparks.current) {
      const life = 1.1;
      sparks.current.visible = t >= 0 && t < life;
      if (sparks.current.visible) {
        const p = spark.geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < SPARKS; i++) {
          const vx = spark.vel[i * 3], vy = spark.vel[i * 3 + 1], vz = spark.vel[i * 3 + 2];
          p.setXYZ(i, vx * t * 0.5, Math.max(0, 0.02 + vy * t * 0.5 - 2.2 * t * t), vz * t * 0.5);
        }
        p.needsUpdate = true;
        (sparks.current.material as THREE.PointsMaterial).opacity = 1 - t / life;
      }
    }
  });

  const glow = { color: "#7cc8ff", transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending };

  return (
    <group>
      {bolts.map((b, i) => (
        <group key={`${intro.at}-${i}`} ref={(g) => void (boltGroups.current[i] = g)} visible={false}>
          <Line points={b.main} lineWidth={16} {...glow} opacity={0.35} />
          <Line points={b.main} lineWidth={4} color="#ffffff" transparent depthWrite={false} toneMapped={false} />
          {b.branches.map((br, j) => (
            <group key={j}>
              <Line points={br} lineWidth={8} {...glow} opacity={0.25} />
              <Line points={br} lineWidth={2} color="#eaf6ff" transparent depthWrite={false} toneMapped={false} />
            </group>
          ))}
        </group>
      ))}

      <pointLight ref={light} position={[0, 0.35, 0.35]} color="#bfe3ff" intensity={0} distance={4} />

      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} visible={false}>
        <ringGeometry args={[0.93, 1, 64]} />
        <meshBasicMaterial color="#8fd8ff" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh ref={scorch} rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} visible={false}>
        <circleGeometry args={[0.32, 48]} />
        <meshBasicMaterial color="#000000" transparent depthWrite={false} />
      </mesh>

      <points ref={sparks} geometry={spark.geo} visible={false}>
        <pointsMaterial map={sparkMap} color="#ffd889" size={0.035} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
