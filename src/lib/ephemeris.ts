// Planetary/lunar ephemerides via astronomy-engine (offline, arcsec-level).
// All vectors are converted to scene units in the equatorial-J2000 frame the
// rest of the app already uses: (x, y, z)_EQJ -> (x, z, -y)_scene, Y = pole.

import * as THREE from "three";
import { Body, GeoVector, HelioVector, JupiterMoons } from "astronomy-engine";
import { EARTH_RADIUS_KM } from "./constants";
import { BODIES, BODY_IDS, CRAFT_IDS, type BodyId } from "./bodies";
import { craftPositionUnits } from "./spacecraft";

const AU_KM = 149597870.7;
const AU_TO_UNITS = AU_KM / EARTH_RADIUS_KM;
const KM_TO_UNITS = 1 / EARTH_RADIUS_KM;

const AE_BODY: Partial<Record<BodyId, Body>> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

function eqjToScene(x: number, y: number, z: number, target: THREE.Vector3): THREE.Vector3 {
  return target.set(x, z, -y);
}

/** Geocentric Moon position, scene units. Writes into target. */
export function moonGeoVectorUnits(timeMs: number, target: THREE.Vector3): THREE.Vector3 {
  const v = GeoVector(Body.Moon, new Date(timeMs), true); // AU, EQJ
  return target.set(v.x * AU_TO_UNITS, v.z * AU_TO_UNITS, -v.y * AU_TO_UNITS);
}

/** North-pole unit vector in scene coordinates from EQJ RA/Dec degrees. */
export function poleVectorScene(raDeg: number, decDeg: number, target: THREE.Vector3): THREE.Vector3 {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return target.set(x, z, -y);
}

/** Position of a circular-approx moon relative to its parent, scene units. */
export function approxMoonLocalUnits(id: BodyId, timeMs: number, target: THREE.Vector3): THREE.Vector3 {
  const def = BODIES[id];
  const orbit = def.approxOrbit;
  const parent = def.parent ? BODIES[def.parent] : null;
  if (!orbit || !parent) return target.set(0, 0, 0);

  const pole = poleVectorScene(parent.poleRaDeg ?? 0, parent.poleDecDeg ?? 90, _pole);
  // basis perpendicular to the parent's pole (orbit plane ~ equator plane)
  _u.set(0, 0, 1);
  if (Math.abs(pole.dot(_u)) > 0.9) _u.set(1, 0, 0);
  _u.crossVectors(pole, _u).normalize();
  _v.crossVectors(pole, _u);

  const days = timeMs / 86400000;
  const theta = 2 * Math.PI * (days / orbit.periodDays) + orbit.phase;
  const a = orbit.aKm * KM_TO_UNITS;
  return target
    .copy(_u)
    .multiplyScalar(Math.cos(theta) * a)
    .addScaledVector(_v, Math.sin(theta) * a);
}

const _pole = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();

/**
 * Heliocentric position table for every registered body, scene units.
 * Planets refresh on a coarse cadence (they barely move per frame); the Moon
 * and the moons of the focused subsystem refresh every call for smoothness.
 */
export class HelioTable {
  readonly pos: Record<BodyId, THREE.Vector3>;
  private lastCoarse = -Infinity;

  constructor() {
    this.pos = Object.fromEntries(
      BODY_IDS.map((id) => [id, new THREE.Vector3()]),
    ) as Record<BodyId, THREE.Vector3>;
  }

