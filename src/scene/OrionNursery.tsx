// The Orion Nebula as a visitable stellar nursery -- the "stars being born"
// showcase. A clumpy volume of glowing hydrogen (pink) and doubly-ionised
// oxygen (teal) around the Trapezium cluster, laced with dark dust. Six
// protostar knots run staggered ignition cycles: a dust cocoon collapses,
// heats to a deep ember glow, then the star switches on with a flash and
// bipolar jets before settling into a steady newborn. Real collapse takes
// ~100,000 years; here it's ~48 seconds, the same artistic compression the
// rest of the scene uses.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES } from "../lib/bodies";
import { offsetOf } from "./frames";

const R = BODIES.orionnebula.radius; // cloud half-extent, scene units

const GAS_COUNT = 9000;
const DUST_COUNT = 1600;

const KNOT_PERIOD = 48; // seconds per birth cycle
const KNOTS = 6;

const GAS_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    // slow breathing drift so the cloud feels alive
    vec3 p = position;
    p += 0.012 * vec3(
      sin(uTime * 0.11 + aPhase * 6.283),
      cos(uTime * 0.09 + aPhase * 12.566),
      sin(uTime * 0.13 + aPhase * 9.42)
    ) * ${R.toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float px = aSize * uPixelRatio * ${(R * 40).toFixed(1)} / -mv.z;
    gl_PointSize = clamp(px, 2.0, 160.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const GAS_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying vec3 vColor;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor * soft, soft * uAlpha);
  }
