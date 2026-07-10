// The big, named main-belt bodies (Ceres, Vesta, ...). Unlike the 16,000
// ambient belt rocks -- which are astronomically tiny and only ever read as
// dust at this scale -- these are real, focusable bodies you fly to exactly
// like a planet. Each is an irregular mesh skinned with a real photographic
// rock texture (albedo + normal + roughness) and lit by the scene SunLight, so
// up close you actually see stone: craters, grain, relief catching the sun.

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { BODIES, BODY_IDS, type BodyDef, type BodyId } from "../lib/bodies";
import { getSimNow } from "../store/useStore";
import { offsetOf } from "./frames";

const HOURS_TO_MS = 3_600_000;

// named belt rocks + the small irregular moons (Phobos, Deimos, Amalthea,
// Hyperion, Phoebe, Nix, Hydra): anything with a rock texture assigned that
// isn't part of the ambient belt field
const ASTEROID_IDS: BodyId[] = BODY_IDS.filter(
  (id) =>
    BODIES[id].type === "asteroid" ||
    (BODIES[id].type === "moon" && BODIES[id].rockIndex !== undefined),
);

// stable per-body shape seed (rockIndex repeats across bodies; ids don't)
function idSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// irregular rock body: unit-radius icosphere pushed around by layered noise.
// `lumpiness` controls how far from round it gets (Ceres ~round, Vesta lumpy).
function buildBodyRock(seed: number, lumpiness: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 5);
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
  const px = rand() * 6.28;
  const py = rand() * 6.28;
  const pz = rand() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    // big asymmetric lobes give the overall chunky silhouette
    const lobe =
      Math.sin(n.x * 1.7 + px) * Math.cos(n.y * 1.5 + py) * 0.55 +
      Math.sin(n.z * 2.1 + pz) * 0.4 +
      Math.cos(n.x * 3.1 - n.z * 2.6 + px) * 0.22;
    // a couple of gouged basins (large-crater feel)
    const basin =
      Math.min(0, Math.sin(n.x * 4 + py) * Math.sin(n.y * 3.5 + pz) - 0.55) * 0.6;
    const mid = Math.sin(n.x * 7 + seed) * 0.05 + Math.cos(n.z * 8 - seed) * 0.04;
    const bump = 1 + (lobe + basin + mid) * lumpiness;
    v.copy(n).multiplyScalar(Math.max(0.55, bump));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function rockPaths(index: number): string[] {
  const p = `/textures/asteroids/ast${String(index).padStart(2, "0")}`;
  return [`${p}_diff.jpg`, `${p}_nor.jpg`, `${p}_rough.jpg`];
}

function AsteroidMesh({ def }: { def: BodyDef }) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Mesh>(null);

  // Vesta/Pallas/Davida read as lumpier; Ceres/Hygiea rounder; the small
  // moons (Phobos, Hyperion, ...) are the true potatoes
  const lumpiness =
    def.id === "ceres" || def.id === "hygiea" ? 0.16 : def.type === "moon" ? 0.34 : 0.28;
  const geometry = useMemo(
    () => buildBodyRock(idSeed(def.id), lumpiness),
    [def.id, lumpiness],
  );

  const [diff, nor, rough] = useTexture(rockPaths(def.rockIndex ?? 0));

  const material = useMemo(() => {
    diff.colorSpace = THREE.SRGBColorSpace;
    nor.colorSpace = THREE.NoColorSpace;
    rough.colorSpace = THREE.NoColorSpace;
    for (const t of [diff, nor, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2, 1); // wrap the tileable rock twice around for finer grain
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
    return new THREE.MeshStandardMaterial({
      map: diff,
      normalMap: nor,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: rough,
      roughness: 1.0,
      metalness: 0.0,
      color: new THREE.Color(def.color).multiplyScalar(1.15),
    });
  }, [diff, nor, rough, def.color]);

  // stable pseudo-random axial tilt so they don't all spin bolt-upright
  const tiltQuat = useMemo(() => {
    let s = (idSeed(def.id) + 7) * 2246822519;
    const r = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const axis = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, r() * 0.9 - 0.45);
  }, [def.id]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf(def.id, g.position);
    if (spinRef.current && def.rotationHours) {
      spinRef.current.rotation.y =
        (getSimNow() / (def.rotationHours * HOURS_TO_MS)) * Math.PI * 2;
    }
  });

  // the smallest moons (Deimos ~6 km) would be sub-pixel at true scale even
  // fully zoomed in; floor their visual radius so the rock is explorable
  const visualRadius = def.type === "moon" ? Math.max(def.radius, 0.01) : def.radius;

  return (
    <group ref={groupRef}>
      <group quaternion={tiltQuat}>
        <mesh ref={spinRef} geometry={geometry} material={material} scale={visualRadius} />
      </group>
    </group>
  );
}

export function NamedAsteroids() {
  return (
    <Suspense fallback={null}>
      {ASTEROID_IDS.map((id) => (
        <AsteroidMesh key={id} def={BODIES[id]} />
      ))}
    </Suspense>
  );
}
