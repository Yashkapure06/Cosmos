// Soft density haze over the satellite cloud — reads crowded shells at a glance.
// Reuses engine buffers; larger additive sprites, quality-gated.

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { quality } from "../lib/quality";

const VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aVel;
  attribute float aVisible;
  uniform float uDt;
  uniform float uPixelRatio;
  varying float vVisible;
  varying float vAlt;

  void main() {
    vec3 p = position + aVel * uDt;
    vVisible = aVisible;
    vAlt = length(p);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = uPixelRatio * 18.0 / -mv.z;
    gl_PointSize = clamp(size, 4.0, 48.0) * aVisible;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying float vVisible;
  varying float vAlt;

  void main() {
    #include <logdepthbuf_fragment>
    if (vVisible < 0.5) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * 0.08;
    vec3 leo = vec3(1.0, 0.45, 0.15);
    vec3 meo = vec3(0.3, 1.0, 0.55);
    vec3 geo = vec3(0.35, 0.7, 1.0);
    float t = smoothstep(1.05, 1.4, vAlt);
    float t2 = smoothstep(3.5, 6.5, vAlt);
    vec3 col = mix(mix(leo, meo, t), geo, t2);
    gl_FragColor = vec4(col, a);
  }
`;

export function SatHeatmap() {
  const on = useStore((s) => s.showHeatmap);
  const enabled = useStore((s) => s.enabled);
  const meta = useStore((s) => s.meta);
  const [count, setCount] = useState(0);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const lastVer = useRef(-1);

  const uniforms = useMemo(
    () => ({
      uDt: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    }),
    [],
  );

  const attrs = useMemo(() => {
    const n = count;
    const visible = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const cat = meta[i]?.category ?? "other";
      visible[i] = enabled[cat] ? 1 : 0;
    }
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    if (engine.positions.length === n * 3) {
      positions.set(engine.positions);
      velocities.set(engine.velocities);
    }
    return { visible, positions, velocities };
  }, [count, meta, enabled]);

  useFrame(() => {
    if (engine.count !== count) setCount(engine.count);
    if (!on || !matRef.current) return;

    if (engine.version !== lastVer.current && geomRef.current) {
      lastVer.current = engine.version;
      const pos = geomRef.current.getAttribute("position") as THREE.BufferAttribute;
      const vel = geomRef.current.getAttribute("aVel") as THREE.BufferAttribute;
      if (pos && engine.positions.length === pos.count * 3) {
        (pos.array as Float32Array).set(engine.positions);
        (vel.array as Float32Array).set(engine.velocities);
        pos.needsUpdate = true;
        vel.needsUpdate = true;
      }
    }

    matRef.current.uniforms.uDt.value = engine.dtSeconds(getSimNow());
    matRef.current.uniforms.uPixelRatio.value = quality.dpr;
  });

  if (!on || count === 0 || !quality.glow) return null;

  return (
    <points key={`hm-${count}`} frustumCulled={false} renderOrder={-1}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[attrs.positions, 3]} />
        <bufferAttribute attach="attributes-aVel" args={[attrs.velocities, 3]} />
        <bufferAttribute attach="attributes-aVisible" args={[attrs.visible, 1]} />
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
