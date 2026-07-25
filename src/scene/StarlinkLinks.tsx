// Sparse Starlink mesh links — nearest-neighbor lines among a sampled subset.
// Rebuilds on a throttle so CPU stays light with 5k+ sats.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { quality } from "../lib/quality";

const SAMPLE = 180;
const MAX_LINK = 0.35; // scene units (~2200 km)
const REBUILD_MS = 400;

export function StarlinkLinks() {
  const on = useStore((s) => s.showSatLinks);
  const meta = useStore((s) => s.meta);
  const enabled = useStore((s) => s.enabled);
  const lineRef = useRef<THREE.LineSegments>(null);
  const lastBuild = useRef(0);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scratch = useMemo(() => new Float32Array(SAMPLE * 3), []);

  const starlinkIdx = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < meta.length; i++) {
      if (meta[i]?.category === "starlink") out.push(i);
    }
    return out;
  }, [meta]);

  const geom = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame(() => {
    if (!on || !enabled.starlink || starlinkIdx.length < 2 || !quality.glow) {
      if (lineRef.current) lineRef.current.visible = false;
      return;
    }
    const now = performance.now();
    if (now - lastBuild.current < REBUILD_MS && lineRef.current) {
      lineRef.current.visible = true;
      return;
    }
    lastBuild.current = now;

    const sim = getSimNow();
    const n = Math.min(SAMPLE, starlinkIdx.length);
    const step = Math.max(1, Math.floor(starlinkIdx.length / n));
    const ids: number[] = [];
    for (let i = 0; i < starlinkIdx.length && ids.length < n; i += step) {
      ids.push(starlinkIdx[i]);
    }

    for (let i = 0; i < ids.length; i++) {
      engine.positionOf(ids[i], sim, pos);
      scratch[i * 3] = pos.x;
      scratch[i * 3 + 1] = pos.y;
      scratch[i * 3 + 2] = pos.z;
    }

    const segs: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      let best = -1;
      let bestD = MAX_LINK;
      const ix = scratch[i * 3];
      const iy = scratch[i * 3 + 1];
      const iz = scratch[i * 3 + 2];
      for (let j = i + 1; j < ids.length; j++) {
        const dx = ix - scratch[j * 3];
        const dy = iy - scratch[j * 3 + 1];
        const dz = iz - scratch[j * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) {
        segs.push(
          ix,
          iy,
          iz,
          scratch[best * 3],
          scratch[best * 3 + 1],
          scratch[best * 3 + 2],
        );
      }
    }

    const arr = new Float32Array(segs);
    geom.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    geom.computeBoundingSphere();
    if (lineRef.current) lineRef.current.visible = segs.length > 0;
  });

  if (!on || !enabled.starlink) return null;

  return (
    <lineSegments ref={lineRef} geometry={geom} frustumCulled={false}>
      <lineBasicMaterial
        color="#7dd3fc"
        transparent
        opacity={0.28}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}
