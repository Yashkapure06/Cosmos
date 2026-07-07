// All satellites as one GPU point cloud. Positions extrapolate on the GPU
// (base + velocity * dt) between worker snapshots, so per-frame CPU cost is ~0.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { CATEGORY_COLOR, type Category } from "../lib/constants";

const VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aVisible;

  uniform float uDt;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vVisible;

  void main() {
    vec3 p = position + aVel * uDt;
    vColor = aColor;
    vVisible = aVisible;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aSize * uPixelRatio * 5.2 / -mv.z;
    gl_PointSize = clamp(size, 1.2, 26.0) * aVisible;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  varying float vVisible;

  void main() {
    #include <logdepthbuf_fragment>
    if (vVisible < 0.5) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.12, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.35;
    gl_FragColor = vec4(vColor * (0.55 + core), core * 0.95 + halo);
  }
`;

const SIZE_BY_CATEGORY: Record<Category, number> = {
  station: 3.4,
  starlink: 1.0,
  oneweb: 1.0,
  navigation: 1.5,
  weather: 1.4,
  other: 1.0,
  debris: 0.75,
};

export function Satellites() {
  const meta = useStore((s) => s.meta);
  const enabled = useStore((s) => s.enabled);
  const [count, setCount] = useState(0);

  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uDt: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    }),
    [],
  );

  // adopt new snapshots from the worker
  useEffect(() => {
    const apply = () => {
      const n = engine.count;
      if (n !== count) {
        setCount(n); // buffer size changed -> rebuild attributes below
        return;
      }
      const g = geomRef.current;
      if (!g) return;
      const pos = g.getAttribute("position") as THREE.BufferAttribute;
      const vel = g.getAttribute("aVel") as THREE.BufferAttribute;
      (pos.array as Float32Array).set(engine.positions);
      (vel.array as Float32Array).set(engine.velocities);
      pos.needsUpdate = true;
      vel.needsUpdate = true;
      g.computeBoundingSphere();
    };
    engine.onPositions = apply;
    apply();
    return () => {
      engine.onPositions = null;
    };
  }, [count]);

  // static per-satellite attributes (rebuilt when catalog or filters change)
  const staticAttrs = useMemo(() => {
    const n = count;
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const visible = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const m = meta[i];
      const cat: Category = m?.category ?? "other";
      c.set(CATEGORY_COLOR[cat]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = SIZE_BY_CATEGORY[cat];
      visible[i] = enabled[cat] ? 1 : 0;
    }
    engine.visibleMask = visible;
    return { colors, sizes, visible };
  }, [count, meta, enabled]);

  const baseArrays = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    if (engine.positions.length === count * 3) {
      positions.set(engine.positions);
      velocities.set(engine.velocities);
    }
    return { positions, velocities };
  }, [count]);

  useFrame(() => {
    if (matRef.current)
      matRef.current.uniforms.uDt.value = engine.dtSeconds(getSimNow());
  });

  if (count === 0) return null;

  return (
    <points key={count} frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[baseArrays.positions, 3]}
        />
        <bufferAttribute attach="attributes-aVel" args={[baseArrays.velocities, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[staticAttrs.colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[staticAttrs.sizes, 1]} />
        <bufferAttribute
          attach="attributes-aVisible"
          args={[staticAttrs.visible, 1]}
        />
      </bufferGeometry>
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
  );
}
