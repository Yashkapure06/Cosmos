// Deep-space spacecraft via JPL Horizons state vectors. These craft coast on
// near-straight lines for months, so one (position, velocity) epoch per craft
// plus linear extrapolation is visually exact. Loader mirrors the CelesTrak
// pattern: live API -> IndexedDB cache (24 h) -> stale cache -> bundled snapshot.

import * as THREE from "three";
import { EARTH_RADIUS_KM } from "./constants";
import { idbGet, idbSet } from "./idb";
import type { BodyId } from "./bodies";

const HORIZONS_IDS: Partial<Record<BodyId, number>> = {
  voyager1: -31,
  voyager2: -32,
  newhorizons: -98,
  jwst: -170,
  parker: -96,
};

export interface CraftState {
  epochMs: number;
  /** heliocentric position at epoch, scene units (EQJ mapped) */
  r: THREE.Vector3;
  /** scene units per millisecond */
  v: THREE.Vector3;
}

interface RawState {
  epochMs: number;
  r: [number, number, number]; // km, EQJ
  v: [number, number, number]; // km/s, EQJ
}

const CACHE_KEY = "orbit:spacecraft:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const craftStates = new Map<BodyId, CraftState>();

export function spacecraftReady(): boolean {
  return craftStates.size > 0;
}

/** km EQJ -> scene units: (x, y, z) -> (x, z, -y), /6371 */
function toScene(kmVec: [number, number, number], perSecond = false): THREE.Vector3 {
  const s = 1 / EARTH_RADIUS_KM / (perSecond ? 1000 : 1); // optionally per-ms
  return new THREE.Vector3(kmVec[0] * s, kmVec[2] * s, -kmVec[1] * s);
}

function adopt(states: Record<string, RawState>) {
  for (const [id, raw] of Object.entries(states)) {
    craftStates.set(id as BodyId, {
      epochMs: raw.epochMs,
      r: toScene(raw.r),
      v: toScene(raw.v, true),
    });
  }
}

function horizonsUrl(id: number): string {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const q =
    `format=json&COMMAND='${id}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'` +
    `&EPHEM_TYPE='VECTORS'&CENTER='@10'&START_TIME='${fmt(today)}'` +
    `&STOP_TIME='${fmt(tomorrow)}'&STEP_SIZE='1d'&REF_PLANE='FRAME'` +
    `&CSV_FORMAT='YES'&OUT_UNITS='KM-S'&VEC_TABLE='2'`;
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${q}`;
}

function parseHorizons(resultText: string): RawState | null {
  const i = resultText.indexOf("$$SOE");
  if (i < 0) return null;
  const line = resultText.slice(i).split("\n")[1];
  const cols = line.split(",").map((s) => s.trim());
  const jd = parseFloat(cols[0]);
  if (!isFinite(jd)) return null;
  return {
    epochMs: (jd - 2440587.5) * 86400000,
    r: [parseFloat(cols[2]), parseFloat(cols[3]), parseFloat(cols[4])],
    v: [parseFloat(cols[5]), parseFloat(cols[6]), parseFloat(cols[7])],
  };
}

async function fetchLive(): Promise<Record<string, RawState>> {
  const out: Record<string, RawState> = {};
  for (const [key, hid] of Object.entries(HORIZONS_IDS)) {
    const res = await fetch(horizonsUrl(hid!));
    if (!res.ok) throw new Error(`Horizons ${key}: HTTP ${res.status}`);
    const json = (await res.json()) as { result: string };
    const state = parseHorizons(json.result);
    if (!state) throw new Error(`Horizons ${key}: parse failed`);
    out[key] = state;
  }
  return out;
}

let loadPromise: Promise<void> | null = null;

export function loadSpacecraft(): Promise<void> {
  loadPromise ??= (async () => {
    interface CachePayload {
      fetchedAt: number;
      states: Record<string, RawState>;
    }
    const cached = await idbGet<CachePayload>(CACHE_KEY);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      adopt(cached.states);
      return;
    }
    try {
      const states = await fetchLive();
      void idbSet(CACHE_KEY, { fetchedAt: Date.now(), states });
      adopt(states);
    } catch {
      if (cached) {
        adopt(cached.states); // stale beats nothing
        return;
      }
      const res = await fetch("/data/spacecraft-snapshot.json");
      if (res.ok) {
        const snap = (await res.json()) as { craft: Record<string, RawState> };
        adopt(snap.craft);
      }
    }
  })();
  return loadPromise;
}

/** linear extrapolation from the epoch state; writes scene units into target */
export function craftPositionUnits(
  id: BodyId,
  timeMs: number,
  target: THREE.Vector3,
): THREE.Vector3 | null {
  const s = craftStates.get(id);
  if (!s) return null;
  return target.copy(s.r).addScaledVector(s.v, timeMs - s.epochMs);
}
