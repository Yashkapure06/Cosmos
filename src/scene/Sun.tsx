// The Sun: boiling two-layer texture shader, fresnel flare rim, and layered
// additive glow sprites. Real radius (109 Earth radii), real position (origin
// of the heliocentric frame, offset into the current focus frame).

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES } from "../lib/bodies";
import { offsetOf } from "./frames";

const SUN_NOISE = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
          mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
          mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec3(7.31);
      a *= 0.5;
    }
    return v;
  }
`;

const SUN_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uTime;
  uniform float uRadius;
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${"" /* noise for a gently boiling silhouette */}
  __NOISE__

  void main() {
    vLocal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    // slow prominence swell: silhouette breathes instead of staying a circle
    float swell = fbm(vLocal * 5.0 + uTime * 0.05) - 0.5;
    vec3 displaced = position + normal * swell * uRadius * 0.015;

    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const SUN_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;

  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  __NOISE__

  void main() {
    #include <logdepthbuf_fragment>

    // domain-warped fbm on the sphere itself: seamless, flowing plasma
    vec3 p = vLocal * 4.0;
    float t = uTime * 0.085;
    vec3 q = vec3(
      fbm(p + t),
      fbm(p + vec3(5.2, 1.3, 2.8) - t * 0.7),
      fbm(p + vec3(1.7, 9.2, 4.1) + t * 0.4)
    );
    float n = fbm(p * 2.1 + q * 2.2);
    // fine convection cells crawling through the warp field
    float cells = vnoise(p * 14.0 + q * 3.0 + t * 2.0);
    float heat = n * 0.9 + cells * 0.25;

    // magma ramp: dark cell lanes -> molten orange -> white-hot cores
    vec3 col = mix(vec3(0.28, 0.02, 0.0), vec3(0.85, 0.2, 0.005), smoothstep(0.1, 0.45, heat));
    col = mix(col, vec3(1.0, 0.55, 0.04), smoothstep(0.42, 0.68, heat));
    col = mix(col, vec3(1.0, 0.95, 0.7), smoothstep(0.66, 0.95, heat));

    // limb darkening (real photosphere) + a thin burning rim into the corona
    vec3 V = normalize(cameraPosition - vWorldPos);
    float mu = max(dot(normalize(vWorldNormal), V), 0.0);
    col *= 0.4 + 0.6 * pow(mu, 0.55);
    col += vec3(1.0, 0.45, 0.1) * pow(1.0 - mu, 5.0) * 1.5;

    gl_FragColor = vec4(col * 1.5, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Radial glow with a transparent hole where the disc sits, so the additive
 * sprites halo the Sun without washing out the granulation shader.
 * holeFrac = disc radius as a fraction of the sprite half-size.
 */
function makeGlowTexture(holeFrac: number): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const h = Math.max(0, holeFrac - 0.03);
  grad.addColorStop(0, "rgba(255, 200, 120, 0)");
  grad.addColorStop(h, "rgba(255, 200, 120, 0)");
  grad.addColorStop(Math.min(1, holeFrac + 0.05), "rgba(255, 190, 90, 0.85)");
  grad.addColorStop(Math.min(1, holeFrac + 0.25), "rgba(255, 130, 35, 0.28)");
  grad.addColorStop(1, "rgba(255, 90, 20, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// flame fringe: transparent shell whose fbm alpha only survives at the limb,
// so tongues of fire dance around the silhouette
const FLARE_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vLocal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const FLARE_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;

  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  __NOISE__

  void main() {
    #include <logdepthbuf_fragment>
    vec3 V = normalize(cameraPosition - vWorldPos);
    float mu = abs(dot(normalize(vWorldNormal), V));
    // only the grazing band survives -> flames hug the silhouette
    float limb = pow(1.0 - mu, 3.0);

    float t = uTime * 0.22;
    float n = fbm(vLocal * 7.0 + vec3(0.0, t, t * 0.6));
    n = pow(smoothstep(0.35, 0.85, n), 1.6);

    vec3 col = mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.72, 0.2), n);
    gl_FragColor = vec4(col * 2.0, n * limb * 0.85);
    #include <tonemapping_fragment>
  }
`;

// prominence arcs: half-buried tori whose flame intensity erupts and dies
const PROM_VERT = FLARE_VERT;

