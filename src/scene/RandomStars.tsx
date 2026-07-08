// Procedural point stars scattered at random directions across the sky. The
// milky-way image (StarField) stays underneath as faint haze; this adds the
// actual pin-point stars it lacks -- varied brightness, real colour
// temperature (hot blue-white through cool amber), a bright core with soft
// glow and a faint diffraction cross, plus a gentle twinkle. The whole shell
// follows the camera so it reads as an infinitely distant sky at any zoom.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const COUNT = 4200;
const SHELL = 8000; // just inside the 9000-unit milky-way sphere

// blackbody-ish star tints, weighted toward the common cool white / blue-white
const STAR_TINTS: [number, THREE.Color][] = [
  [0.30, new THREE.Color("#aacbff")], // hot blue-white (rare, but striking)
  [0.62, new THREE.Color("#e8efff")], // white
  [0.85, new THREE.Color("#fff4e0")], // yellow-white (sun-like)
  [0.96, new THREE.Color("#ffd8a6")], // amber
  [1.00, new THREE.Color("#ffb27a")], // cool orange-red
];

function pickTint(r: number, out: THREE.Color) {
  for (const [thresh, c] of STAR_TINTS) {
    if (r <= thresh) return out.copy(c);
  }
  return out.copy(STAR_TINTS[STAR_TINTS.length - 1][1]);
}

const STAR_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTw;

  void main() {
    vColor = aColor;
    // subtle per-star twinkle, each with its own phase and rate
    vTw = 0.78 + 0.22 * sin(uTime * 2.0 + aPhase * 6.2831);
    gl_PointSize = aSize * uPixelRatio * (0.85 + vTw * 0.3);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const STAR_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  varying float vTw;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(core, 3.0);
    // faint 4-point diffraction spikes for the brighter look of a real star
    float spike = max(0.0, 1.0 - abs(c.x) * 16.0) + max(0.0, 1.0 - abs(c.y) * 16.0);
    spike *= core * 0.35;
    float intensity = glow * 1.5 + core * 0.45 + spike;
    gl_FragColor = vec4(vColor * intensity * vTw, 1.0);
  }
`;

export function RandomStars() {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const dir = new THREE.Vector3();
    const tint = new THREE.Color();

    // stable RNG so the sky is identical every load
    let s = 0x9e3779b9;
    const rand = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = 0; i < COUNT; i++) {
      // uniform random direction on the sphere
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const rxy = Math.sqrt(1 - u * u);
      dir.set(rxy * Math.cos(theta), u, rxy * Math.sin(theta));
      positions[i * 3] = dir.x * SHELL;
      positions[i * 3 + 1] = dir.y * SHELL;
      positions[i * 3 + 2] = dir.z * SHELL;

      pickTint(rand(), tint);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;

      // magnitude: power-law so most stars are faint specks, a few blaze
      const m = rand();
      sizes[i] = 1.3 + Math.pow(m, 6) * 9.0;
      phases[i] = rand();
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
    }),
    [],
  );

  useFrame(({ camera, clock }) => {
    groupRef.current?.position.copy(camera.position);
    if (matRef.current) uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false} renderOrder={-9}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={STAR_VERT}
          fragmentShader={STAR_FRAG}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
