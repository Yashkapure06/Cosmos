// Sagittarius A* rendered as a real, visitable 3D object. It's a registered
// body (see bodies.ts), so click / double-click / the marker all fly you there
// and the focus system lets you orbit it like a planet. The look is a stylised
// Gargantua (Interstellar): a black event horizon, a hot rotating accretion
// disk with Doppler beaming you see from every angle as you orbit, and a bright
// Einstein/photon ring that billboards to hug the silhouette from any viewpoint
// -- the signature "glowing ring wrapped around a black disc".

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES } from "../lib/bodies";
import { offsetOf } from "./frames";

const R = BODIES.blackhole.radius; // event-horizon radius, scene units
const DISK_INNER = R * 1.28;
const DISK_OUTER = R * 4.3;
const RING_PLANE = R * 2.2; // billboard plane holding the Einstein ring
const GLOW_PLANE = R * 8;

const DISK_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const DISK_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  precision highp float;
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vLocal;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }

  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vLocal);
    float u = (r - uInner) / (uOuter - uInner);
    if (u < 0.0 || u > 1.0) discard;
    float ang = atan(vLocal.y, vLocal.x);

    // keplerian shear: inner material sweeps faster than outer
    float swirl = ang + uTime * (2.1 / (0.22 + u));
    float bands = noise(vec2(swirl * 2.4, u * 7.0)) * 0.6
                + noise(vec2(swirl * 5.5, u * 15.0)) * 0.4;

    // temperature ramp: blue-white hot inner edge -> orange -> deep red
    vec3 hot = vec3(1.0, 0.98, 0.92);
    vec3 mid = vec3(1.0, 0.55, 0.16);
    vec3 cool = vec3(0.5, 0.09, 0.03);
    vec3 col = mix(hot, mid, smoothstep(0.0, 0.35, u));
    col = mix(col, cool, smoothstep(0.35, 1.0, u));

    float bright = (1.0 - smoothstep(0.0, 1.0, u)) * (0.5 + bands * 0.95);
    bright *= smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.82, 1.0, u));

    // relativistic Doppler beaming: the side turning toward us blazes
    float dopp = 0.5 + 0.9 * (0.5 + 0.5 * cos(ang - 1.9));
    col *= bright * dopp * 2.6;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RADIAL_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv - 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// Einstein / photon ring: a bright thin annulus hugging the black silhouette,
// plus a faint Doppler-brightened halo. Billboarded, so it wraps the disc from
// every orbit angle.
const RING_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(vUv) * 2.0;                 // 0 center .. 1 edge
    float ang = atan(vUv.y, vUv.x);
    // sharp photon ring just outside the shadow
    float ring = pow(max(0.0, 1.0 - abs(d - 0.52) * 12.0), 1.6);
    // wider warm halo from lensed disk light, gently Doppler-asymmetric
    float halo = pow(max(0.0, 1.0 - abs(d - 0.58) * 3.2), 2.0);
    halo *= 0.6 + 0.6 * (0.5 + 0.5 * cos(ang - 1.9));
    if (ring + halo < 0.001) discard;
    vec3 col = mix(vec3(1.0, 0.62, 0.28), vec3(1.0, 0.98, 0.92), ring);
    gl_FragColor = vec4(col * (ring * 1.7 + halo * 0.9), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const GLOW_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  precision highp float;
  varying vec2 vUv;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(vUv) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 3.0);
    gl_FragColor = vec4(vec3(1.0, 0.58, 0.24) * a * 0.35, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function BlackHole() {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const diskUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uInner: { value: DISK_INNER }, uOuter: { value: DISK_OUTER } }),
    [],
  );
  const ringUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // fixed world tilt for the accretion-disk plane (you orbit around it)
  const diskQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(1.28, 0.4, 0.0)),
    [],
  );

  useFrame(({ camera, clock }) => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf("blackhole", g.position);
    diskUniforms.uTime.value = clock.elapsedTime;
    ringUniforms.uTime.value = clock.elapsedTime;
    // billboard the ring + glow so they always face the camera
    ringRef.current?.quaternion.copy(camera.quaternion);
    glowRef.current?.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={groupRef}>
      {/* soft outer glow */}
      <mesh ref={glowRef} renderOrder={-8}>
        <planeGeometry args={[GLOW_PLANE * 2, GLOW_PLANE * 2]} />
        <shaderMaterial
          vertexShader={RADIAL_VERT}
          fragmentShader={GLOW_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* event horizon: pure black, occludes the disk behind it */}
      <mesh renderOrder={-7}>
        <sphereGeometry args={[R, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* accretion disk (fixed world orientation) */}
      <mesh quaternion={diskQuat} renderOrder={-6}>
        <ringGeometry args={[DISK_INNER, DISK_OUTER, 200, 8]} />
        <shaderMaterial
          uniforms={diskUniforms}
          vertexShader={DISK_VERT}
          fragmentShader={DISK_FRAG}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Einstein / photon ring, billboarded to hug the silhouette */}
      <mesh ref={ringRef} renderOrder={-5}>
        <planeGeometry args={[RING_PLANE * 2, RING_PLANE * 2]} />
        <shaderMaterial
          uniforms={ringUniforms}
          vertexShader={RADIAL_VERT}
          fragmentShader={RING_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
