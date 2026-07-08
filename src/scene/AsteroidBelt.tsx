import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { getSimNow } from "../store/useStore";
import { helio, frames, offsetOf } from "./frames";
import {
  asteroidPositionUnits,
  AU_TO_UNITS,
  generateBelt,
  VARIANTS,
  TEXTURE_COUNT,
  type AsteroidField,
} from "../lib/asteroids";

// Real photographic rock surfaces (CC0, Poly Haven), the same "load a real
// texture and mould the body around it" approach the planets use. One set per
// TEXTURE_COUNT slot: 0-1 + 7-9 are the darker carbonaceous rocks, 2-6 the
// brighter stony ones, which matches the inner-stony / outer-carbonaceous
// gradient that asteroids.ts assigns by orbital distance.
const ROCK_MAPS = Array.from({ length: TEXTURE_COUNT }, (_, i) => {
  const p = `/textures/asteroids/ast${String(i).padStart(2, "0")}`;
  return [`${p}_diff.jpg`, `${p}_nor.jpg`, `${p}_rough.jpg`];
}).flat();

const COUNT = 30000;
const REFRESH_MS = 220;
const MESH_GAIN = 8;

// Local debris field: a dense clump of chunky 3D boulders + fine dust that
// follows the camera (world-lattice wrapped so it still parallaxes as you fly)
// and only switches on when you're actually inside the belt torus. This is what
// makes standing in the belt look like the reference renders -- rocks all
// around you -- rather than a thin sprinkle of distant specks.
const LOCAL_PTS = 7000;
const LOCAL_H = 44; // half-extent of the field around the camera, scene units
const LOCAL_CELL = LOCAL_H * 2;
const LOCAL_BOULDERS = 34; // per texture slot
const BOULDER_TEX = [2, 3, 8]; // stony grey, tan, dark terrain
const BELT_LO_AU = 1.85;
const BELT_HI_AU = 3.8;
const BELT_INNER_AU = 2.0;
const BELT_OUTER_AU = 3.5;

// muted rocky greys/browns rather than saturated ochre, so the field reads as
// stone dust instead of a cloud of red dots
const ROCK_TONES = ["#8f8377", "#7d7266", "#6f665b", "#9a8d7d", "#5f574d", "#8a7d6b"];
const ROCK_COLOR = ROCK_TONES.map((c) => new THREE.Color(c));
const SUNLIT_TINT = new THREE.Color("#e8c9a0");

function sunlitTint(base: THREE.Color, aUnits: number, aUToAU: number, out: THREE.Color): THREE.Color {
  const auVal = aUnits / aUToAU;
  const t = THREE.MathUtils.clamp((auVal - BELT_INNER_AU) / (BELT_OUTER_AU - BELT_INNER_AU), 0, 1);
  const brightness = THREE.MathUtils.lerp(1.2, 0.55, t);
  const warmth = THREE.MathUtils.lerp(0.3, 0.0, t);
  out.copy(base).lerp(SUNLIT_TINT, warmth).multiplyScalar(brightness);
  return out;
}

function buildRockGeometry(seed: number): THREE.BufferGeometry {
  // subdivision 2 gives a craggier silhouette than 1 while staying cheap enough
  // to instance thousands of times; per-vertex normal maps add the fine detail.
  const geo = new THREE.IcosahedronGeometry(1, 2);
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
  // three random axis phases so lobes don't line up on the cardinal axes
  const px = rand() * 6.28;
  const py = rand() * 6.28;
  const pz = rand() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    // large asymmetric lobes (overall chunky shape) + mid ridges + fine grit
    const lobe =
      Math.sin(n.x * 2.3 + px) * Math.cos(n.y * 1.9 + py) * 0.22 +
      Math.sin(n.z * 2.7 + pz) * 0.16;
    const ridge = Math.sin(n.x * 6 + seed + n.y * 5) * 0.09 + Math.cos(n.z * 7 - seed) * 0.07;
    const grit = (rand() - 0.5) * 0.13;
    const bump = 0.82 + lobe + ridge + grit;
    v.copy(n).multiplyScalar(Math.max(0.5, bump));
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

// each point is shaded as a tiny lit sphere (a fake hemisphere normal from the
// sprite coords), so at the zoom levels where the real meshes are sub-pixel the
// belt still reads as a field of countless little sunlit STONES, not flat dots
const PEBBLE_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vFade;

  const vec3 L = normalize(vec3(-0.35, 0.55, 0.78)); // fixed key light, upper-left

  void main() {
    #include <logdepthbuf_fragment>
    if (vFade <= 0.001) discard;
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float z = sqrt(1.0 - r2);
    vec3 N = vec3(c.x, -c.y, z);           // hemisphere facing the camera
    float lit = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0); // wrapped lambert
    // subtle terminator + tiny rim so the pebble reads round, not a flat disc
    vec3 col = vColor * (0.18 + 1.05 * lit * lit);
    float a = smoothstep(1.0, 0.5, r2) * uAlpha * vFade;
    gl_FragColor = vec4(col, a);
  }
