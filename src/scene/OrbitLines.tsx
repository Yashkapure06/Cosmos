// Orbit paths: heliocentric ellipses for the planets (fade in as you leave a
// planet's neighborhood) and local circles for moons (visible near a parent).

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  BODIES,
  BODY_IDS,
  PLANET_IDS,
  releaseRadius,
  type BodyId,
} from "../lib/bodies";
import { approxOrbitPath, asteroidOrbitPath, planetOrbitPath } from "../lib/ephemeris";

const ASTEROID_IDS: BodyId[] = BODY_IDS.filter(
  (id) => BODIES[id].type === "asteroid" || BODIES[id].type === "comet",
);
import { getSimNow } from "../store/useStore";
import { frames, offsetOf } from "./frames";

function makeLine(points: Float32Array, color: string): THREE.Line {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Line(geom, mat);
}

export function OrbitLines() {
  const sunGroupRef = useRef<THREE.Group>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  // planet ellipses, computed once (orbits are stable at this precision);
  // dwarf planets without an astronomy-engine ephemeris use their elements
  const planetLines = useMemo(() => {
    const now = getSimNow();
    // exoplanets (approxOrbit around a remote star) draw as moon-style circles
    return PLANET_IDS.filter((id) => !BODIES[id].approxOrbit).map((id) => ({
      id,
      line: makeLine(
        BODIES[id].helioElements ? asteroidOrbitPath(id) : planetOrbitPath(id, now),
        BODIES[id].color,
      ),
    }));
  }, []);

  // named-asteroid ellipses (heliocentric, like the planets)
  const asteroidLines = useMemo(
    () =>
      ASTEROID_IDS.map((id) => ({
        id,
        line: makeLine(asteroidOrbitPath(id), BODIES[id].color),
      })),
    [],
  );

  // moon circles grouped by parent
  const moonGroups = useMemo(() => {
    const now = getSimNow();
    const byParent = new Map<BodyId, THREE.Line[]>();
    for (const id of BODY_IDS) {
      const def = BODIES[id];
      if (!def.approxOrbit || !def.parent) continue;
      const line = makeLine(approxOrbitPath(id, now), def.color);
      const arr = byParent.get(def.parent) ?? [];
      arr.push(line);
      byParent.set(def.parent, arr);
    }
    return [...byParent.entries()].map(([parent, lines]) => ({
      parent,
      lines,
      ref: { current: null as THREE.Group | null },
    }));
  }, []);

  useEffect(
    () => () => {
      for (const { line } of [...planetLines, ...asteroidLines]) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      for (const g of moonGroups)
        for (const line of g.lines) {
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
        }
    },
    [planetLines, moonGroups],
  );

  useFrame(({ camera }) => {
    // heliocentric group follows the sun's offset in the focus frame
    if (sunGroupRef.current) offsetOf("sun", sunGroupRef.current.position);

    // planet ellipses appear once you pull away from the focused body
    const away = THREE.MathUtils.smoothstep(
      frames.cameraDist,
      releaseRadius(frames.focus) === Infinity ? 300 : releaseRadius(frames.focus) * 0.5,
      releaseRadius(frames.focus) === Infinity ? 1500 : releaseRadius(frames.focus) * 3,
    );
    for (const { line } of planetLines) {
      (line.material as THREE.LineBasicMaterial).opacity = 0.28 * Math.max(away, frames.focus === "sun" ? 1 : 0);
    }
    for (const { line } of asteroidLines) {
      (line.material as THREE.LineBasicMaterial).opacity = 0.16 * Math.max(away, frames.focus === "sun" ? 1 : 0);
    }

    // moon circles appear near their parent
    for (const g of moonGroups) {
      if (g.ref.current) offsetOf(g.parent, g.ref.current.position);
      const dist = camera.position.distanceTo(offsetOf(g.parent, scratch));
      const near = 1 - THREE.MathUtils.smoothstep(dist, releaseRadius(g.parent) * 2, releaseRadius(g.parent) * 5);
      for (const line of g.lines) {
        (line.material as THREE.LineBasicMaterial).opacity = 0.3 * near;
      }
    }
  });

  return (
    <>
      <group ref={sunGroupRef}>
        {planetLines.map(({ id, line }) => (
          <primitive key={id} object={line} />
        ))}
        {asteroidLines.map(({ id, line }) => (
          <primitive key={id} object={line} />
        ))}
      </group>
      {moonGroups.map((g) => (
        <group key={g.parent} ref={(el) => (g.ref.current = el)}>
          {g.lines.map((line, i) => (
            <primitive key={i} object={line} />
          ))}
        </group>
      ))}
    </>
  );
}
