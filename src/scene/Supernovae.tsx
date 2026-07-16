// Dying stars, on the real sky at the real dates.
//
// Historical supernovae (SN 1054 / Tycho 1572 / Kepler 1604): jump the time
// machine to the event and a star blooms at its true position -- fast rise,
// slow months-long decay, then a remnant nebula fades in over decades and
// stays forever (at today's date the Crab Nebula is simply *there*, with its
// pulsar sweeping lighthouse beams).
//
// Plus ambient distant novae: every couple of minutes a random far star
// flares and dies quietly, so the sky always feels alive.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  raDecToDir,
  remnantEnvelope,
  SUPERNOVAE,
  supernovaEnvelope,
  type SupernovaEvent,
} from "../lib/sky";
import { getSimNow, useStore } from "../store/useStore";
import { STAR_SHELL } from "./RealStars";

const SHELL = STAR_SHELL * 0.96;

// bright core + 6-ray star burst, the classic "new star" look
function makeFlashTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2;
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, S * 0.16);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.35, "rgba(230,240,255,0.85)");
  core.addColorStop(1, "rgba(180,210,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    const len = i % 3 === 0 ? S * 0.5 : S * 0.34;
    const g = ctx.createLinearGradient(
      cx - Math.cos(a) * len, cx - Math.sin(a) * len,
      cx + Math.cos(a) * len, cx + Math.sin(a) * len,
    );
    g.addColorStop(0, "rgba(200,220,255,0)");
    g.addColorStop(0.5, "rgba(235,244,255,0.8)");
    g.addColorStop(1, "rgba(200,220,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * len, cx - Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a) * len, cx + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// filamentary remnant: tangled wisps around a hollow-ish center (Crab-like)
function makeRemnantTexture(tint: string): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2;
  const c = new THREE.Color(tint);
  const rgba = (a: number) =>
    `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a})`;
  let seed = 99;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // body glow
  const body = ctx.createRadialGradient(cx, cx, S * 0.04, cx, cx, S * 0.42);
  body.addColorStop(0, rgba(0.3));
  body.addColorStop(0.55, rgba(0.14));
  body.addColorStop(1, rgba(0));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, S, S);
  // filaments: jagged strands radiating outward with sideways wobble
  for (let i = 0; i < 26; i++) {
    const a0 = rand() * Math.PI * 2;
    let r = S * (0.08 + rand() * 0.1);
    ctx.strokeStyle = rgba(0.16 + rand() * 0.2);
    ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * r, cx + Math.sin(a0) * r);
    let a = a0;
    for (let s = 0; s < 5; s++) {
      a += (rand() - 0.5) * 1.2;
      r += S * (0.04 + rand() * 0.05);
      ctx.lineTo(
        cx + Math.cos(a0) * r + Math.cos(a) * S * 0.03,
        cx + Math.sin(a0) * r + Math.sin(a) * S * 0.03,
      );
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBeamTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 32;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(200,225,255,0.85)");
  g.addColorStop(0.5, "rgba(160,200,255,0.25)");
  g.addColorStop(1, "rgba(140,190,255,0)");
  ctx.fillStyle = g;
  // taper the beam vertically
  for (let y = 0; y < H; y++) {
    const w = 1 - Math.abs(y - H / 2) / (H / 2);
    ctx.globalAlpha = w * w;
    ctx.fillRect(0, y, W, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Supernova({ sn, flashTex }: { sn: SupernovaEvent; flashTex: THREE.CanvasTexture }) {
  const flashRef = useRef<THREE.Sprite>(null);
  const remnantRef = useRef<THREE.Sprite>(null);
  const beamsRef = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const showLabels = useStore((s) => s.showConstellations);

  const pos = useMemo(
    () => raDecToDir(sn.raDeg, sn.decDeg, new THREE.Vector3()).multiplyScalar(SHELL),
    [sn],
  );
  const remnantTex = useMemo(
    () => (sn.remnant ? makeRemnantTexture(sn.remnant.tint) : null),
    [sn],
  );
  const beamTex = useMemo(
    () => (sn.remnant?.pulsar ? makeBeamTexture() : null),
    [sn],
  );

  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }) => {
    const now = getSimNow();
    const flash = supernovaEnvelope(sn, now);
    const remn = sn.remnant ? remnantEnvelope(sn, now) : 0;
    // drei Html mirror-projects positions behind the camera to screen centre;
    // sky labels must hide when their direction is behind the view
    const inFront = camera.getWorldDirection(scratch).dot(pos) > 0;

    if (flashRef.current) {
      flashRef.current.visible = flash > 0.003;
      const twinkle = 1 + 0.06 * Math.sin(clock.elapsedTime * 9);
      flashRef.current.scale.setScalar(Math.max(1, sn.peakSize * flash * twinkle));
      (flashRef.current.material as THREE.SpriteMaterial).opacity = Math.min(1, flash * 1.4);
    }

    if (remnantRef.current && sn.remnant) {
      remnantRef.current.visible = remn > 0.01;
      // the real Crab has been expanding for ~970 years; grow gently forever
      const years = Math.max(0, (now - sn.startMs) / (365.25 * 86400000));
      const grow = 0.35 + 0.65 * Math.min(1, years / 970);
      remnantRef.current.scale.setScalar(sn.remnant.size * grow);
      (remnantRef.current.material as THREE.SpriteMaterial).opacity = 0.85 * remn;
    }

    if (beamsRef.current) {
      beamsRef.current.visible = remn > 0.25;
      // artistic pulsar sweep (the real Crab pulsar spins 30x/second)
      beamsRef.current.rotation.z = clock.elapsedTime * 2.4;
    }

    if (labelRef.current) {
      const show = inFront && showLabels && (flash > 0.02 || remn > 0.3);
      labelRef.current.style.opacity = show ? "1" : "0";
      labelRef.current.textContent =
        flash > 0.02 ? `${sn.label.toUpperCase()} — SUPERNOVA` : (sn.remnant?.label.toUpperCase() ?? "");
    }
  });

  return (
    <group position={pos}>
      <sprite ref={flashRef} visible={false}>
        <spriteMaterial
          map={flashTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {remnantTex && (
        <sprite ref={remnantRef} visible={false}>
          <spriteMaterial
            map={remnantTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}
      {beamTex && (
        <group ref={beamsRef} visible={false}>
          {[0, Math.PI].map((rot) => (
            <sprite key={rot} position={[0, 0, 0]} scale={[420, 60, 1]}>
              <spriteMaterial
                map={beamTex}
                rotation={rot}
                transparent
                opacity={0.5}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          ))}
        </group>
      )}
      <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
        <span ref={labelRef} className="shower-label" style={{ opacity: 0 }} />
      </Html>
    </group>
  );
}

// a quiet distant nova every ~2.5 minutes: flare up over ~4 s, die over ~18 s
const NOVA_PERIOD_S = 150;
const NOVA_LIFE_S = 22;

function AmbientNovae({ flashTex }: { flashTex: THREE.CanvasTexture }) {
  const ref = useRef<THREE.Sprite>(null);
  const state = useRef({ cycle: -1, dir: new THREE.Vector3(1, 0, 0) });

  useFrame(({ clock }) => {
    const s = ref.current;
    if (!s) return;
    const t = clock.elapsedTime + NOVA_PERIOD_S * 0.8; // first one arrives early
    const cycle = Math.floor(t / NOVA_PERIOD_S);
    const local = t - cycle * NOVA_PERIOD_S;

    if (cycle !== state.current.cycle) {
      state.current.cycle = cycle;
      // deterministic pseudo-random sky direction per cycle
      let h = (cycle * 2654435761) >>> 0;
      const rnd = () => {
        h = (h * 1664525 + 1013904223) >>> 0;
        return h / 4294967296;
      };
      const u = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const rxy = Math.sqrt(1 - u * u);
      state.current.dir.set(rxy * Math.cos(phi), u, rxy * Math.sin(phi));
      s.position.copy(state.current.dir).multiplyScalar(SHELL);
    }

    if (local > NOVA_LIFE_S) {
      s.visible = false;
      return;
    }
    const rise = Math.min(1, local / 4);
    const decay = Math.exp(-Math.max(0, local - 4) / 6);
    const env = rise * rise * decay;
    s.visible = env > 0.01;
    s.scale.setScalar(90 + 240 * env);
    (s.material as THREE.SpriteMaterial).opacity = env;
  });

  return (
    <sprite ref={ref} visible={false}>
      <spriteMaterial
        map={flashTex}
        color="#dfe8ff"
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

export function Supernovae() {
  const groupRef = useRef<THREE.Group>(null);
  const [flashTex] = useState(() => makeFlashTexture());

  useEffect(() => () => flashTex.dispose(), [flashTex]);

  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
  });

  return (
    <group ref={groupRef}>
      {SUPERNOVAE.map((sn) => (
        <Supernova key={sn.id} sn={sn} flashTex={flashTex} />
      ))}
      <AmbientNovae flashTex={flashTex} />
    </group>
  );
}
