// Billboard markers + labels so distant bodies stay findable (and aimable by
// the scroll magnet). A marker hides when its body is visually large enough
// to speak for itself; moon markers only appear near their parent.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BODIES,
  BODY_IDS,
  releaseRadius,
  type BodyId,
} from "../lib/bodies";
import { spacecraftReady } from "../lib/spacecraft";
import { useStore } from "../store/useStore";
import { offsetOf } from "./frames";
import { nav } from "./nav";

const MARKED: BodyId[] = BODY_IDS;

function Marker({ id }: { id: BodyId }) {
  const def = BODIES[id];
  const groupRef = useRef<THREE.Group>(null);
  const divRef = useRef<HTMLButtonElement>(null);
  const scratch = useMemo(
    () => ({ pos: new THREE.Vector3(), parent: new THREE.Vector3() }),
    [],
  );

  useFrame(({ camera }) => {
    const g = groupRef.current;
    const div = divRef.current;
    if (!g || !div) return;
    offsetOf(id, g.position);

    const dist = camera.position.distanceTo(g.position);
    const angPx = (def.radius / dist) * 900; // ~pixels of body radius on screen

    let visible = angPx < 10; // mesh takes over when big
    if (!useStore.getState().showLabels) visible = false;
    if (def.type === "craft" && !spacecraftReady()) visible = false;
    // hide the focused craft's own label up close - the model + panel own it
    if (def.type === "craft" && useStore.getState().focus === id && dist < 10)
      visible = false;
    const declutter =
      (def.type === "moon" && def.parent) ||
      // exoplanets + companion stars: labels only near their own star
      (def.parent && def.parent !== "sun" && BODIES[def.parent].type === "star");
    if (visible && declutter && def.parent) {
      // declutter: labels only near their parent system
      const pDist = camera.position.distanceTo(offsetOf(def.parent, scratch.parent));
      visible = pDist < releaseRadius(def.parent) * 3;
    }
    div.style.opacity = visible ? "1" : "0";
    div.style.pointerEvents = visible ? "auto" : "none";
  });

  return (
    <group ref={groupRef}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <button
          ref={divRef}
          className="body-marker"
          style={{ opacity: 0 }}
          onClick={() => nav.flyTo(id)}
          aria-label={`Fly to ${def.label}`}
        >
          <span className="body-marker-dot" style={{ borderColor: def.color }} />
          <span className="body-marker-name" style={{ color: def.color }}>
            {def.label.toUpperCase()}
          </span>
        </button>
      </Html>
    </group>
  );
}

export function Markers() {
  return (
    <>
      {MARKED.map((id) => (
        <Marker key={id} id={id} />
      ))}
    </>
  );
}
