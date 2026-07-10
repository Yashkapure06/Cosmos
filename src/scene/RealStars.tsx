// The real night sky: 5000+ actual stars from the Hipparcos/Yale catalogues
// (via d3-celestial's stars.6.json) at their true RA/Dec, sized by true
// magnitude and tinted by true B-V colour. Sirius, Betelgeuse, the Southern
// Cross -- they're all exactly where they belong, which is what makes the
// constellation figures (Constellations.tsx) line up. Replaces the old
// procedurally-random starfield. Same camera-following shell + twinkle.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { bvToColor, loadStars, raDecToDir, type CatalogStar } from "../lib/sky";

export const STAR_SHELL = 8000; // just inside the 9000-unit milky-way sphere

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

export function RealStars() {
  const groupRef = useRef<THREE.Group>(null);
  const [stars, setStars] = useState<CatalogStar[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadStars().then((s) => alive && setStars(s));
    return () => {
      alive = false;
    };
  }, []);

  const geometry = useMemo(() => {
    if (!stars) return null;
    const n = stars.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const dir = new THREE.Vector3();
    const tint = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const s = stars[i];
      raDecToDir(s.raDeg, s.decDeg, dir);
      positions[i * 3] = dir.x * STAR_SHELL;
      positions[i * 3 + 1] = dir.y * STAR_SHELL;
      positions[i * 3 + 2] = dir.z * STAR_SHELL;

      bvToColor(s.bv, tint);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;

      // true magnitude -> pixel size: Sirius (-1.46) blazes, mag-6 is a speck
      const bright = Math.pow(10, -0.24 * s.mag); // relative flux-ish scale
      sizes[i] = THREE.MathUtils.clamp(1.1 + bright * 4.2, 1.1, 11.0);
      phases[i] = ((s.raDeg * 13.7 + s.decDeg * 7.3) % 1 + 1) % 1;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return g;
  }, [stars]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    }),
    [],
  );

  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ camera, clock }) => {
    groupRef.current?.position.copy(camera.position);
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  if (!geometry) return null;

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
