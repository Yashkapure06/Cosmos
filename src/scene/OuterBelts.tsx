// The outer solar system's two great reservoirs, both as static heliocentric
// point fields (orbital periods out here are centuries to millions of years,
// so nothing needs to move at renderable timescales):
//
//  - Kuiper belt: a torus of icy bodies from ~32 to 50 AU, scattered around
//    the ecliptic (Pluto's orbit threads right through it).
//  - Oort cloud: a vast, whisper-faint spherical shell much farther out --
//    deliberately compressed in distance (like the black hole) so it exists
//    inside the scene's far plane at all.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { offsetOf } from "./frames";

const AU_TO_UNITS = 149597870.7 / EARTH_RADIUS_KM;

// ecliptic -> EQJ -> scene, same mapping the ephemeris uses
const OBLIQUITY = (23.4392811 * Math.PI) / 180;
const COS_EPS = Math.cos(OBLIQUITY);
const SIN_EPS = Math.sin(OBLIQUITY);
function eclToScene(xe: number, ye: number, ze: number, out: THREE.Vector3): THREE.Vector3 {
  const yEq = ye * COS_EPS - ze * SIN_EPS;
  const zEq = ye * SIN_EPS + ze * COS_EPS;
  return out.set(xe, zEq, -yEq);
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

const BELT_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uPixelRatio * 900000.0 / -mv.z;
    gl_PointSize = clamp(px, 1.0, 6.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const BELT_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying vec3 vColor;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * core, core * uAlpha);
  }
`;

function useHelioAnchor() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current) offsetOf("sun", groupRef.current.position);
  });
  return groupRef;
}

function BeltPoints({
  geometry,
  alpha,
  renderOrder = 0,
}: {
  geometry: THREE.BufferGeometry;
  alpha: number;
  renderOrder?: number;
}) {
  const groupRef = useHelioAnchor();
  const uniforms = useMemo(
    () => ({
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: alpha },
    }),
    [alpha],
  );
  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false} renderOrder={renderOrder}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={BELT_VERT}
          fragmentShader={BELT_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

const KUIPER_COUNT = 16000;

export function KuiperBelt() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(KUIPER_COUNT * 3);
    const colors = new Float32Array(KUIPER_COUNT * 3);
    const sizes = new Float32Array(KUIPER_COUNT);
    const rand = rngFrom(0x4b756970);
    const v = new THREE.Vector3();
    const col = new THREE.Color();
    const icy = new THREE.Color("#bcc8d4");
    const red = new THREE.Color("#c8a088"); // many KBOs are surprisingly red
    for (let i = 0; i < KUIPER_COUNT; i++) {
      // classical belt bulk 39-48 AU, thinning tails to 32 and 50
      const u = rand();
      const aAu = 32 + (u < 0.75 ? 7 + rand() * 9 : rand() * 18);
      const theta = rand() * Math.PI * 2;
      // inclination scatter: a cold thin core + a dynamically hot component
      const incSpread = rand() < 0.6 ? 0.04 : 0.22;
      const zAu = (rand() * 2 - 1) * aAu * incSpread;
      const r = aAu * AU_TO_UNITS;
      eclToScene(Math.cos(theta) * r, Math.sin(theta) * r, zAu * AU_TO_UNITS, v);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      col.copy(icy).lerp(red, rand() * 0.65).multiplyScalar(0.5 + rand() * 0.5);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      sizes[i] = 0.4 + Math.pow(rand(), 4) * 1.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  return <BeltPoints geometry={geometry} alpha={0.5} />;
}

const OORT_COUNT = 4000;

export function OortCloud() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(OORT_COUNT * 3);
    const colors = new Float32Array(OORT_COUNT * 3);
    const sizes = new Float32Array(OORT_COUNT);
    const rand = rngFrom(0x6f6f7274);
    const col = new THREE.Color();
    const base = new THREE.Color("#9fb2c8");
    for (let i = 0; i < OORT_COUNT; i++) {
      // spherical shell, radially thick: 1.6M - 2.6M scene units
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const r = (1.6 + rand() * 1.0) * 1_000_000;
      const rxy = Math.sqrt(1 - u * u) * r;
      positions[i * 3] = Math.cos(phi) * rxy;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = Math.sin(phi) * rxy;
      col.copy(base).multiplyScalar(0.35 + rand() * 0.45);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      sizes[i] = 0.5 + Math.pow(rand(), 3) * 1.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  return <BeltPoints geometry={geometry} alpha={0.22} />;
}
