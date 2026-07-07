// Photoreal Earth: day/night blend, ocean specular, normal-mapped relief,
// drifting cloud shell, fresnel atmosphere. All driven by the true sun vector.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { gstime } from "satellite.js";
import { getSimNow } from "../store/useStore";
import { sunDirectionScene } from "../lib/sun";

const EARTH_VERT = /* glsl */ `
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

const EARTH_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecMap;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vWorldNormal);

    // analytic tangent frame for a sphere (east / north)
    vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
    vec3 B = cross(N, T);
    vec3 nmap = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    vec3 Np = normalize(T * nmap.x + B * nmap.y + N * (nmap.z * 3.0));

    float geoSun = dot(N, uSunDir);
    float dayF = smoothstep(-0.12, 0.18, geoSun);
    float litF = clamp(dot(Np, uSunDir), 0.0, 1.0);

    vec3 day = texture2D(uDayMap, vUv).rgb * (0.06 + 1.15 * litF);

    vec3 night = texture2D(uNightMap, vUv).rgb;
    night = pow(night, vec3(1.35));
    night *= vec3(1.0, 0.82, 0.55) * 2.1; // warm sodium city glow

    vec3 col = mix(night, day, dayF);

    // ocean sun glint
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(uSunDir + V);
    float oceanMask = texture2D(uSpecMap, vUv).r;
    float spec = pow(max(dot(Np, H), 0.0), 90.0) * oceanMask;
    col += spec * vec3(1.0, 0.95, 0.85) * dayF * 0.9;

    // atmospheric rim scattering (on-surface)
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 rim = vec3(0.30, 0.55, 1.0) * fres * (0.18 + 0.9 * dayF);
    col += rim * 0.55;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_VERT = EARTH_VERT;

const CLOUD_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vWorldNormal);
    float density = texture2D(uCloudMap, vUv).r;
    float dayF = smoothstep(-0.1, 0.2, dot(N, uSunDir));
    float lit = clamp(dot(N, uSunDir), 0.0, 1.0);

    vec3 col = mix(vec3(0.06, 0.07, 0.1), vec3(1.0), 0.12 + 0.88 * lit);
    float alpha = density * (0.12 + 0.88 * dayF);

    // thin out clouds at the limb so the silhouette stays crisp
    vec3 V = normalize(cameraPosition - vWorldPos);
    alpha *= smoothstep(0.0, 0.25, dot(N, V));

    gl_FragColor = vec4(col, alpha * 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMO_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const ATMO_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSunDir;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vWorldNormal); // BackSide: points away from camera side
    vec3 V = normalize(cameraPosition - vWorldPos);
    float rim = pow(clamp(dot(N, V) + 1.08, 0.0, 1.1), 5.0);
    float dayF = 0.25 + 0.75 * smoothstep(-0.3, 0.4, dot(normalize(vWorldPos), uSunDir));
    vec3 col = mix(vec3(0.05, 0.12, 0.35), vec3(0.25, 0.55, 1.0), dayF);
    gl_FragColor = vec4(col, 1.0) * rim * dayF * 1.4;
    #include <tonemapping_fragment>
  }
`;

export function Earth() {
  const [dayMap, nightMap, cloudMap, normalMap, specMap] = useTexture([
    "/textures/earth_day_8k.jpg",
    "/textures/earth_night_8k.jpg",
    "/textures/earth_clouds_8k.jpg",
    "/textures/earth_normal_2k.jpg",
    "/textures/earth_specular_2k.jpg",
  ]);

  useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    for (const t of [dayMap, nightMap, cloudMap, normalMap, specMap]) {
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
  }, [dayMap, nightMap, cloudMap, normalMap, specMap]);

  const earthRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  const sunUniform = useMemo(() => ({ value: new THREE.Vector3(1, 0, 0) }), []);

  const earthUniforms = useMemo(
    () => ({
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uNormalMap: { value: normalMap },
      uSpecMap: { value: specMap },
      uSunDir: sunUniform,
    }),
    [dayMap, nightMap, normalMap, specMap, sunUniform],
  );

  const cloudUniforms = useMemo(
    () => ({ uCloudMap: { value: cloudMap }, uSunDir: sunUniform }),
    [cloudMap, sunUniform],
  );

  const atmoUniforms = useMemo(() => ({ uSunDir: sunUniform }), [sunUniform]);

  useFrame(() => {
    const simNow = getSimNow();
    const [sx, sy, sz] = sunDirectionScene(simNow);
    sunUniform.value.set(sx, sy, sz);

    const gmst = gstime(new Date(simNow));
    if (earthRef.current) earthRef.current.rotation.y = gmst;
    // clouds share Earth's rotation plus a slow westerly drift
    if (cloudRef.current)
      cloudRef.current.rotation.y = gmst + (simNow / 1000) * 0.0000105;
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          uniforms={earthUniforms}
          vertexShader={EARTH_VERT}
          fragmentShader={EARTH_FRAG}
        />
      </mesh>

      <mesh ref={cloudRef}>
        <sphereGeometry args={[1.006, 96, 96]} />
        <shaderMaterial
          uniforms={cloudUniforms}
          vertexShader={CLOUD_VERT}
          fragmentShader={CLOUD_FRAG}
          transparent
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.045, 96, 96]} />
        <shaderMaterial
          uniforms={atmoUniforms}
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
