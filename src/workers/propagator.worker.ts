/// <reference lib="webworker" />
// SGP4 propagation off the main thread. Receives the OMM catalog once,
// then answers position/velocity snapshots and single-satellite orbit paths.

import { json2satrec, propagate, type SatRec } from "satellite.js";
import { KM_TO_UNITS } from "../lib/constants";
import type { FromWorker, ToWorker } from "../lib/types";

const satrecs: (SatRec | null)[] = [];

function post(msg: FromWorker, transfer: Transferable[] = []) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
}

function initRecords(omms: Parameters<typeof json2satrec>[0][]): number {
  let valid = 0;
  for (const omm of omms) {
    try {
      const rec = json2satrec(omm);
      satrecs.push(rec);
      valid++;
    } catch {
      satrecs.push(null);
    }
  }
  return valid;
}

// ECI km (Z-up) -> scene units (Y-up): (x, y, z) -> (x, z, -y)
function propagateAll(simTime: number) {
  const n = satrecs.length;
  const positions = new Float32Array(n * 3);
  const velocities = new Float32Array(n * 3);
  const date = new Date(simTime);

  for (let i = 0; i < n; i++) {
    const rec = satrecs[i];
    if (!rec) continue;
    let pv;
    try {
      pv = propagate(rec, date);
    } catch {
      continue;
    }
    const p = pv?.position;
    const v = pv?.velocity;
    if (!p || typeof p === "boolean" || !v || typeof v === "boolean") continue;
    const j = i * 3;
    positions[j] = p.x * KM_TO_UNITS;
    positions[j + 1] = p.z * KM_TO_UNITS;
    positions[j + 2] = -p.y * KM_TO_UNITS;
    velocities[j] = v.x * KM_TO_UNITS;
    velocities[j + 1] = v.z * KM_TO_UNITS;
    velocities[j + 2] = -v.y * KM_TO_UNITS;
  }

  post(
    { type: "positions", simTime, positions, velocities },
    [positions.buffer, velocities.buffer],
  );
}

function orbitPath(requestId: number, index: number, simTime: number, samples: number) {
  const rec = satrecs[index];
  const points = new Float32Array((samples + 1) * 3);
  if (rec) {
    // rec.no is mean motion in radians/minute
    const periodMin = (2 * Math.PI) / rec.no;
    for (let s = 0; s <= samples; s++) {
      const t = simTime + (s / samples) * periodMin * 60_000;
      let pv;
      try {
        pv = propagate(rec, new Date(t));
      } catch {
        continue;
      }
      const p = pv?.position;
      if (!p || typeof p === "boolean") continue;
      const j = s * 3;
      points[j] = p.x * KM_TO_UNITS;
      points[j + 1] = p.z * KM_TO_UNITS;
      points[j + 2] = -p.y * KM_TO_UNITS;
    }
  }
  post({ type: "orbitResult", requestId, index, points }, [points.buffer]);
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init": {
      satrecs.length = 0; // idempotent: React StrictMode mounts twice
      const valid = initRecords(msg.omms);
      post({ type: "ready", total: satrecs.length, valid });
      break;
    }
    case "append": {
      const valid = initRecords(msg.omms);
      post({ type: "appended", total: satrecs.length, valid });
      break;
    }
    case "propagate":
      propagateAll(msg.simTime);
      break;
    case "orbit":
      orbitPath(msg.requestId, msg.index, msg.simTime, msg.samples);
      break;
  }
};
