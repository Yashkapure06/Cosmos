// Deep-space craft: a distance-scaled glowing beacon for far visibility plus
// a procedural mini-model (primitives + PBR materials) that fades in when the
// camera gets close. Lit by the shared SunLight (see Lighting.tsx).

import { useMemo, useRef, type ComponentType } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES, CRAFT_IDS, type BodyId } from "../lib/bodies";
import { spacecraftReady } from "../lib/spacecraft";
import { useStore } from "../store/useStore";
import { offsetOf } from "./frames";

/** overall model size, scene units (~0.05u ≈ 300 km - fictional but readable) */
const MODEL_SCALE = 0.05;
/** camera closer than this -> show the model, dim the beacon */
const MODEL_RANGE = 6;

const GOLD = new THREE.MeshStandardMaterial({
  color: "#c9a24b",
  metalness: 0.85,
  roughness: 0.35,
});
const FOIL = new THREE.MeshStandardMaterial({
  color: "#8a6a2f",
  metalness: 0.9,
  roughness: 0.55,
});
const WHITE = new THREE.MeshStandardMaterial({
  color: "#e6e4de",
  metalness: 0.2,
  roughness: 0.6,
});
const SILVER = new THREE.MeshStandardMaterial({
  color: "#cfd6dd",
  metalness: 0.9,
  roughness: 0.25,
});
const MIRROR_GOLD = new THREE.MeshStandardMaterial({
  color: "#e8b93c",
  metalness: 1.0,
  roughness: 0.15,
});
const COPPER = new THREE.MeshStandardMaterial({
  color: "#a86a44",
  metalness: 0.7,
  roughness: 0.45,
});

/** dish antenna probe: Voyager 1/2, New Horizons */
function DishProbe() {
  return (
    <group>
      {/* high-gain dish */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]}>
        <coneGeometry args={[0.5, 0.22, 32, 1, true]} />
        <primitive object={WHITE} attach="material" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      {/* ten-sided bus behind the dish */}
      <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.14, 10]} />
        <primitive object={FOIL} attach="material" />
      </mesh>
      {/* RTG boom */}
      <mesh position={[0.35, 0, -0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      <mesh position={[0.55, 0, -0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.22, 8]} />
        <primitive object={COPPER} attach="material" />
      </mesh>
      {/* long magnetometer boom */}
      <mesh position={[-0.55, 0, -0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, 0.95, 6]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
    </group>
  );
}

/** JWST: gold mirror + kite sunshield */
function Webb() {
  return (
    <group>
      <mesh rotation={[-0.5, 0, 0]} position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.03, 6]} />
        <primitive object={MIRROR_GOLD} attach="material" />
      </mesh>
      {/* secondary mirror struts */}
      <mesh rotation={[-0.5, 0, 0.5]} position={[0.12, 0.3, 0.1]}>
        <cylinderGeometry args={[0.008, 0.008, 0.45, 6]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      <mesh rotation={[-0.5, 0, -0.5]} position={[-0.12, 0.3, 0.1]}>
        <cylinderGeometry args={[0.008, 0.008, 0.45, 6]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      {/* five-layer kite sunshield */}
      <mesh rotation={[-0.35, 0, 0]} position={[0, -0.06, 0]}>
        <boxGeometry args={[1.1, 0.012, 0.62]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      <mesh rotation={[-0.35, 0, 0]} position={[0, -0.11, 0]}>
        <boxGeometry args={[1.16, 0.012, 0.68]} />
        <primitive object={FOIL} attach="material" />
      </mesh>
      {/* bus below */}
      <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[0.22, 0.2, 0.22]} />
        <primitive object={GOLD} attach="material" />
      </mesh>
    </group>
  );
}

/** Parker: heat shield forward, instruments hiding behind */
function Parker() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.22]}>
        <cylinderGeometry args={[0.42, 0.38, 0.09, 24]} />
        <primitive object={WHITE} attach="material" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.08]}>
        <cylinderGeometry args={[0.14, 0.14, 0.42, 12]} />
        <primitive object={COPPER} attach="material" />
      </mesh>
      <mesh position={[0.26, 0, -0.1]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.24, 0.01, 0.34]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      <mesh position={[-0.26, 0, -0.1]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.24, 0.01, 0.34]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
    </group>
  );
}

const MODEL: Partial<Record<BodyId, ComponentType>> = {
  voyager1: DishProbe,
  voyager2: DishProbe,
  newhorizons: DishProbe,
  jwst: Webb,
  parker: Parker,
};

function Craft({ id }: { id: BodyId }) {
  const rootRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const modelRef = useRef<THREE.Group>(null);
  const color = useMemo(() => new THREE.Color(BODIES[id].color), [id]);
  const Model = MODEL[id] ?? DishProbe;

  useFrame(({ camera }, delta) => {
    const root = rootRef.current;
    if (!root) return;
    if (!spacecraftReady()) {
      root.visible = false;
      return;
    }
    root.visible = true;
    offsetOf(id, root.position);
    const dist = camera.position.distanceTo(root.position);

    const beacon = beaconRef.current;
    if (beacon) {
      beacon.visible = dist > MODEL_RANGE * 0.5;
      beacon.scale.setScalar(dist * 0.0035);
      beacon.rotation.y += delta * 0.8;
      beacon.rotation.x += delta * 0.5;
    }
    const model = modelRef.current;
    if (model) {
      model.visible = dist < MODEL_RANGE;
      model.rotation.y += delta * 0.06; // slow, stately drift
    }
  });

  return (
    <group ref={rootRef} visible={false}>
      <mesh ref={beaconRef}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={modelRef} scale={MODEL_SCALE} visible={false}>
        <Model />
      </group>
    </group>
  );
}

export function Spacecraft() {
  const ready = useStore((s) => s.spacecraftReady);
  if (!ready) return null;
  return (
    <>
      {CRAFT_IDS.map((id) => (
        <Craft key={id} id={id} />
      ))}
    </>
  );
}