const PROM_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSeed;

  varying vec3 vLocal;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  __NOISE__

  void main() {
    #include <logdepthbuf_fragment>
    float t = uTime * 0.35;
    float n = fbm(vLocal * 9.0 + uSeed + vec3(t, -t * 0.7, t * 0.4));
    float body = smoothstep(0.28, 0.75, n);
    vec3 col = mix(vec3(0.9, 0.12, 0.01), vec3(1.0, 0.6, 0.12), body);
    gl_FragColor = vec4(col * 2.4, body * uIntensity);
    #include <tonemapping_fragment>
  }
`;

const VERT_FINAL = SUN_VERT.replace("__NOISE__", SUN_NOISE);
const FRAG_FINAL = SUN_FRAG.replace("__NOISE__", SUN_NOISE);
const FLARE_VERT_FINAL = FLARE_VERT;
const FLARE_FRAG_FINAL = FLARE_FRAG.replace("__NOISE__", SUN_NOISE);
const PROM_VERT_FINAL = PROM_VERT;
const PROM_FRAG_FINAL = PROM_FRAG.replace("__NOISE__", SUN_NOISE);

// fixed eruption sites (unit directions) + cycle phases
const PROMINENCES = [
  { dir: new THREE.Vector3(1, 0.3, 0.2), phase: 0.0, speed: 0.11 },
  { dir: new THREE.Vector3(-0.6, 0.5, 0.8), phase: 2.1, speed: 0.16 },
  { dir: new THREE.Vector3(0.2, -0.8, 0.6), phase: 4.2, speed: 0.09 },
  { dir: new THREE.Vector3(-0.8, -0.3, -0.6), phase: 1.3, speed: 0.13 },
  { dir: new THREE.Vector3(0.3, 0.75, -0.7), phase: 3.4, speed: 0.19 },
].map((p) => ({ ...p, dir: p.dir.normalize() }));

export function Sun() {
  const groupRef = useRef<THREE.Group>(null);
  const coronaRef = useRef<THREE.Sprite>(null);
  const haloTex = useMemo(() => makeGlowTexture(2 / 5), []);
  const coronaTex = useMemo(() => makeGlowTexture(2 / 13), []);
  const radius = BODIES.sun.radius;

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRadius: { value: radius } }),
    [radius],
  );

  const flareUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const prominences = useMemo(
    () =>
      PROMINENCES.map((p, i) => ({
        ...p,
        quat: new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          p.dir,
        ),
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uSeed: { value: i * 13.7 },
        },
        meshRef: { current: null as THREE.Mesh | null },
      })),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;
    flareUniforms.uTime.value = t;
    if (groupRef.current) offsetOf("sun", groupRef.current.position);
    if (coronaRef.current) {
      const pulse = 1 + Math.sin(t * 0.6) * 0.035;
      coronaRef.current.scale.setScalar(radius * 13 * pulse);
    }
    // eruption cycles: each prominence swells, arcs over, and collapses
    for (const p of prominences) {
      const wave = Math.sin(t * p.speed * 2 * Math.PI + p.phase);
      const intensity = Math.pow(Math.max(wave, 0), 2.5);
      p.uniforms.uIntensity.value = intensity;
      const m = p.meshRef.current;
      if (m) {
        m.visible = intensity > 0.02;
        m.scale.setScalar(0.65 + intensity * 0.75);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 128, 128]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={VERT_FINAL}
          fragmentShader={FRAG_FINAL}
        />
      </mesh>
      {/* flame fringe dancing on the silhouette */}
      <mesh>
        <sphereGeometry args={[radius * 1.09, 96, 96]} />
        <shaderMaterial
          uniforms={flareUniforms}
          vertexShader={FLARE_VERT_FINAL}
          fragmentShader={FLARE_FRAG_FINAL}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* erupting prominence arcs, half-buried in the photosphere */}
      {prominences.map((p, i) => (
        <group key={i} position={p.dir.clone().multiplyScalar(radius)} quaternion={p.quat}>
          <mesh ref={(el) => (p.meshRef.current = el)}>
            <torusGeometry args={[radius * 0.26, radius * 0.05, 20, 72]} />
            <shaderMaterial
              uniforms={p.uniforms}
              vertexShader={PROM_VERT_FINAL}
              fragmentShader={PROM_FRAG_FINAL}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
      {/* inner halo */}
      <sprite scale={[radius * 5, radius * 5, 1]}>
        <spriteMaterial
          map={haloTex}
          color="#ffc36b"
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {/* breathing corona */}
      <sprite ref={coronaRef}>
        <spriteMaterial
          map={coronaTex}
          color="#ff9a2e"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}
