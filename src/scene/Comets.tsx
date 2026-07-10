// Comets: a tiny irregular nucleus (rendered enlarged, like the belt rocks),
// an additive coma glow, and two particle tails computed on the GPU -- a
// straight bluish ion tail blown directly anti-sunward and a curved, warmer
// dust tail lagging along the orbit. Activity scales with heliocentric
// distance, so a comet is a dead grey rock out past ~4.5 AU and lights up as
// it falls toward perihelion (use the time machine to watch it happen).

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES, BODY_IDS, type BodyDef, type BodyId } from "../lib/bodies";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { helioElementsUnits } from "../lib/ephemeris";
import { getSimNow } from "../store/useStore";
import { helio, offsetOf } from "./frames";

const AU_TO_UNITS = 149597870.7 / EARTH_RADIUS_KM;
const HOURS_TO_MS = 3_600_000;

// real comet nuclei are km-scale: enlarge so the rock is visible when focused
const MESH_GAIN = 40;
const TAIL_POINTS = 2200;

const COMET_IDS: BodyId[] = BODY_IDS.filter((id) => BODIES[id].type === "comet");

function idSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rngFrom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// dirty-snowball nucleus: unit icosphere with layered lobes, same recipe as
// the named asteroids but slightly smoother (ices smooth the small relief)
function buildNucleus(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const rand = rngFrom(seed);
  const px = rand() * 6.28;
  const py = rand() * 6.28;
  const pz = rand() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    // strongly bilobed (67P-style) plus mid-frequency ridges
    const lobe =
      Math.sin(n.x * 1.4 + px) * Math.cos(n.y * 1.2 + py) * 0.5 +
      Math.sin(n.z * 1.8 + pz) * 0.3;
    const mid = Math.sin(n.x * 5 + seed) * 0.06 + Math.cos(n.z * 6 - seed) * 0.05;
    v.copy(n).multiplyScalar(Math.max(0.5, 1 + (lobe + mid) * 0.35));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// soft radial gradient for the coma sprite
function makeComaTexture(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.25, "rgba(210,235,255,0.45)");
  g.addColorStop(0.6, "rgba(160,200,240,0.12)");
  g.addColorStop(1, "rgba(120,170,220,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TAIL_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aT;     // 0..1 station along the tail
  attribute vec3 aSeed;   // random unit scatter direction
  attribute float aSize;
  uniform vec3 uDir;      // tail axis, local (unit, anti-sunward)
  uniform vec3 uCurve;    // curvature direction, local (unit)
  uniform float uLen;     // tail length, scene units
  uniform float uSpread;  // radial spread fraction at the tail end
  uniform float uCurveAmt;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vFade;

  void main() {
    // particles stream head -> tail and recycle, so the tail visibly flows
    float t = fract(aT + uTime * 0.05);
    vec3 p = uDir * (t * uLen)
           + uCurve * (t * t * uLen * uCurveAmt)
           + aSeed * (t * uSpread * uLen);
    vFade = pow(1.0 - t, 1.6);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (200.0 + t * 2200.0) / -mv.z, 2.0, 42.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const TAIL_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vFade;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * core, core * vFade * uAlpha);
  }
`;

function makeTailAttributes(seed: number) {
  const t = new Float32Array(TAIL_POINTS);
  const seeds = new Float32Array(TAIL_POINTS * 3);
  const sizes = new Float32Array(TAIL_POINTS);
  const rand = rngFrom(seed);
  const v = new THREE.Vector3();
  for (let i = 0; i < TAIL_POINTS; i++) {
    t[i] = Math.pow(rand(), 1.4); // bias particles toward the bright head
    v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    seeds[i * 3] = v.x;
    seeds[i * 3 + 1] = v.y;
    seeds[i * 3 + 2] = v.z;
    sizes[i] = 0.4 + rand() * 1.1;
  }
  return { t, seeds, sizes };
}

function CometBody({ def }: { def: BodyDef }) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Mesh>(null);
  const comaRef = useRef<THREE.Sprite>(null);
  const ionRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => buildNucleus(idSeed(def.id)), [def.id]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#4a4643"), // comet nuclei are coal-dark
        roughness: 1.0,
        metalness: 0.0,
      }),
    [],
  );

  const comaTex = useMemo(() => makeComaTexture(), []);
  const comaMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: comaTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [comaTex],
  );

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const mkUniforms = (color: string, alpha: number) => ({
    uDir: { value: new THREE.Vector3(1, 0, 0) },
    uCurve: { value: new THREE.Vector3(0, 0, 1) },
    uLen: { value: 0 },
    uSpread: { value: 0.06 },
    uCurveAmt: { value: 0 },
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uColor: { value: new THREE.Color(color) },
    uAlpha: { value: alpha },
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ionUniforms = useMemo(() => mkUniforms("#7db8ff", 0.55), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dustUniforms = useMemo(() => mkUniforms("#ffe6c0", 0.4), []);

  const ionAttrs = useMemo(() => makeTailAttributes(idSeed(def.id) ^ 0xa5a5), [def.id]);
  const dustAttrs = useMemo(() => makeTailAttributes(idSeed(def.id) ^ 0x5a5a), [def.id]);

  const s = useMemo(
    () => ({
      antiSun: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      next: new THREE.Vector3(),
      curve: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf(def.id, g.position);

    const now = getSimNow();
    if (spinRef.current && def.rotationHours) {
      spinRef.current.rotation.y = (now / (def.rotationHours * HOURS_TO_MS)) * Math.PI * 2;
    }

    const rAU = helio.pos[def.id].length() / AU_TO_UNITS;
    // sublimation switches on inside ~4.5 AU and ramps hard toward perihelion
    const activity = THREE.MathUtils.clamp((4.5 - rAU) / 3.5, 0, 1);

    // coma: a glow around the head that swells with activity
    if (comaRef.current) {
      const scale = 0.02 + activity * 0.5;
      comaRef.current.scale.setScalar(scale);
      comaMat.opacity = 0.08 + activity * 0.85;
    }

    const on = activity > 0.01;
    if (ionRef.current) ionRef.current.visible = on;
    if (dustRef.current) dustRef.current.visible = on;
    if (!on) return;

    // write through the mounted materials: the `uniforms` prop object is not
    // guaranteed to stay identical to what the material actually holds
    const ionU = (ionRef.current?.material as THREE.ShaderMaterial | undefined)?.uniforms;
    const dustU = (dustRef.current?.material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (!ionU || !dustU) return;

    // tail axis: straight away from the Sun (helio position IS that direction)
    s.antiSun.copy(helio.pos[def.id]).normalize();

    // orbital velocity direction (finite difference on the elements): the
    // dust tail lags behind the comet's motion, curving along the orbit
    const el = BODIES[def.id].helioElements;
    if (el) {
      helioElementsUnits(el, now + 3600_000, s.next);
      s.vel.copy(s.next).sub(helio.pos[def.id]).normalize();
      s.curve.copy(s.vel).multiplyScalar(-1);
    }

    // short + dense reads far better than astronomically long + wispy
    const len = (0.02 + 0.1 * activity) * activity * AU_TO_UNITS;
    for (const u of [ionU, dustU]) {
      u.uDir.value.copy(s.antiSun);
      u.uCurve.value.copy(s.curve);
      u.uTime.value = clock.elapsedTime;
    }
    ionU.uLen.value = len;
    ionU.uCurveAmt.value = 0.04;
    ionU.uSpread.value = 0.02;
    ionU.uAlpha.value = 0.85 * activity;
    dustU.uLen.value = len * 0.65;
    dustU.uCurveAmt.value = 0.22;
    dustU.uSpread.value = 0.055;
    dustU.uAlpha.value = 0.6 * activity;
  });

  return (
    <group ref={groupRef}>
      <mesh
        ref={spinRef}
        geometry={geometry}
        material={material}
        scale={def.radius * MESH_GAIN}
      />
      <sprite ref={comaRef} material={comaMat} scale={0.02} />
      <points ref={ionRef} frustumCulled={false} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TAIL_POINTS * 3), 3]} />
          <bufferAttribute attach="attributes-aT" args={[ionAttrs.t, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[ionAttrs.seeds, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[ionAttrs.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={ionUniforms}
          vertexShader={TAIL_VERT}
          fragmentShader={TAIL_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={dustRef} frustumCulled={false} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TAIL_POINTS * 3), 3]} />
          <bufferAttribute attach="attributes-aT" args={[dustAttrs.t, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[dustAttrs.seeds, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[dustAttrs.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={dustUniforms}
          vertexShader={TAIL_VERT}
          fragmentShader={TAIL_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export function Comets() {
  return (
    <Suspense fallback={null}>
      {COMET_IDS.map((id) => (
        <CometBody key={id} def={BODIES[id]} />
      ))}
    </Suspense>
  );
}
