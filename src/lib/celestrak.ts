import {
  CELESTRAK_BASE,
  DEBRIS_GROUPS,
  MU_EARTH,
  EARTH_RADIUS_KM,
  TLE_CACHE_TTL_MS,
  type Category,
} from "./constants";
import { idbGet, idbSet } from "./idb";
import type { OmmRecord, SatMeta } from "./types";

interface CachePayload {
  fetchedAt: number;
  omms: OmmRecord[];
}

async function fetchGroup(group: string): Promise<OmmRecord[]> {
  const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CelesTrak ${group}: HTTP ${res.status}`);
  return (await res.json()) as OmmRecord[];
}

/**
 * Cache-first loader. CelesTrak rejects repeat downloads of the same group
 * until fresh data is published (~2 h), so each group is fetched at most once
 * per TTL and results persist in IndexedDB across reloads.
 * Order: fresh cache -> network -> stale cache -> bundled snapshot (active only).
 */
async function loadGroupCached(
  cacheKey: string,
  group: string,
  bundledFallback?: string,
): Promise<OmmRecord[]> {
  const cached = await idbGet<CachePayload>(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TLE_CACHE_TTL_MS) {
    return cached.omms;
  }
  try {
    const omms = await fetchGroup(group);
    void idbSet(cacheKey, { fetchedAt: Date.now(), omms } satisfies CachePayload);
    return omms;
  } catch (err) {
    if (cached) return cached.omms; // stale beats nothing
    if (bundledFallback) {
      const res = await fetch(bundledFallback);
      if (res.ok) return (await res.json()) as OmmRecord[];
    }
    throw err;
  }
}

// single-flight: StrictMode double-mount and re-renders share one promise
let activePromise: Promise<OmmRecord[]> | null = null;
let debrisPromise: Promise<OmmRecord[]> | null = null;

export function fetchActiveCatalog(): Promise<OmmRecord[]> {
  activePromise ??= loadGroupCached(
    "orbit:catalog:active:v2",
    "active",
    "/data/active-snapshot.json",
  ).catch((err) => {
    activePromise = null; // allow retry
    throw err;
  });
  return activePromise;
}

export function fetchDebrisCatalog(): Promise<OmmRecord[]> {
  debrisPromise ??= (async () => {
    const results = await Promise.allSettled(
      DEBRIS_GROUPS.map((g) => loadGroupCached(`orbit:catalog:${g}:v2`, g)),
    );
    const seen = new Set<number>();
    const out: OmmRecord[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const omm of r.value) {
        if (seen.has(omm.NORAD_CAT_ID)) continue;
        seen.add(omm.NORAD_CAT_ID);
        out.push(omm);
      }
    }
    return out;
  })();
  return debrisPromise;
}

function classify(name: string): Category {
  const n = name.toUpperCase();
  if (n.includes("ISS (ZARYA)") || n.includes("CSS (") || n.startsWith("TIANGONG"))
    return "station";
  if (n.startsWith("STARLINK")) return "starlink";
  if (n.startsWith("ONEWEB")) return "oneweb";
  if (
    n.startsWith("GPS ") ||
    n.startsWith("NAVSTAR") ||
    n.startsWith("GLONASS") ||
    n.startsWith("GALILEO") ||
    n.startsWith("GSAT0") ||
    n.startsWith("BEIDOU") ||
    n.startsWith("QZS") ||
    n.startsWith("IRNSS") ||
    n.startsWith("NAVIC")
  )
    return "navigation";
  if (
    n.startsWith("NOAA") ||
    n.startsWith("GOES") ||
    n.startsWith("METEOSAT") ||
    n.startsWith("HIMAWARI") ||
    n.startsWith("METEOR") ||
    n.startsWith("METOP") ||
    n.startsWith("FENGYUN") ||
    n.startsWith("SENTINEL") ||
    n.startsWith("LANDSAT") ||
    n.startsWith("TERRA") ||
    n.startsWith("AQUA") ||
    n.startsWith("SUOMI") ||
    n.startsWith("JPSS")
  )
    return "weather";
  return "other";
}

export function buildMeta(
  omms: OmmRecord[],
  startIndex: number,
  forcedCategory?: Category,
): SatMeta[] {
  return omms.map((omm, i) => {
    const periodMin = 1440 / omm.MEAN_MOTION;
    // semi-major axis from mean motion
    const nRadS = (omm.MEAN_MOTION * 2 * Math.PI) / 86400;
    const a = Math.cbrt(MU_EARTH / (nRadS * nRadS));
    const apogeeKm = a * (1 + omm.ECCENTRICITY) - EARTH_RADIUS_KM;
    const perigeeKm = a * (1 - omm.ECCENTRICITY) - EARTH_RADIUS_KM;
    const yearTwo = omm.OBJECT_ID?.slice(0, 4);
    const launchYear = yearTwo ? Number(yearTwo) || null : null;
    return {
      index: startIndex + i,
      name: omm.OBJECT_NAME,
      noradId: omm.NORAD_CAT_ID,
      intlDes: omm.OBJECT_ID ?? "-",
      category: forcedCategory ?? classify(omm.OBJECT_NAME),
      inclination: omm.INCLINATION,
      periodMin,
      apogeeKm,
      perigeeKm,
      epoch: omm.EPOCH,
      launchYear,
    };
  });
}
