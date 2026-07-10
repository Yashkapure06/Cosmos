// Meteor-shower radiants: when a shower is active at the current sim date its
// radiant point lights up on the sky shell with a streak burst + label
// (Perseids in August, Geminids in December, ...). Tracks the time machine.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { METEOR_SHOWERS, raDecToDir, showerActive, type MeteorShower } from "../lib/sky";
import { getSimNow, useStore } from "../store/useStore";
import { STAR_SHELL } from "./RealStars";

const SHELL = STAR_SHELL * 0.97;

// radial streak burst: short lines shooting out of the radiant
function makeRadiantTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2;
  let seed = 1234;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = S * (0.06 + rand() * 0.06);
    const r1 = r0 + S * (0.12 + rand() * 0.3);
    const grad = ctx.createLinearGradient(
      cx + Math.cos(a) * r0, cx + Math.sin(a) * r0,
      cx + Math.cos(a) * r1, cx + Math.sin(a) * r1,
    );
    grad.addColorStop(0, "rgba(255,235,200,0.85)");
    grad.addColorStop(1, "rgba(255,235,200,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1);
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, S * 0.08);
  core.addColorStop(0, "rgba(255,255,255,0.5)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Radiant({ s, texture }: { s: MeteorShower; texture: THREE.CanvasTexture }) {
  const pos = useMemo(
    () => raDecToDir(s.raDeg, s.decDeg, new THREE.Vector3()).multiplyScalar(SHELL),
    [s],
  );
  const matRef = useRef<THREE.SpriteMaterial>(null);

  // gentle pulse so an active radiant draws the eye
  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.opacity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 1.6);
  });

  return (
    <group position={pos}>
      <sprite scale={520}>
        <spriteMaterial
          ref={matRef}
          map={texture}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
        <span className="shower-label">
          {s.label.toUpperCase()} ACTIVE
          <em>peak {s.peak}</em>
        </span>
      </Html>
    </group>
  );
}

export function MeteorShowers() {
  const groupRef = useRef<THREE.Group>(null);
  const show = useStore((s) => s.showConstellations);
  const texture = useMemo(() => makeRadiantTexture(), []);
  const [active, setActive] = useState<MeteorShower[]>([]);

  // re-evaluate the calendar as sim time moves (cheap; every 2 s)
  useEffect(() => {
    const update = () =>
      setActive(METEOR_SHOWERS.filter((s) => showerActive(s, getSimNow())));
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, []);

  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
  });

  if (!show || active.length === 0) return null;

  return (
    <group ref={groupRef}>
      {active.map((s) => (
        <Radiant key={s.id} s={s} texture={texture} />
      ))}
    </group>
  );
}
