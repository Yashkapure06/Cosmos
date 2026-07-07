// The Moon: real geocentric position (astronomy-engine), tidally locked,
// sun-lit with a hint of earthshine, plus a faint orbit path that fades in
// as the camera pulls back into cislunar space.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { getSimNow } from "../store/useStore";
import { sunDirectionScene } from "../lib/sun";
import { moonOrbitPath } from "../lib/ephemeris";
import { BODIES } from "../lib/bodies";
import { frames } from "./frames";

const MOON_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const MOON_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform vec3 uEarthDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vWorldNormal);
    float lit = clamp(dot(N, uSunDir), 0.0, 1.0);
    vec3 albedo = texture2D(uMap, vUv).rgb;
    // earthshine: the night side glows faintly blue toward Earth
    float shine = clamp(dot(N, uEarthDir), 0.0, 1.0) * (1.0 - lit) * 0.05;
    vec3 col = albedo * (0.015 + 1.05 * lit) + albedo * vec3(0.5, 0.65, 1.0) * shine;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Moon() {
  const map = useTexture("/textures/moon_8k.jpg");
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    map.needsUpdate = true;
  }, [map]);

  const meshRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const builtAtRef = useRef(0);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uEarthDir: { value: new THREE.Vector3(-1, 0, 0) },
    }),
    [map],
  );

  const orbitLine = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((128 + 1) * 3), 3),
    );
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#9fb0c8"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geom, mat);
  }, []);

  useFrame(() => {
    const simNow = getSimNow();
    const mesh = meshRef.current;
    if (!mesh) return;

    // position comes from FrameDriver's per-frame moonVec (geocentric; this
    // component sits inside the earth-frame group)
    mesh.position.copy(frames.moonVec);

    // tidal lock: texture prime meridian (+X of the mesh) faces Earth
    const d = frames.moonVec.clone().negate().normalize();
    mesh.rotation.y = Math.atan2(-d.z, d.x);

    const [sx, sy, sz] = sunDirectionScene(simNow);
    uniforms.uSunDir.value.set(sx, sy, sz);
    uniforms.uEarthDir.value.copy(d);

    // orbit path: rebuild when sim time drifts half a day, fade by camera dist
    if (Math.abs(simNow - builtAtRef.current) > 43_200_000) {
      builtAtRef.current = simNow;
      const points = moonOrbitPath(simNow);
      const attr = orbitLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      (attr.array as Float32Array).set(points);
      attr.needsUpdate = true;
      orbitLine.geometry.computeBoundingSphere();
    }
    const t = THREE.MathUtils.smoothstep(frames.cameraDist, 12, 45);
    (orbitLine.material as THREE.LineBasicMaterial).opacity = t * 0.3;
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[BODIES.moon.radius, 96, 96]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={MOON_VERT}
          fragmentShader={MOON_FRAG}
        />
      </mesh>
      <primitive object={orbitLine} ref={lineRef} />
    </>
  );
}
