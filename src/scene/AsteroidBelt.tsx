import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getSimNow } from "../store/useStore";
import { offsetOf } from "./frames";
import {
  asteroidPositionUnits,
  AU_TO_UNITS,
  generateBelt,
  VARIANTS,
  TEXTURE_COUNT,
  type AsteroidField,
} from "../lib/asteroids";
import { generateAsteroidTextures } from "../lib/asteroidTextures";

const COUNT = 16000;
const REFRESH_MS = 220;
const MESH_GAIN = 4.5;
const BELT_INNER_AU = 2.0;
const BELT_OUTER_AU = 3.5;

const ROCK_TONES = ["#9c8060", "#8a6f52", "#7d6449", "#ad8f68", "#6b5844", "#a17e58"];
const ROCK_COLOR = ROCK_TONES.map((c) => new THREE.Color(c));
const SUNLIT_TINT = new THREE.Color("#ffb066");

function sunlitTint(base: THREE.Color, aUnits: number, aUToAU: number, out: THREE.Color): THREE.Color {
  const auVal = aUnits / aUToAU;
  const t = THREE.MathUtils.clamp((auVal - BELT_INNER_AU) / (BELT_OUTER_AU - BELT_INNER_AU), 0, 1);
  const brightness = THREE.MathUtils.lerp(1.55, 0.62, t);
  const warmth = THREE.MathUtils.lerp(0.55, 0.0, t);
  out.copy(base).lerp(SUNLIT_TINT, warmth).multiplyScalar(brightness);
  return out;
}

function buildRockGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    const bump = 0.68 + rand() * 0.5 + Math.sin(n.x * 6 + seed + n.y * 4) * 0.08;
    v.copy(n).multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const DUST_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uScale;
  uniform float uFadeNear;
  uniform float uFadeFar;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uPixelRatio * uScale / -mv.z;
    gl_PointSize = clamp(px, uMinPx, uMaxPx);
    vFade = smoothstep(uFadeNear, uFadeFar, -mv.z);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const DUST_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uCoreSharp;
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    #include <logdepthbuf_fragment>
    if (vFade <= 0.001) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, uCoreSharp, d);
    gl_FragColor = vec4(vColor * (0.7 + core * 0.5), core * uAlpha * vFade);
  }
