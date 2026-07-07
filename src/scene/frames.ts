// Focus-frame singleton. Scene origin is always the focused body. Body
// positions are kept heliocentric in float64-backed Vector3s and converted to
// focus-relative offsets on demand, so coordinates near the camera stay small.

import * as THREE from "three";
import { HelioTable } from "../lib/ephemeris";
import type { BodyId } from "../lib/bodies";

export const helio = new HelioTable();

export const frames = {
  /** current focus body (mirrored from the store by FrameDriver) */
  focus: "earth" as BodyId,
  /** position of Earth's center in the current focus frame */
  earthOffset: new THREE.Vector3(),
  /** geocentric Moon vector, scene units */
  moonVec: new THREE.Vector3(60, 0, 0),
  /** camera distance from focus origin, scene units (for HUD) */
  cameraDist: 3.4,
};

/** position of `id` in the current focus frame */
export function offsetOf(id: BodyId, target: THREE.Vector3): THREE.Vector3 {
  return target.copy(helio.pos[id]).sub(helio.pos[frames.focus]);
}