`;

function rngFrom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGauss(rand: () => number) {
  return () =>
    Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) *
    Math.cos(2 * Math.PI * rand());
}

function makeBlobTexture(inner: string, outer: string): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// JWST's signature stellar look: bright core + six long diffraction spikes
// (from the hexagonal mirror) + two short horizontal ones (the strut).
function makeJwstStarTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2;
  const spike = (angle: number, len: number, width: number) => {
    const g = ctx.createLinearGradient(
      cx - Math.cos(angle) * len, cx - Math.sin(angle) * len,
      cx + Math.cos(angle) * len, cx + Math.sin(angle) * len,
    );
    g.addColorStop(0, "rgba(255,240,220,0)");
    g.addColorStop(0.5, "rgba(255,248,235,0.9)");
    g.addColorStop(1, "rgba(255,240,220,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * len, cx - Math.sin(angle) * len);
    ctx.lineTo(cx + Math.cos(angle) * len, cx + Math.sin(angle) * len);
    ctx.stroke();
  };
  // six primary spikes, 60 deg apart, rotated so one pair is vertical
  for (let i = 0; i < 3; i++) spike(Math.PI / 2 + (i * Math.PI) / 3, S * 0.48, 2.4);
  // two short horizontal strut spikes
  spike(0, S * 0.26, 1.8);
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, S * 0.12);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.4, "rgba(255,245,230,0.7)");
  core.addColorStop(1, "rgba(255,235,210,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Knot {
  pos: THREE.Vector3;
  axis: THREE.Vector3;
  offset: number;
}

function ProtostarKnot({
  knot,
  glowTex,
  starTex,
}: {
  knot: Knot;
  glowTex: THREE.CanvasTexture;
  starTex: THREE.CanvasTexture;
}) {
  const cocoonRef = useRef<THREE.Sprite>(null);
  const emberRef = useRef<THREE.Sprite>(null);
  const starRef = useRef<THREE.Sprite>(null);
  const jetRefs = useRef<(THREE.Mesh | null)[]>([]);

  const jetQuats = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    const q1 = new THREE.Quaternion().setFromUnitVectors(up, knot.axis);
    const q2 = new THREE.Quaternion().setFromUnitVectors(up, knot.axis.clone().negate());
    return [q1, q2];
  }, [knot]);

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime + knot.offset) % KNOT_PERIOD;
    const S = R * 0.16; // base knot scale

    // phase envelopes
    // 0-16 s   : dust cocoon shrinks (collapse)
    // 14-22 s  : ember glow rises inside
    // 22-24 s  : ignition flash + jets erupt
    // 24-40 s  : steady newborn star, jets fade
    // 40-48 s  : star dims out, next cocoon condenses
    const collapse = THREE.MathUtils.clamp(t / 16, 0, 1);
    const ember = THREE.MathUtils.smoothstep(t, 14, 22);
    const flash =
      THREE.MathUtils.smoothstep(t, 21.5, 23) *
      (1 - THREE.MathUtils.smoothstep(t, 23, 27));
    const born = THREE.MathUtils.smoothstep(t, 22.5, 24) *
      (1 - THREE.MathUtils.smoothstep(t, 40, 47));
    const jets = THREE.MathUtils.smoothstep(t, 22, 25) *
      (1 - THREE.MathUtils.smoothstep(t, 30, 38));
    const recondense = THREE.MathUtils.smoothstep(t, 42, 48);

    if (cocoonRef.current) {
      const scale = S * (1.6 - collapse * 1.1) * (t > 40 ? recondense : 1);
      cocoonRef.current.scale.setScalar(Math.max(0.001, scale));
      (cocoonRef.current.material as THREE.SpriteMaterial).opacity =
        t > 40 ? 0.5 * recondense : 0.5 * (1 - ember * 0.8);
    }
    if (emberRef.current) {
      emberRef.current.scale.setScalar(S * (0.25 + ember * 0.3));
      (emberRef.current.material as THREE.SpriteMaterial).opacity =
        ember * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 7)) * (1 - flash);
    }
    if (starRef.current) {
      const pop = 1 + flash * 3.2;
      starRef.current.scale.setScalar(S * 0.5 * pop * Math.max(born, flash * 1.2));
      (starRef.current.material as THREE.SpriteMaterial).opacity = Math.min(
        1,
        born + flash * 1.5,
      );
    }
    for (const jet of jetRefs.current) {
      if (!jet) continue;
      jet.visible = jets > 0.01;
      jet.scale.set(0.3 + jets * 0.7, jets, 0.3 + jets * 0.7);
      (jet.material as THREE.MeshBasicMaterial).opacity = 0.14 * jets;
    }
  });

  return (
    <group position={knot.pos}>
      <sprite ref={cocoonRef}>
        <spriteMaterial map={glowTex} color="#5a4458" transparent depthWrite={false} />
      </sprite>
      <sprite ref={emberRef}>
        <spriteMaterial
          map={glowTex}
          color="#ff9a4a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={starRef}>
        <spriteMaterial
          map={starTex}
          color="#cfe4ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {jetQuats.map((q, i) => (
        <mesh
          key={i}
          quaternion={q}
          ref={(m) => {
            jetRefs.current[i] = m;
          }}
          visible={false}
        >
          {/* narrow translucent outflow cone (Herbig-Haro style) */}
          <coneGeometry args={[R * 0.016, R * 0.2, 12, 1, true]} />
          <meshBasicMaterial
            color="#9fd0ff"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

export function OrionNursery() {
  const groupRef = useRef<THREE.Group>(null);

  // JWST Carina-style composition: a sculpted rust-orange dust ridge across
  // the lower half (the "cosmic cliffs"), teal-blue ionised gas cavity above,
  // dark dust knots carving the ridge line.
  const { geometry, dustGeometry } = useMemo(() => {
    const rand = rngFrom(0x0810b1a5);
    const gauss = makeGauss(rand);
    const col = new THREE.Color();
    const cGasHi = new THREE.Color("#5a8fd0"); // upper cavity blue
    const cGasLo = new THREE.Color("#6fd8cc"); // teal near the ridge
    const cDustLit = new THREE.Color("#e08a44"); // sunlit rim of the cliffs
    const cDustDeep = new THREE.Color("#7a3d1e"); // deep rust

    // the cliff line: a wandering ridge height as a function of (x, z)
    const ridge = (x: number, z: number) =>
      R *
      (-0.18 +
        0.16 * Math.sin((x / R) * 2.3 + 1.2) +
        0.12 * Math.sin((z / R) * 3.1 + 0.4) +
        0.08 * Math.sin(((x + z) / R) * 4.7));

    const build = (count: number, dark: boolean) => {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const x = (rand() * 2 - 1) * 1.15 * R;
        const z = (rand() * 2 - 1) * 1.15 * R;
        const rl = ridge(x, z);
        let y: number;
        if (dark) {
          // dark knots hug the ridge from below, carving its silhouette
          y = rl - Math.abs(gauss()) * 0.22 * R;
        } else if (rand() < 0.55) {
          // glowing dust: dense just under the ridge line
          y = rl - Math.abs(gauss()) * 0.3 * R;
        } else {
          // ionised gas: fills the cavity above
          y = rl + Math.abs(gauss()) * 0.45 * R + 0.03 * R;
        }
        // taper the slab edges so the cloud reads roundish from outside
        const edge = Math.hypot(x, z) / (1.15 * R);
        if (edge > 1 || rand() < edge * edge * 0.5) {
          i--;
          continue;
        }
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        if (dark) {
          col.setRGB(0.05, 0.028, 0.02).multiplyScalar(0.7 + rand() * 0.6);
        } else if (y < rl) {
          // dust side: lit amber at the rim fading to deep rust below
          const depth = THREE.MathUtils.clamp((rl - y) / (0.3 * R), 0, 1);
          col.copy(cDustLit).lerp(cDustDeep, depth).multiplyScalar(0.4 + rand() * 0.6);
        } else {
          // gas side: teal near the ridge, bluer higher up
          const h = THREE.MathUtils.clamp((y - rl) / (0.45 * R), 0, 1);
          col.copy(cGasLo).lerp(cGasHi, h).multiplyScalar(0.3 + rand() * 0.5);
        }
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
        sizes[i] = dark ? 0.5 + rand() * 0.9 : 0.18 + Math.pow(rand(), 2) * 0.85;
        phases[i] = rand();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      g.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
      return g;
    };

    return { geometry: build(GAS_COUNT, false), dustGeometry: build(DUST_COUNT, true) };
  }, []);

  const gasUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: 0.16 },
    }),
    [],
  );
  const dustUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: 0.5 },
    }),
    [],
  );
  const gasMatRef = useRef<THREE.ShaderMaterial>(null);
  const dustMatRef = useRef<THREE.ShaderMaterial>(null);

  const glowTex = useMemo(
    () => makeBlobTexture("rgba(255,255,255,0.9)", "rgba(255,255,255,0)"),
    [],
  );
  const starTex = useMemo(() => makeJwstStarTexture(), []);

  // Trapezium: the four newborn O-stars that light the whole nebula,
  // floating in the gas cavity above the cliffs
  const trapezium = useMemo(() => {
    const rand = rngFrom(0x7a41);
    return Array.from({ length: 4 }, () => ({
      pos: new THREE.Vector3(
        (rand() - 0.5) * 0.2 * R,
        0.12 * R + rand() * 0.12 * R,
        (rand() - 0.5) * 0.2 * R,
      ),
      scale: R * (0.045 + rand() * 0.035),
    }));
  }, []);

  const knots: Knot[] = useMemo(() => {
    const rand = rngFrom(0xbeef01);
    return Array.from({ length: KNOTS }, (_, i) => ({
      pos: new THREE.Vector3(
        (rand() - 0.5) * 1.1 * R,
        (rand() - 0.5) * 0.7 * R,
        (rand() - 0.5) * 1.1 * R,
      ),
      axis: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
      offset: (i / KNOTS) * KNOT_PERIOD,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) offsetOf("orionnebula", groupRef.current.position);
    if (gasMatRef.current) gasMatRef.current.uniforms.uTime.value = clock.elapsedTime;
    if (dustMatRef.current) dustMatRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group ref={groupRef}>
      {/* glowing gas */}
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={gasMatRef}
          uniforms={gasUniforms}
          vertexShader={GAS_VERT}
          fragmentShader={GAS_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* dark dust lanes (normal blending over the glow) */}
      <points geometry={dustGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={dustMatRef}
          uniforms={dustUniforms}
          vertexShader={GAS_VERT}
          fragmentShader={GAS_FRAG}
          transparent
          depthWrite={false}
        />
      </points>
      {trapezium.map((s, i) => (
        <sprite key={i} position={s.pos} scale={s.scale}>
          <spriteMaterial
            map={starTex}
            color="#bcd8ff"
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
      {knots.map((knot, i) => (
        <ProtostarKnot key={i} knot={knot} glowTex={glowTex} starTex={starTex} />
      ))}
    </group>
  );
}
