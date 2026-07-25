// Io volcanic plumes + Enceladus south-pole jets. Activate when focused
// (or camera close). GPU point streams — cheap and readable.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES, type BodyId } from "../lib/bodies";
import { useStore } from "../store/useStore";
import { offsetOf } from "./frames";
import { quality } from "../lib/quality";

const N = 900;

const VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSeed;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uColor;
  varying float vFade;
  varying vec3 vColor;

  void main() {
    vColor = uColor;
    float life = fract(aSeed + uTime * aSpeed);
    vec3 p = position * life;
    // slight lateral spread as it rises
    p.x += sin(aSeed * 40.0 + uTime) * life * length(position) * 0.12;
    p.z += cos(aSeed * 30.0 + uTime) * life * length(position) * 0.12;
    vFade = (1.0 - life) * smoothstep(0.0, 0.12, life);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((2.5 + (1.0 - life) * 6.0) * uPixelRatio * 40.0 / -mv.z, 1.0, 18.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying float vFade;
  varying vec3 vColor;

  void main() {
    #include <logdepthbuf_fragment>
    if (vFade < 0.01) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d) * vFade;
    gl_FragColor = vec4(vColor, a);
  }
`;

function JetField({
  body,
  color,
  southOnly,
  height,
}: {
  body: BodyId;
  color: string;
  southOnly: boolean;
  height: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const focus = useStore((s) => s.focus);

  const { positions, seeds, speeds } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    const speeds = new Float32Array(N);
    const r = BODIES[body].radius;
    let s = body.length * 999;
    const rand = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < N; i++) {
      let lat: number;
      let lon: number;
      if (southOnly) {
        lat = -Math.PI / 2 + rand() * 0.35;
        lon = rand() * Math.PI * 2;
      } else {
        // Io: clustered hot spots
        const spot = Math.floor(rand() * 5);
        lat = (spot * 0.4 - 0.8) + (rand() - 0.5) * 0.25;
        lon = spot * 1.2 + rand() * 0.4;
      }
      const dir = new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        -Math.cos(lat) * Math.sin(lon),
      );
      const tip = dir.multiplyScalar(r + height * (0.55 + rand() * 0.45));
      positions[i * 3] = tip.x;
      positions[i * 3 + 1] = tip.y;
      positions[i * 3 + 2] = tip.z;
      seeds[i] = rand();
      speeds[i] = 0.15 + rand() * 0.35;
    }
    return { positions, seeds, speeds };
  }, [body, height, southOnly]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColor: { value: new THREE.Color(color) },
    }),
    [color],
  );

  useFrame(({ clock, camera }) => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf(body, g.position);
    const dist = camera.position.distanceTo(g.position);
    const active =
      quality.glow &&
      (focus === body || dist < BODIES[body].radius * 40);
    g.visible = active;
    if (!active) return;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uPixelRatio.value = quality.dpr;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
          <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
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
    </group>
  );
}

export function MoonJets() {
  return (
    <>
      <JetField body="io" color="#ff6a2a" southOnly={false} height={BODIES.io.radius * 2.2} />
      <JetField
        body="enceladus"
        color="#a8e8ff"
        southOnly
        height={BODIES.enceladus.radius * 8}
      />
    </>
  );
}