`;

export function AsteroidBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.InstancedMesh | null)[][]>([]);
  const dustGeomRef = useRef<THREE.BufferGeometry>(null);
  const glowGeomRef = useRef<THREE.BufferGeometry>(null);
  const lastRefresh = useRef(-Infinity);

  const field: AsteroidField = useMemo(() => generateBelt(COUNT), []);

  const textures = useMemo(() => generateAsteroidTextures(), []);

  const materials = useMemo(
    () =>
      textures.map(
        (t) =>
          new THREE.MeshStandardMaterial({
            map: t,
            roughness: 0.92,
            metalness: 0.04,
          }),
      ),
    [textures],
  );

  const perVariantTexture = useMemo(() => {
    const idx: number[][][] = Array.from({ length: VARIANTS }, () =>
      Array.from({ length: TEXTURE_COUNT }, () => []),
    );
    for (let i = 0; i < field.count; i++) {
      idx[field.variant[i]][field.textureIndex[i]].push(i);
    }
    return idx;
  }, [field]);

  const geometries = useMemo(
    () => Array.from({ length: VARIANTS }, (_, k) => buildRockGeometry(k * 977 + 11)),
    [],
  );

  const dustArrays = useMemo(() => {
    const positions = new Float32Array(field.count * 3);
    const colors = new Float32Array(field.count * 3);
    const sizes = new Float32Array(field.count);
    const tinted = new THREE.Color();
    for (let i = 0; i < field.count; i++) {
      const base = ROCK_COLOR[field.variant[i]];
      sunlitTint(base, field.aUnits[i], AU_TO_UNITS, tinted);
      colors[i * 3] = tinted.r;
      colors[i * 3 + 1] = tinted.g;
      colors[i * 3 + 2] = tinted.b;
      sizes[i] = field.scale[i];
    }
    return { positions, colors, sizes };
  }, [field]);

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const dustUniforms = useMemo(
    () => ({
      uPixelRatio: { value: pixelRatio },
      uMinPx: { value: 1.6 },
      uMaxPx: { value: 6.5 },
      uScale: { value: 4200 },
      uCoreSharp: { value: 0.05 },
      uAlpha: { value: 1.0 },
      uFadeNear: { value: 1.5 },
      uFadeFar: { value: 5.0 },
    }),
    [pixelRatio],
  );
  const glowUniforms = useMemo(
    () => ({
      uPixelRatio: { value: pixelRatio },
      uMinPx: { value: 5.0 },
      uMaxPx: { value: 16.0 },
      uScale: { value: 4200 },
      uCoreSharp: { value: 0.4 },
      uAlpha: { value: 0.22 },
      uFadeNear: { value: 2.5 },
      uFadeFar: { value: 7.0 },
    }),
    [pixelRatio],
  );

  const scratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      axis: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
    }),
    [],
  );

  useFrame(() => {
    if (groupRef.current) offsetOf("sun", groupRef.current.position);

    const now = getSimNow();
    if (Math.abs(now - lastRefresh.current) < REFRESH_MS) return;
    lastRefresh.current = now;

    const { pos, quat, axis, scale, matrix } = scratch;
    const dustPos = dustArrays.positions;

    // update dust positions + all mesh matrices in one pass per asteroid
    for (let v = 0; v < VARIANTS; v++) {
      for (let t = 0; t < TEXTURE_COUNT; t++) {
        const meshes = meshRefs.current[v]?.[t];
        if (!meshes) continue;
        const ids = perVariantTexture[v][t];
        for (let k = 0; k < ids.length; k++) {
          const i = ids[k];
          asteroidPositionUnits(field, i, now, pos);
          dustPos[i * 3] = pos.x;
          dustPos[i * 3 + 1] = pos.y;
          dustPos[i * 3 + 2] = pos.z;

          axis.set(field.spinAxis[i * 3], field.spinAxis[i * 3 + 1], field.spinAxis[i * 3 + 2]);
          quat.setFromAxisAngle(axis, field.spinRate[i] * now);
          scale.setScalar(field.scale[i] * MESH_GAIN);
          matrix.compose(pos, quat, scale);
          meshes.setMatrixAt(k, matrix);
        }
        meshes.instanceMatrix.needsUpdate = true;
      }
    }

    for (const g of [dustGeomRef.current, glowGeomRef.current]) {
      if (g) (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* soft warm haze: same positions, larger/dimmer sprites, additive */}
      <points frustumCulled={false}>
        <bufferGeometry ref={glowGeomRef}>
          <bufferAttribute attach="attributes-position" args={[dustArrays.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[dustArrays.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[dustArrays.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={glowUniforms}
          vertexShader={DUST_VERT}
          fragmentShader={DUST_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* crisp dust points */}
      <points frustumCulled={false}>
        <bufferGeometry ref={dustGeomRef}>
          <bufferAttribute attach="attributes-position" args={[dustArrays.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[dustArrays.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[dustArrays.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={dustUniforms}
          vertexShader={DUST_VERT}
          fragmentShader={DUST_FRAG}
          transparent
          depthWrite={false}
        />
      </points>
      {/* textured rock meshes: one InstancedMesh per (variant × texture) combination */}
      {perVariantTexture.map((texGroups, v) =>
        texGroups.map((ids, t) =>
          ids.length === 0 ? null : (
            <instancedMesh
              key={`${v}-${t}`}
              ref={(m) => {
                if (!meshRefs.current[v]) meshRefs.current[v] = [];
                meshRefs.current[v][t] = m;
              }}
              args={[geometries[v], materials[t], ids.length]}
              frustumCulled={false}
            />
          ),
        ),
      )}
    </group>
  );
}
