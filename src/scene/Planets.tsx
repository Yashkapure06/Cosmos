// Every solar-system body except Earth (custom shader), the Moon (custom) and
// the Sun (custom): planets and their moons, sun-lit, axially tilted by real
// pole directions, spinning at real rates. Saturn gets its ring system with
// an analytic planet shadow.

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  BODIES,
  BODY_IDS,
  type BodyDef,
  type BodyId,
} from "../lib/bodies";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { poleVectorScene } from "../lib/ephemeris";
import { getSimNow } from "../store/useStore";
import { helio, offsetOf } from "./frames";

const BODY_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const BODY_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform vec3 uRimColor;
  uniform float uRimStrength;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vWorldNormal);
    float lit = clamp(dot(N, uSunDir), 0.0, 1.0);
    vec3 albedo = mix(uColor, texture2D(uMap, vUv).rgb, uHasMap);
    vec3 col = albedo * (0.02 + 1.08 * lit);

    // soft limb tint (atmosphere haze on the day side)
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    col += uRimColor * fres * uRimStrength * (0.15 + 0.85 * lit);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RING_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vLocal;

  void main() {
    vLocal = position; // ring plane local coords, planet at origin
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const RING_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uRingMap;
  uniform float uInner;
  uniform float uOuter;
  uniform vec3 uSunDirLocal;
  uniform float uPlanetRadius;

  varying vec3 vLocal;

  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vLocal.xy);
    float u = (r - uInner) / (uOuter - uInner);
    if (u < 0.0 || u > 1.0) discard;
    vec4 strip = texture2D(uRingMap, vec2(u, 0.5));

    // front-lit + translucent back-lit
    float nDotS = uSunDirLocal.z;
    float lit = 0.08 + 0.92 * max(nDotS, 0.0) + 0.4 * max(-nDotS, 0.0);

    // analytic planet shadow across the ring plane
    vec3 toSun = uSunDirLocal;
    float t = dot(-vLocal, toSun);
    vec3 closest = -vLocal - t * toSun;
    float shadow = 1.0;
    if (t > 0.0 && length(closest) < uPlanetRadius) shadow = 0.06;

    vec3 col = strip.rgb * lit * shadow;
    gl_FragColor = vec4(col, strip.a * 0.96);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const HOURS_TO_MS = 3_600_000;

function BodyMesh({ def }: { def: BodyDef }) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Mesh>(null);
  const ringUniformsRef = useRef<{
    uSunDirLocal: { value: THREE.Vector3 };
  } | null>(null);

  const map = useTexture(def.texture ? `/textures/${def.texture}` : "/textures/2k_uranus.jpg");
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    map.needsUpdate = true;
  }, [map]);

  const tiltQuat = useMemo(() => {
    const pole = poleVectorScene(def.poleRaDeg ?? 0, def.poleDecDeg ?? 90, new THREE.Vector3());
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
  }, [def]);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uHasMap: { value: def.texture ? 1 : 0 },
      uColor: { value: new THREE.Color(def.color) },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uRimColor: { value: new THREE.Color(def.rim ?? "#ffffff") },
      uRimStrength: { value: def.rim ? 0.55 : 0.12 },
    }),
    [map, def],
  );

  const ring = useMemo(() => {
    if (!def.ringed) return null;
    const inner = (74658 / EARTH_RADIUS_KM) * 1; // Saturn C ring, km -> units
    const outer = 136775 / EARTH_RADIUS_KM;
    return { inner, outer };
  }, [def]);

  const ringMap = useTexture(def.ringed ? "/textures/8k_saturn_ring_alpha.png" : "/textures/2k_uranus.jpg");
  const ringUniforms = useMemo(() => {
    if (!ring) return null;
    ringMap.colorSpace = THREE.SRGBColorSpace;
    ringMap.needsUpdate = true;
    const u = {
      uRingMap: { value: ringMap },
      uInner: { value: ring.inner },
      uOuter: { value: ring.outer },
      uSunDirLocal: { value: new THREE.Vector3(0, 0, 1) },
      uPlanetRadius: { value: def.radius },
    };
    ringUniformsRef.current = u;
    return u;
  }, [ring, ringMap, def]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf(def.id, g.position);

    // direction to the Sun is frame-independent (pure translation frames)
    uniforms.uSunDir.value.copy(helio.pos[def.id]).multiplyScalar(-1).normalize();

    if (spinRef.current && def.rotationHours) {
      spinRef.current.rotation.y =
        (getSimNow() / (def.rotationHours * HOURS_TO_MS)) * Math.PI * 2;
    }

    const ru = ringUniformsRef.current;
    if (ru) {
      // sun direction in ring-local space (ring plane = planet equator)
      ru.uSunDirLocal.value
        .copy(uniforms.uSunDir.value)
        .applyQuaternion(_invQuat.copy(tiltQuat).invert())
        .applyQuaternion(_ringFix);
    }
  });

  return (
    <group ref={groupRef}>
      <group quaternion={tiltQuat}>
        <mesh ref={spinRef}>
          <sphereGeometry args={[def.radius, 64, 64]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={BODY_VERT}
            fragmentShader={BODY_FRAG}
          />
        </mesh>
        {ring && ringUniforms && (
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[ring.inner, ring.outer, 256, 4]} />
            <shaderMaterial
              uniforms={ringUniforms}
              vertexShader={RING_VERT}
              fragmentShader={RING_FRAG}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

const _invQuat = new THREE.Quaternion();
// ring mesh is rotated -90deg about X so its plane normal (+Z local) matches +Y
const _ringFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

const RENDERED: BodyId[] = BODY_IDS.filter(
  (id) =>
    id !== "earth" &&
    id !== "moon" &&
    id !== "sun" &&
    BODIES[id].type !== "craft" &&
    BODIES[id].type !== "asteroid" && // asteroids get their own rock renderer
    BODIES[id].type !== "blackhole", // black hole has its own renderer
);

export function Planets() {
  return (
    <Suspense fallback={null}>
      {RENDERED.map((id) => (
        <BodyMesh key={id} def={BODIES[id]} />
      ))}
    </Suspense>
  );
}
