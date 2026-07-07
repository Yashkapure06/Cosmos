// Procedural main-belt population. Orbital elements are generated once and
// kept static (real asteroid orbits barely precess on human timescales); only
// mean anomaly advances with sim time, computed fresh from an absolute epoch
// each refresh -- same "stateless" trick as everything else in the app, so
// rewind/fast-forward and huge time jumps stay exactly correct with no drift.

import * as THREE from "three";
import { EARTH_RADIUS_KM } from "./constants";

const AU_KM = 149597870.7;
export const AU_TO_UNITS = AU_KM / EARTH_RADIUS_KM;
const YEAR_MS = 365.25 * 86400_000;

// ecliptic north pole tilt relative to EQJ (mean obliquity, J2000)
const OBLIQUITY = (23.4392811 * Math.PI) / 180;
const COS_EPS = Math.cos(OBLIQUITY);
const SIN_EPS = Math.sin(OBLIQUITY);

export const VARIANTS = 6;
export const TEXTURE_COUNT = 10;

export interface AsteroidField {
  count: number;
  aUnits: Float32Array;
  e: Float32Array;
  iRad: Float32Array;
  nodeRad: Float32Array;
  argRad: Float32Array;
  m0Rad: Float32Array;
  meanMotion: Float32Array; // rad/ms
  variant: Uint8Array;
  textureIndex: Uint8Array; // 0..TEXTURE_COUNT-1
  scale: Float32Array; // instance radius, scene units
  spinAxis: Float32Array; // count*3, unit vectors
  spinRate: Float32Array; // rad/ms
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number): number {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

// Kirkwood-gap-ish density dips so the belt isn't a uniform featureless ring
function beltDensity(aAu: number): number {
  const gaps = [2.5, 2.82, 3.27];
  let g = 1;
  for (const c of gaps) g *= 1 - 0.7 * Math.exp(-((aAu - c) ** 2) / (2 * 0.02 ** 2));
  return g;
}

export function generateBelt(count: number, seed = 1337): AsteroidField {
  const rand = mulberry32(seed);
  const aUnits = new Float32Array(count);
  const e = new Float32Array(count);
  const iRad = new Float32Array(count);
  const nodeRad = new Float32Array(count);
  const argRad = new Float32Array(count);
  const m0Rad = new Float32Array(count);
  const meanMotion = new Float32Array(count);
  const variant = new Uint8Array(count);
  const textureIndex = new Uint8Array(count);
  const scale = new Float32Array(count);
  const spinAxis = new Float32Array(count * 3);
  const spinRate = new Float32Array(count);

  const axVec = new THREE.Vector3();
  let i = 0;
  let guard = 0;
  while (i < count && guard < count * 25) {
    guard++;
    const aAu = 2.0 + rand() * 1.5; // 2.0 - 3.5 AU main belt
    if (rand() > beltDensity(aAu)) continue;

    const ecc = Math.min(0.35, Math.abs(gauss(rand)) * 0.12);
    const inc = Math.min((30 * Math.PI) / 180, Math.abs(gauss(rand)) * ((7 * Math.PI) / 180));
    const periodYears = Math.pow(aAu, 1.5);

    aUnits[i] = aAu * AU_TO_UNITS;
    e[i] = ecc;
    iRad[i] = inc;
    nodeRad[i] = rand() * Math.PI * 2;
    argRad[i] = rand() * Math.PI * 2;
    m0Rad[i] = rand() * Math.PI * 2;
    meanMotion[i] = (Math.PI * 2) / (periodYears * YEAR_MS);
    variant[i] = Math.floor(rand() * VARIANTS);

    // compositional gradient: inner belt → stony S/M/V types,
    // outer belt → carbonaceous C/D types (matches real asteroid distribution)
    const innerness = (3.5 - aAu) / 1.5; // 1 at 2.0 AU, 0 at 3.5 AU
    if (rand() < innerness) {
      // stony types (S, M, V) - indices 2-6
      textureIndex[i] = 2 + Math.floor(rand() * 5);
    } else {
      // carbonaceous types (C, D) - indices 0-1, 7-9
      textureIndex[i] = rand() < 0.5 ? Math.floor(rand() * 2) : 7 + Math.floor(rand() * 3);
    }

    // Realistic size distribution: power-law with more variety
    const sizeRoll = rand();
    if (sizeRoll < 0.65) {
      // tiny debris (65%)
      scale[i] = 0.0015 + rand() * 0.0035;
    } else if (sizeRoll < 0.85) {
      // small rocks (20%)
      scale[i] = 0.005 + rand() * 0.007;
    } else if (sizeRoll < 0.95) {
      // medium asteroids (10%)
      scale[i] = 0.012 + rand() * 0.013;
    } else if (sizeRoll < 0.99) {
      // large asteroids (4%)
      scale[i] = 0.025 + rand() * 0.025;
    } else {
      // very large boulders (1%)
      scale[i] = 0.05 + rand() * 0.07;
    }

    axVec.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    spinAxis[i * 3] = axVec.x;
    spinAxis[i * 3 + 1] = axVec.y;
    spinAxis[i * 3 + 2] = axVec.z;
    spinRate[i] = ((rand() * 2 - 1) * (Math.PI / (2 + rand() * 10))) / 3_600_000; // slow tumble

    i++;
  }

  return {
    count: i,
    aUnits: aUnits.subarray(0, i),
    e: e.subarray(0, i),
    iRad: iRad.subarray(0, i),
    nodeRad: nodeRad.subarray(0, i),
    argRad: argRad.subarray(0, i),
    m0Rad: m0Rad.subarray(0, i),
    meanMotion: meanMotion.subarray(0, i),
    variant: variant.subarray(0, i),
    textureIndex: textureIndex.subarray(0, i),
    scale: scale.subarray(0, i),
    spinAxis: spinAxis.subarray(0, i * 3),
    spinRate: spinRate.subarray(0, i),
  };
}

function normAngle(a: number): number {
  return a - Math.floor(a / (Math.PI * 2)) * Math.PI * 2;
}

/** Heliocentric position of asteroid `i` at `timeMs`, scene units, EQJ-mapped. */
export function asteroidPositionUnits(
  f: AsteroidField,
  i: number,
  timeMs: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  const a = f.aUnits[i];
  const e = f.e[i];
  const M = normAngle(f.m0Rad[i] + f.meanMotion[i] * timeMs);

  let E = M;
  for (let k = 0; k < 4; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const r = a * (1 - e * cosE);
  const nu = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);

  const cosO = Math.cos(f.nodeRad[i]);
  const sinO = Math.sin(f.nodeRad[i]);
  const cosI = Math.cos(f.iRad[i]);
  const sinI = Math.sin(f.iRad[i]);
  const wv = f.argRad[i] + nu;
  const cosWv = Math.cos(wv);
  const sinWv = Math.sin(wv);

  // perifocal -> ecliptic (X toward reference node, Z toward ecliptic pole)
  const xEcl = r * (cosO * cosWv - sinO * sinWv * cosI);
  const yEcl = r * (sinO * cosWv + cosO * sinWv * cosI);
  const zEcl = r * (sinWv * sinI);

  // ecliptic -> EQJ (rotate about X by obliquity)
  const xEq = xEcl;
  const yEq = yEcl * COS_EPS - zEcl * SIN_EPS;
  const zEq = yEcl * SIN_EPS + zEcl * COS_EPS;

  // EQJ -> scene: (x, y, z) -> (x, z, -y), matching every other body
  return target.set(xEq, zEq, -yEq);
}
