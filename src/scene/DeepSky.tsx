// Deep-sky landmarks painted on the celestial sphere at their true positions:
// the Andromeda galaxy, the Orion nebula, the Pleiades, both Magellanic
// Clouds and Omega Centauri. Procedural canvas sprites -- no texture files.
// They ride the camera-following sky shell like the stars do.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { DEEP_SKY, raDecToDir, type DeepSkyObject } from "../lib/sky";
import { useStore } from "../store/useStore";
import { STAR_SHELL } from "./RealStars";

const SHELL = STAR_SHELL * 1.02; // just outside the stars, inside the skybox

function makeDsoTexture(o: DeepSkyObject): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2;
  const tint = new THREE.Color(o.tint);
  const rgba = (a: number) =>
    `rgba(${(tint.r * 255) | 0},${(tint.g * 255) | 0},${(tint.b * 255) | 0},${a})`;

  if (o.kind === "cluster") {
    // knot of individual bright points over a soft haze
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, S * 0.4);
    g.addColorStop(0, rgba(0.16));
    g.addColorStop(1, rgba(0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.6) * S * 0.28;
      const x = cx + Math.cos(a) * r;
      const y = cx + Math.sin(a) * r;
      const size = 1.5 + rand() * 3.5;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      pg.addColorStop(0, "rgba(255,255,255,0.9)");
      pg.addColorStop(0.4, rgba(0.5));
      pg.addColorStop(1, rgba(0));
      ctx.fillStyle = pg;
      ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);
    }
  } else if (o.kind === "nebula") {
    // layered wispy blobs
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const x = cx + (rand() - 0.5) * S * 0.34;
      const y = cx + (rand() - 0.5) * S * 0.34;
      const r = S * (0.1 + rand() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(0.16 + rand() * 0.12));
      g.addColorStop(1, rgba(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, S * 0.09);
    core.addColorStop(0, "rgba(255,255,255,0.65)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, S, S);
  } else {
    // galaxy: elongated core + disk glow
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(o.angle ?? 0);
    ctx.scale(o.stretch ?? 2, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.24);
    g.addColorStop(0, "rgba(255,246,228,0.75)");
    g.addColorStop(0.25, rgba(0.34));
    g.addColorStop(0.7, rgba(0.09));
    g.addColorStop(1, rgba(0));
    ctx.fillStyle = g;
    ctx.fillRect(-cx, -cx, S, S);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Dso({ o }: { o: DeepSkyObject }) {
  const texture = useMemo(() => makeDsoTexture(o), [o]);
  const pos = useMemo(
    () => raDecToDir(o.raDeg, o.decDeg, new THREE.Vector3()).multiplyScalar(SHELL),
    [o],
  );
  const showLabels = useStore((s) => s.showConstellations);

  return (
    <group position={pos}>
      <sprite scale={[o.size * (o.stretch ?? 1) * 0.6, o.size * 0.6, 1]}>
        <spriteMaterial
          map={texture}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {showLabels && (
        <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <span className="dso-label">{o.label.toUpperCase()}</span>
        </Html>
      )}
    </group>
  );
}

export function DeepSky() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
  });
  return (
    <group ref={groupRef}>
      {DEEP_SKY.map((o) => (
        <Dso key={o.id} o={o} />
      ))}
    </group>
  );
}