  refresh(timeMs: number, focus: BodyId) {
    const date = new Date(timeMs);
    const coarseStale = Math.abs(timeMs - this.lastCoarse) > 60_000;

    if (coarseStale) {
      this.lastCoarse = timeMs;
      for (const id of Object.keys(AE_BODY) as BodyId[]) {
        const v = HelioVector(AE_BODY[id]!, date);
        eqjToScene(v.x * AU_TO_UNITS, v.y * AU_TO_UNITS, v.z * AU_TO_UNITS, this.pos[id]);
      }
      this.pos.sun.set(0, 0, 0);
    }

    const focusParent = BODIES[focus].parent;
    const inSystem = (parent: BodyId) => focus === parent || focusParent === parent;

    // Moon: always per-call (Earth focus is the app's home)
    moonGeoVectorUnits(timeMs, this.pos.moon).add(this.pos.earth);

    // Galilean moons via astronomy-engine (EQJ, jovicentric)
    if (coarseStale || inSystem("jupiter")) {
      const jm = JupiterMoons(date);
      const set = (id: BodyId, s: { x: number; y: number; z: number }) => {
        eqjToScene(s.x * AU_TO_UNITS, s.y * AU_TO_UNITS, s.z * AU_TO_UNITS, this.pos[id]).add(
          this.pos.jupiter,
        );
      };
      set("io", jm.io);
      set("europa", jm.europa);
      set("ganymede", jm.ganymede);
      set("callisto", jm.callisto);
    }

    // circular-approx moons (Saturn system, Triton)
    for (const id of BODY_IDS) {
      const def = BODIES[id];
      if (!def.approxOrbit || !def.parent) continue;
      if (coarseStale || inSystem(def.parent)) {
        approxMoonLocalUnits(id, timeMs, this.pos[id]).add(this.pos[def.parent]);
      }
    }

    // deep-space spacecraft: linear extrapolation from Horizons epoch state
    for (const id of CRAFT_IDS) {
      craftPositionUnits(id, timeMs, this.pos[id]);
    }
  }
}

/**
 * Sampled geocentric Moon path over one sidereal month centered on timeMs.
 */
export function moonOrbitPath(timeMs: number, samples = 128): Float32Array {
  const SIDEREAL_MONTH_MS = 27.321661 * 86400_000;
  const points = new Float32Array((samples + 1) * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i <= samples; i++) {
    const t = timeMs + (i / samples - 0.5) * SIDEREAL_MONTH_MS;
    moonGeoVectorUnits(t, v);
    points[i * 3] = v.x;
    points[i * 3 + 1] = v.y;
    points[i * 3 + 2] = v.z;
  }
  return points;
}

const ORBITAL_PERIOD_DAYS: Partial<Record<BodyId, number>> = {
  mercury: 87.97,
  venus: 224.7,
  earth: 365.25,
  mars: 687,
  jupiter: 4332.6,
  saturn: 10759,
  uranus: 30687,
  neptune: 60190,
};

/** Heliocentric orbit path of a planet, scene units (one full revolution). */
export function planetOrbitPath(id: BodyId, timeMs: number, samples = 180): Float32Array {
  const body = AE_BODY[id];
  const period = ORBITAL_PERIOD_DAYS[id];
  const points = new Float32Array((samples + 1) * 3);
  if (!body || !period) return points;
  for (let i = 0; i <= samples; i++) {
    const t = timeMs + (i / samples) * period * 86400_000;
    const v = HelioVector(body, new Date(t));
    const j = i * 3;
    points[j] = v.x * AU_TO_UNITS;
    points[j + 1] = v.z * AU_TO_UNITS;
    points[j + 2] = -v.y * AU_TO_UNITS;
  }
  return points;
}

/** Circle path for an approx-orbit moon around its parent, local scene units. */
export function approxOrbitPath(id: BodyId, timeMs: number, samples = 96): Float32Array {
  const points = new Float32Array((samples + 1) * 3);
  const orbit = BODIES[id].approxOrbit;
  if (!orbit) return points;
  const v = new THREE.Vector3();
  for (let i = 0; i <= samples; i++) {
    const t = timeMs + (i / samples) * Math.abs(orbit.periodDays) * 86400_000;
    approxMoonLocalUnits(id, t, v);
    const j = i * 3;
    points[j] = v.x;
    points[j + 1] = v.y;
    points[j + 2] = v.z;
  }
  return points;
}
