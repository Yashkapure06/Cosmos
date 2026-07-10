// Shared celestial-sphere helpers: real-star catalog loading, constellation
// data, zodiac math, deep-sky objects and meteor-shower radiants.
//
// Star + constellation data: d3-celestial (BSD-3, Olaf Frohn), built from the
// Hipparcos / Yale Bright Star catalogues -- real RA/Dec/magnitude/B-V.

import * as THREE from "three";

/** RA/Dec (degrees, EQJ) -> unit direction in scene coords (x, z, -y) */
export function raDecToDir(raDeg: number, decDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return out.set(x, z, -y);
}

/** B-V colour index -> approximate star RGB (blackbody-ish) */
export function bvToColor(bv: number, out: THREE.Color): THREE.Color {
  const t = THREE.MathUtils.clamp((bv + 0.4) / 2.4, 0, 1); // -0.4 (blue) .. 2.0 (red)
  // piecewise blend through the familiar stellar sequence
  if (t < 0.35) return out.setRGB(0.67 + t * 0.6, 0.78 + t * 0.35, 1.0).multiplyScalar(1);
  if (t < 0.6) {
    const k = (t - 0.35) / 0.25;
    return out.setRGB(0.88 + k * 0.12, 0.9 + k * 0.06, 1.0 - k * 0.12);
  }
  const k = (t - 0.6) / 0.4;
  return out.setRGB(1.0, 0.96 - k * 0.35, 0.88 - k * 0.55);
}

export interface CatalogStar {
  raDeg: number;
  decDeg: number;
  mag: number;
  bv: number;
}

interface StarFeature {
  properties: { mag: number; bv: string | number };
  geometry: { coordinates: [number, number] };
}

export async function loadStars(): Promise<CatalogStar[]> {
  const res = await fetch("/data/stars6.json");
  const json = (await res.json()) as { features: StarFeature[] };
  return json.features.map((f) => {
    let ra = f.geometry.coordinates[0];
    if (ra < 0) ra += 360; // d3-celestial stores RA as -180..180
    return {
      raDeg: ra,
      decDeg: f.geometry.coordinates[1],
      mag: f.properties.mag,
      bv: Number(f.properties.bv) || 0,
    };
  });
}

export interface ConstellationLines {
  id: string;
  /** polylines of [raDeg, decDeg] */
  lines: [number, number][][];
}

export interface ConstellationName {
  id: string;
  name: string;
  /** label anchor [raDeg, decDeg] */
  at: [number, number];
}

export async function loadConstellations(): Promise<{
  lines: ConstellationLines[];
  names: ConstellationName[];
}> {
  const [linesRes, namesRes] = await Promise.all([
    fetch("/data/constellations.lines.json"),
    fetch("/data/constellations.json"),
  ]);
  const linesJson = (await linesRes.json()) as {
    features: { id: string; geometry: { coordinates: [number, number][][] } }[];
  };
  const namesJson = (await namesRes.json()) as {
    features: {
      id: string;
      properties: { name: string };
      geometry: { coordinates: [number, number] };
    }[];
  };
  const fix = (ra: number) => (ra < 0 ? ra + 360 : ra);
  return {
    lines: linesJson.features.map((f) => ({
      id: f.id,
      lines: f.geometry.coordinates.map((line) =>
        line.map(([ra, dec]) => [fix(ra), dec] as [number, number]),
      ),
    })),
    names: namesJson.features.map((f) => ({
      id: f.id,
      name: f.properties.name,
      at: [fix(f.geometry.coordinates[0]), f.geometry.coordinates[1]],
    })),
  };
}

/** the 12 zodiac constellations (the sun's path crosses a 13th, Ophiuchus) */
export const ZODIAC_IDS = new Set([
  "Ari", "Tau", "Gem", "Cnc", "Leo", "Vir", "Lib", "Sco", "Sgr", "Cap", "Aqr", "Psc",
]);

export interface DeepSkyObject {
  id: string;
  label: string;
  raDeg: number;
  decDeg: number;
  /** angular size on the sky shell, scene units at shell radius */
  size: number;
  kind: "galaxy" | "nebula" | "cluster";
  tint: string;
  /** for galaxies: elongation + position angle */
  stretch?: number;
  angle?: number;
}

export const DEEP_SKY: DeepSkyObject[] = [
  { id: "m31", label: "Andromeda Galaxy", raDeg: 10.68, decDeg: 41.27, size: 640, kind: "galaxy", tint: "#d8d2e8", stretch: 2.6, angle: 0.66 },
  { id: "m42", label: "Orion Nebula", raDeg: 83.82, decDeg: -5.39, size: 300, kind: "nebula", tint: "#e88ab0" },
  { id: "m45", label: "Pleiades", raDeg: 56.87, decDeg: 24.11, size: 300, kind: "cluster", tint: "#9fc4ff" },
  { id: "lmc", label: "Large Magellanic Cloud", raDeg: 80.89, decDeg: -69.76, size: 760, kind: "galaxy", tint: "#c8c2d8", stretch: 1.5, angle: 0.3 },
  { id: "smc", label: "Small Magellanic Cloud", raDeg: 13.16, decDeg: -72.8, size: 420, kind: "galaxy", tint: "#bfb9cf", stretch: 1.4, angle: 1.1 },
  { id: "omegacen", label: "Omega Centauri", raDeg: 201.7, decDeg: -47.48, size: 220, kind: "cluster", tint: "#ffe8c8" },
];

export interface MeteorShower {
  id: string;
  label: string;
  raDeg: number;
  decDeg: number;
  /** active window: [month(1-12), day] inclusive */
  from: [number, number];
  to: [number, number];
  /** peak for the label */
  peak: string;
}

export const METEOR_SHOWERS: MeteorShower[] = [
  { id: "qua", label: "Quadrantids", raDeg: 230, decDeg: 49, from: [12, 28], to: [1, 12], peak: "Jan 3" },
  { id: "lyr", label: "Lyrids", raDeg: 271, decDeg: 34, from: [4, 14], to: [4, 30], peak: "Apr 22" },
  { id: "eta", label: "Eta Aquariids", raDeg: 338, decDeg: -1, from: [4, 19], to: [5, 28], peak: "May 5" },
  { id: "per", label: "Perseids", raDeg: 48, decDeg: 58, from: [7, 17], to: [8, 24], peak: "Aug 12" },
  { id: "ori", label: "Orionids", raDeg: 95, decDeg: 16, from: [10, 2], to: [11, 7], peak: "Oct 21" },
  { id: "leo", label: "Leonids", raDeg: 152, decDeg: 22, from: [11, 6], to: [11, 30], peak: "Nov 17" },
  { id: "gem", label: "Geminids", raDeg: 112, decDeg: 33, from: [12, 4], to: [12, 17], peak: "Dec 14" },
];

/** is a shower active at the given sim time (UTC month/day window, wraps NYE) */
export function showerActive(s: MeteorShower, timeMs: number): boolean {
  const d = new Date(timeMs);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const v = m * 100 + day;
  const a = s.from[0] * 100 + s.from[1];
  const b = s.to[0] * 100 + s.to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
}
