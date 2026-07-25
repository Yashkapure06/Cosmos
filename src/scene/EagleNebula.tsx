// Eagle Nebula (Pillars of Creation) — visitable HII cloud, sibling of OrionNursery.
// Compressed distance; pink/amber pillars + dark dust lanes.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES } from "../lib/bodies";
import { offsetOf } from "./frames";
import { quality } from "../lib/quality";

const R = BODIES.eaglenebula.radius;
const GAS = 7000;
const DUST = 1200;

const VERT = /* glsl */ `
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
    vec3 p = position;
    p += 0.01 * vec3(
      sin(uTime * 0.09 + aPhase * 6.283),
      cos(uTime * 0.07 + aPhase * 4.0),
      sin(uTime * 0.11 + aPhase * 8.0)
    ) * ${R.toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float px = aSize * uPixelRatio * ${(R * 36).toFixed(1)} / -mv.z;
    gl_PointSize = clamp(px, 1.5, 120.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying vec3 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d) * uAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function EagleNebula() {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const n = GAS + DUST;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const rand = rng(0xea91e);
    const pink = new THREE.Color("#ff6b8a");
    const amber = new THREE.Color("#ffb060");
    const teal = new THREE.Color("#5ec8c0");
    const dust = new THREE.Color("#1a1018");
    const col = new THREE.Color();

    // three pillars rising in +Y
    for (let i = 0; i < GAS; i++) {
      const pillar = i % 3;
      const px = (pillar - 1) * 0.35 * R + (rand() - 0.5) * 0.22 * R;
      const py = (rand() - 0.15) * 1.1 * R;
      const pz = (rand() - 0.5) * 0.28 * R;
      // taper toward tip
      const taper = 1 - Math.max(0, py) / R;
      positions[i * 3] = px * (0.4 + 0.6 * taper);
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz * (0.4 + 0.6 * taper);
      col.copy(pink).lerp(amber, rand() * 0.5).lerp(teal, rand() * 0.2);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      sizes[i] = 0.6 + rand() * 2.2;
      phases[i] = rand();
    }
    for (let i = 0; i < DUST; i++) {
      const j = GAS + i;
      positions[j * 3] = (rand() - 0.5) * 1.6 * R;
      positions[j * 3 + 1] = (rand() - 0.5) * 1.2 * R;
      positions[j * 3 + 2] = (rand() - 0.5) * 1.0 * R;
      colors[j * 3] = dust.r;
      colors[j * 3 + 1] = dust.g;
      colors[j * 3 + 2] = dust.b;
      sizes[j] = 1.2 + rand() * 3;
      phases[j] = rand();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: 0.45 },
    }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf("eaglenebula", g.position);
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uPixelRatio.value = quality.dpr;
      const d = camera.position.distanceTo(g.position);
      matRef.current.uniforms.uAlpha.value = THREE.MathUtils.lerp(
        0.65,
        0.25,
        THREE.MathUtils.smoothstep(d, R * 0.5, R * 5),
      );
    }
    geometry.setDrawRange(0, Math.max(1500, Math.floor((GAS + DUST) * quality.particleScale)));
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={VERT}
          fragmentShader={FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
