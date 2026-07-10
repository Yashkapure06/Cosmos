// Real umbra cones for Earth and the Moon, computed from true geometry:
// L = R_body * d_sun / (R_sun - R_body). When the Moon's cone touches Earth
// that's a total solar eclipse; when the Moon passes through Earth's cone
// that's a lunar eclipse. Jump the time machine to Aug 2 2027 and watch.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { BODIES, type BodyId } from "../lib/bodies";
import { helio, offsetOf } from "./frames";

const SUN_R = 696000 / EARTH_RADIUS_KM;

function UmbraCone({ body }: { body: BodyId }) {
  const groupRef = useRef<THREE.Group>(null);
  const R = BODIES[body].radius;

  // unit cone: base radius R at origin tapering to a point at +Y = 1;
  // per-frame we scale Y to the true umbra length and aim it anti-sunward
  const geometry = useMemo(() => {
    // ConeGeometry: base (radius R) at y=-0.5, apex at y=+0.5.
    // Shift so base sits on the body (y=0) and the apex points to y=1.
    const g = new THREE.ConeGeometry(R, 1, 48, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, [R]);

  const s = useMemo(
    () => ({
      anti: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    offsetOf(body, g.position);

    const sunDist = helio.pos[body].length();
    if (sunDist < 1) return;
    const L = (R * sunDist) / (SUN_R - R); // true umbra length
    s.anti.copy(helio.pos[body]).normalize(); // away from the sun
    s.quat.setFromUnitVectors(s.up, s.anti);
    g.quaternion.copy(s.quat);
    g.scale.set(1, L, 1);
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.34}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function EclipseShadows() {
  return (
    <>
      <UmbraCone body="earth" />
      <UmbraCone body="moon" />
    </>
  );
}