`;

// faint soft haze reused for the "little bit of dust" glow between the rocks
const HAZE_FRAG = /* glsl */ `
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

function rngFrom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dense rock field that rides along with the camera (wrapped to a world lattice
// so it still parallaxes) and only appears while you're inside the belt torus.
function LocalDebris({ materials }: { materials: THREE.MeshStandardMaterial[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const ptsGeomRef = useRef<THREE.BufferGeometry>(null);
  const boulderRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const pts = useMemo(() => {
    const base = new Float32Array(LOCAL_PTS * 3);
    const positions = new Float32Array(LOCAL_PTS * 3);
    const colors = new Float32Array(LOCAL_PTS * 3);
    const sizes = new Float32Array(LOCAL_PTS);
    const rand = rngFrom(0x51ed2701);
    for (let i = 0; i < LOCAL_PTS; i++) {
      base[i * 3] = rand() * LOCAL_CELL;
      base[i * 3 + 1] = rand() * LOCAL_CELL;
      base[i * 3 + 2] = rand() * LOCAL_CELL;
      const b = 0.42 + rand() * 0.5;
      const warm = rand() * 0.08;
      colors[i * 3] = b;
      colors[i * 3 + 1] = b * (0.93 - warm);
      colors[i * 3 + 2] = b * (0.84 - warm * 2);
      const r = rand();
      sizes[i] = r < 0.72 ? 0.002 + rand() * 0.012 : r < 0.94 ? 0.015 + rand() * 0.045 : 0.06 + rand() * 0.12;
    }
    return { base, positions, colors, sizes };
  }, []);

  const uniforms = useMemo(
    () => ({
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uMinPx: { value: 1.5 },
      uMaxPx: { value: 22.0 },
      uScale: { value: 5200 },
      uAlpha: { value: 1.0 },
      uFadeNear: { value: 1.0 },
      uFadeFar: { value: 5.0 },
    }),
    [],
  );

  const boulderGeom = useMemo(() => buildRockGeometry(4242), []);

  const boulders = useMemo(() => {
    const rand = rngFrom(0x1234abcd);
    return BOULDER_TEX.map(() => {
      const base = new Float32Array(LOCAL_BOULDERS * 3);
      const scale = new Float32Array(LOCAL_BOULDERS);
      const axis = new Float32Array(LOCAL_BOULDERS * 3);
      const rate = new Float32Array(LOCAL_BOULDERS);
      const phase = new Float32Array(LOCAL_BOULDERS);
      const ax = new THREE.Vector3();
      for (let i = 0; i < LOCAL_BOULDERS; i++) {
        base[i * 3] = rand() * LOCAL_CELL;
        base[i * 3 + 1] = rand() * LOCAL_CELL;
        base[i * 3 + 2] = rand() * LOCAL_CELL;
        const r = rand();
        scale[i] = r < 0.6 ? 0.08 + rand() * 0.25 : r < 0.9 ? 0.35 + rand() * 0.8 : 1.2 + rand() * 1.8;
        ax.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
        axis[i * 3] = ax.x;
        axis[i * 3 + 1] = ax.y;
        axis[i * 3 + 2] = ax.z;
        rate[i] = (rand() * 2 - 1) * 0.15;
        phase[i] = rand() * 6.283;
      }
      return { base, scale, axis, rate, phase };
    });
  }, []);

  const s = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      cam: new THREE.Vector3(),
      camHelio: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      ax: new THREE.Vector3(),
      sc: new THREE.Vector3(),
      m: new THREE.Matrix4(),
    }),
    [],
  );

  useFrame(({ camera, clock }) => {
    const g = groupRef.current;
    if (!g) return;

    // belt gate: how far is the camera from the Sun, in AU
    const au = s.camHelio.copy(camera.position).add(helio.pos[frames.focus]).length() / AU_TO_UNITS;
    const bf = THREE.MathUtils.clamp(
      Math.min(
        THREE.MathUtils.smoothstep(au, BELT_LO_AU, BELT_LO_AU + 0.25),
        1 - THREE.MathUtils.smoothstep(au, BELT_HI_AU - 0.35, BELT_HI_AU),
      ),
      0,
      1,
    );
    g.visible = bf > 0.002;
    if (!g.visible) return;

    const cam = s.cam.copy(camera.position);
    const t = clock.elapsedTime;

    // wrap the dust points to the lattice copy nearest the camera
    const b = pts.base;
    const p = pts.positions;
    for (let i = 0; i < LOCAL_PTS; i++) {
      const j = i * 3;
      p[j] = b[j] + Math.round((cam.x - b[j]) / LOCAL_CELL) * LOCAL_CELL;
      p[j + 1] = b[j + 1] + Math.round((cam.y - b[j + 1]) / LOCAL_CELL) * LOCAL_CELL;
      p[j + 2] = b[j + 2] + Math.round((cam.z - b[j + 2]) / LOCAL_CELL) * LOCAL_CELL;
    }
    if (ptsGeomRef.current)
      (ptsGeomRef.current.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    uniforms.uAlpha.value = bf;

    // wrap + fade + tumble the chunky boulders
    for (let gi = 0; gi < BOULDER_TEX.length; gi++) {
      const mesh = boulderRefs.current[gi];
      if (!mesh) continue;
      const bd = boulders[gi];
      for (let i = 0; i < LOCAL_BOULDERS; i++) {
        const j = i * 3;
        const wx = bd.base[j] + Math.round((cam.x - bd.base[j]) / LOCAL_CELL) * LOCAL_CELL;
        const wy = bd.base[j + 1] + Math.round((cam.y - bd.base[j + 1]) / LOCAL_CELL) * LOCAL_CELL;
        const wz = bd.base[j + 2] + Math.round((cam.z - bd.base[j + 2]) / LOCAL_CELL) * LOCAL_CELL;
        s.pos.set(wx, wy, wz);
        const dist = s.pos.distanceTo(cam);
        const fade = 1 - THREE.MathUtils.smoothstep(dist, LOCAL_H * 0.6, LOCAL_H);
        s.ax.set(bd.axis[j], bd.axis[j + 1], bd.axis[j + 2]);
        s.q.setFromAxisAngle(s.ax, bd.phase[i] + bd.rate[i] * t);
        s.sc.setScalar(Math.max(1e-4, bd.scale[i] * fade * bf));
        s.m.compose(s.pos, s.q, s.sc);
        mesh.setMatrixAt(i, s.m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <points frustumCulled={false}>
        <bufferGeometry ref={ptsGeomRef}>
          <bufferAttribute attach="attributes-position" args={[pts.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[pts.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[pts.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={DUST_VERT}
          fragmentShader={PEBBLE_FRAG}
          transparent
          depthWrite={false}
        />
      </points>
      {BOULDER_TEX.map((ti, gi) => (
        <instancedMesh
          key={gi}
          ref={(m) => {
            boulderRefs.current[gi] = m;
          }}
          args={[boulderGeom, materials[ti], LOCAL_BOULDERS]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

export function AsteroidBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.InstancedMesh | null)[][]>([]);
  const dustGeomRef = useRef<THREE.BufferGeometry>(null);
  const glowGeomRef = useRef<THREE.BufferGeometry>(null);
  const lastRefresh = useRef(-Infinity);

  const field: AsteroidField = useMemo(() => generateBelt(COUNT), []);

  const loaded = useTexture(ROCK_MAPS);

  const materials = useMemo(() => {
    const mats: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < TEXTURE_COUNT; i++) {
      const diff = loaded[i * 3];
      const nor = loaded[i * 3 + 1];
      const rough = loaded[i * 3 + 2];
      diff.colorSpace = THREE.SRGBColorSpace;
      nor.colorSpace = THREE.NoColorSpace;
      rough.colorSpace = THREE.NoColorSpace;
      for (const t of [diff, nor, rough]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 4;
        t.needsUpdate = true;
      }
      mats.push(
        new THREE.MeshStandardMaterial({
          map: diff,
          // real photographed surface relief -> the sun light rakes across it
          // exactly like it does on the planet maps, giving true stone
          normalMap: nor,
          normalScale: new THREE.Vector2(1.0, 1.0),
          roughnessMap: rough,
          roughness: 1.0,
          metalness: 0.0,
        }),
      );
    }
    return mats;
  }, [loaded]);

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
      uMinPx: { value: 2.0 },
      uMaxPx: { value: 12.0 }, // near stones read chunky, not pinprick dots
      uScale: { value: 5200 },
      uCoreSharp: { value: 0.05 },
      uAlpha: { value: 1.0 },
      uFadeNear: { value: 0.6 }, // stay visible closer in before meshes take over
      uFadeFar: { value: 2.5 },
    }),
    [pixelRatio],
  );
  const glowUniforms = useMemo(
    () => ({
      uPixelRatio: { value: pixelRatio },
      uMinPx: { value: 4.0 },
      uMaxPx: { value: 14.0 },
      uScale: { value: 4200 },
      uCoreSharp: { value: 0.4 },
      uAlpha: { value: 0.08 }, // just a little dust haze between the rocks
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
    <>
    <LocalDebris materials={materials} />
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
          fragmentShader={HAZE_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* the belt itself: every point shaded as a tiny sunlit stone */}
      <points frustumCulled={false}>
        <bufferGeometry ref={dustGeomRef}>
          <bufferAttribute attach="attributes-position" args={[dustArrays.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[dustArrays.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[dustArrays.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={dustUniforms}
          vertexShader={DUST_VERT}
          fragmentShader={PEBBLE_FRAG}
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
    </>
  );
}
