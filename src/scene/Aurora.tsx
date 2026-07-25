// Earth aurora oval — green/magenta curtains on the night side.
// Cheap shell shader; only draws when camera is near Earth.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getSimNow } from "../store/useStore";
import { sunDirectionScene } from "../lib/sun";
import { gstime } from "satellite.js";
import { quality } from "../lib/quality";
import { frames } from "./frames";

const VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uIntensity;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormal);
    float night = smoothstep(0.15, -0.25, dot(N, uSunDir));

    // magnetic latitude proxy from local Y (Earth-aligned)
    float lat = asin(clamp(N.y, -1.0, 1.0));
    float ovalN = exp(-pow((lat - 1.05) / 0.18, 2.0));
    float ovalS = exp(-pow((lat + 1.05) / 0.18, 2.0));
    float oval = max(ovalN, ovalS);

    float lon = atan(N.x, N.z);
    float curtain = 0.55 + 0.45 * sin(lon * 14.0 + uTime * 1.7 + lat * 6.0);
    curtain *= 0.6 + 0.4 * sin(lon * 31.0 - uTime * 2.3);

    float a = night * oval * curtain * uIntensity;
    if (a < 0.01) discard;

    vec3 green = vec3(0.25, 1.0, 0.45);
    vec3 magenta = vec3(0.85, 0.25, 1.0);
    vec3 col = mix(green, magenta, smoothstep(0.9, 1.15, abs(lat)));
    // height shimmer
    col += vec3(0.15, 0.4, 0.2) * (0.5 + 0.5 * sin(uTime * 3.0 + lon * 8.0));

    gl_FragColor = vec4(col, a * 0.55);
    #include <tonemapping_fragment>
  }
`;

export function Aurora() {
  const meshRef = useRef<THREE.Mesh>(null);
  const sunU = useMemo(() => ({ value: new THREE.Vector3(1, 0, 0) }), []);
  const uniforms = useMemo(
    () => ({
      uSunDir: sunU,
      uTime: { value: 0 },
      uIntensity: { value: 1 },
    }),
    [sunU],
  );

  useFrame(({ clock, camera }) => {
    const sim = getSimNow();
    const [sx, sy, sz] = sunDirectionScene(sim);
    sunU.value.set(sx, sy, sz);
    uniforms.uTime.value = clock.elapsedTime;

    const dist = camera.position.distanceTo(frames.earthOffset);
    const near = dist < 25 && quality.glow;
    if (meshRef.current) {
      meshRef.current.visible = near;
      meshRef.current.rotation.y = gstime(new Date(sim));
      uniforms.uIntensity.value = THREE.MathUtils.smoothstep(dist, 25, 4);
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1.055, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
