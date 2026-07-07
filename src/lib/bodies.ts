import { EARTH_RADIUS_KM } from "./constants";

export type BodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "moon"
  | "mars"
  | "jupiter"
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "saturn"
  | "mimas"
  | "enceladus"
  | "tethys"
  | "dione"
  | "rhea"
  | "titan"
  | "iapetus"
  | "uranus"
  | "neptune"
  | "triton"
  | "voyager1"
  | "voyager2"
  | "newhorizons"
  | "jwst"
  | "parker";

export type BodyType = "star" | "planet" | "moon" | "craft";

/** circular-orbit approximation for moons astronomy-engine doesn't cover */
export interface ApproxOrbit {
  /** semi-major axis, km */
  aKm: number;
  /** sidereal period, days (negative = retrograde) */
  periodDays: number;
  /** arbitrary-but-stable phase offset, rad */
  phase: number;
}

export interface BodyDef {
  id: BodyId;
  label: string;
  type: BodyType;
  parent: BodyId | null;
  /** scene units (Earth radii) */
  radius: number;
  /** texture in /textures, if any (else flat color) */
  texture?: string;
  /** marker + untextured-mesh color */
  color: string;
  /** north-pole direction, EQJ RA/Dec degrees (drives axial tilt + moon/ring planes) */
  poleRaDeg?: number;
  poleDecDeg?: number;
  /** sidereal rotation period, hours (negative = retrograde spin) */
  rotationHours?: number;
  /** subtle limb color for the shared planet shader */
  rim?: string;
  ringed?: boolean;
  approxOrbit?: ApproxOrbit;
  /** spacecraft only: for the ticker's years-in-flight line */
  launchYear?: number;
}

const KM = 1 / EARTH_RADIUS_KM;

export const BODIES: Record<BodyId, BodyDef> = {
  sun: {
    id: "sun",
    label: "Sun",
    type: "star",
    parent: null,
    radius: 696000 * KM, // 109.2
    texture: "8k_sun.jpg",
    color: "#ffb000",
    poleRaDeg: 286.13,
    poleDecDeg: 63.87,
    rotationHours: 609.12,
  },
  mercury: {
    id: "mercury",
    label: "Mercury",
    type: "planet",
    parent: "sun",
    radius: 2439.7 * KM,
    texture: "8k_mercury.jpg",
    color: "#9c9488",
    poleRaDeg: 281.01,
    poleDecDeg: 61.42,
    rotationHours: 1407.6,
    rim: "#6b655c",
  },
  venus: {
    id: "venus",
    label: "Venus",
    type: "planet",
    parent: "sun",
    radius: 6051.8 * KM,
    texture: "4k_venus_atmosphere.jpg",
    color: "#e8c88a",
    poleRaDeg: 272.76,
    poleDecDeg: 67.16,
    rotationHours: -5832.5,
    rim: "#f0d9a8",
  },
  earth: {
    id: "earth",
    label: "Earth",
    type: "planet",
    parent: "sun",
    radius: 1,
    color: "#7dd3fc",
    poleRaDeg: 0,
    poleDecDeg: 90,
  },
  moon: {
    id: "moon",
    label: "Moon",
    type: "moon",
    parent: "earth",
    radius: 1737.4 * KM,
    texture: "moon_8k.jpg",
    color: "#c8c4bd",
  },
  mars: {
    id: "mars",
    label: "Mars",
    type: "planet",
    parent: "sun",
    radius: 3389.5 * KM,
    texture: "8k_mars.jpg",
    color: "#e0855a",
    poleRaDeg: 317.68,
    poleDecDeg: 52.89,
    rotationHours: 24.62,
    rim: "#c97b52",
  },
  jupiter: {
    id: "jupiter",
    label: "Jupiter",
    type: "planet",
    parent: "sun",
    radius: 69911 * KM, // 10.97
    texture: "8k_jupiter.jpg",
    color: "#d8b28a",
    poleRaDeg: 268.06,
    poleDecDeg: 64.5,
    rotationHours: 9.925,
    rim: "#e8caa2",
  },
  io: {
    id: "io",
    label: "Io",
    type: "moon",
    parent: "jupiter",
    radius: 1821.6 * KM,
    color: "#d8b520",
  },
  europa: {
    id: "europa",
    label: "Europa",
    type: "moon",
    parent: "jupiter",
    radius: 1560.8 * KM,
    color: "#c9b8a4",
  },
  ganymede: {
    id: "ganymede",
    label: "Ganymede",
    type: "moon",
    parent: "jupiter",
    radius: 2634.1 * KM,
    color: "#9a8d7d",
  },
  callisto: {
    id: "callisto",
    label: "Callisto",
    type: "moon",
    parent: "jupiter",
    radius: 2410.3 * KM,
    color: "#6e6459",
  },
  saturn: {
    id: "saturn",
    label: "Saturn",
    type: "planet",
    parent: "sun",
    radius: 60268 * KM, // 9.46
    texture: "8k_saturn.jpg",
    color: "#e3cfa2",
    poleRaDeg: 40.59,
    poleDecDeg: 83.54,
    rotationHours: 10.66,
    rim: "#f0e0b8",
    ringed: true,
  },
  mimas: {
    id: "mimas",
    label: "Mimas",
    type: "moon",
    parent: "saturn",
    radius: 198.2 * KM,
    color: "#b8b4ae",
    approxOrbit: { aKm: 185539, periodDays: 0.942, phase: 0.7 },
  },
  enceladus: {
    id: "enceladus",
    label: "Enceladus",
    type: "moon",
    parent: "saturn",
    radius: 252.1 * KM,
    color: "#e8ecec",
    approxOrbit: { aKm: 238042, periodDays: 1.37, phase: 2.1 },
  },
  tethys: {
    id: "tethys",
    label: "Tethys",
    type: "moon",
    parent: "saturn",
    radius: 531.1 * KM,
    color: "#cfccc4",
    approxOrbit: { aKm: 294672, periodDays: 1.888, phase: 3.6 },
  },
  dione: {
    id: "dione",
    label: "Dione",
    type: "moon",
    parent: "saturn",
    radius: 561.4 * KM,
    color: "#c4bfb6",
    approxOrbit: { aKm: 377415, periodDays: 2.737, phase: 5.0 },
  },
  rhea: {
    id: "rhea",
    label: "Rhea",
    type: "moon",
    parent: "saturn",
    radius: 763.8 * KM,
    color: "#bdb8ae",
    approxOrbit: { aKm: 527068, periodDays: 4.518, phase: 0.4 },
  },
  titan: {
    id: "titan",
    label: "Titan",
    type: "moon",
    parent: "saturn",
    radius: 2574.7 * KM,
    color: "#d9a441",
    approxOrbit: { aKm: 1221870, periodDays: 15.945, phase: 1.9 },
  },
  iapetus: {
    id: "iapetus",
    label: "Iapetus",
    type: "moon",
    parent: "saturn",
    radius: 734.5 * KM,
    color: "#8f8578",
    approxOrbit: { aKm: 3560840, periodDays: 79.33, phase: 4.2 },
  },
  uranus: {
    id: "uranus",
    label: "Uranus",
    type: "planet",
    parent: "sun",
    radius: 25362 * KM,
    texture: "2k_uranus.jpg",
    color: "#a9d8dd",
    poleRaDeg: 257.31,
    poleDecDeg: -15.18,
    rotationHours: -17.24,
    rim: "#c2e6ea",
  },
  neptune: {
    id: "neptune",
    label: "Neptune",
    type: "planet",
    parent: "sun",
    radius: 24622 * KM,
    texture: "2k_neptune.jpg",
    color: "#5a8de0",
    poleRaDeg: 299.36,
    poleDecDeg: 43.46,
    rotationHours: 16.11,
    rim: "#7ba6ec",
  },
  triton: {
    id: "triton",
    label: "Triton",
    type: "moon",
    parent: "neptune",
    radius: 1353.4 * KM,
    color: "#cbd4d8",
    approxOrbit: { aKm: 354759, periodDays: -5.877, phase: 2.8 },
  },
  voyager1: {
    id: "voyager1",
    label: "Voyager 1",
    type: "craft",
    parent: "sun",
    radius: 0.002,
    color: "#9fd7ff",
    launchYear: 1977,
  },
  voyager2: {
    id: "voyager2",
    label: "Voyager 2",
    type: "craft",
    parent: "sun",
    radius: 0.002,
    color: "#8fc0e8",
    launchYear: 1977,
  },
  newhorizons: {
    id: "newhorizons",
    label: "New Horizons",
    type: "craft",
    parent: "sun",
    radius: 0.002,
    color: "#ffd27d",
    launchYear: 2006,
  },
  jwst: {
    id: "jwst",
    label: "JWST",
    type: "craft",
    parent: "sun",
    radius: 0.002,
    color: "#ffb000",
    launchYear: 2021,
  },
  parker: {
    id: "parker",
    label: "Parker Solar Probe",
    type: "craft",
    parent: "sun",
    radius: 0.002,
    color: "#ff8a5c",
    launchYear: 2018,
  },
};

export const BODY_IDS = Object.keys(BODIES) as BodyId[];
export const PLANET_IDS = BODY_IDS.filter((id) => BODIES[id].type === "planet");
export const MOON_IDS = BODY_IDS.filter((id) => BODIES[id].type === "moon");
export const CRAFT_IDS = BODY_IDS.filter((id) => BODIES[id].type === "craft");

/** camera closer than this -> body takes focus */
export function handoffIn(id: BodyId): number {
  const b = BODIES[id];
  if (b.type === "star") return 800;
  if (b.type === "planet") return Math.max(6, b.radius * 12);
  if (b.type === "craft") return 1.2;
  return Math.max(1.5, b.radius * 10);
}

/** camera farther than this -> focus climbs to parent */
export function releaseRadius(id: BodyId): number {
  const b = BODIES[id];
  if (b.type === "star") return Infinity;
  if (b.type === "planet") return Math.max(45, b.radius * 60);
  if (b.type === "craft") return 15;
  return Math.max(20, b.radius * 60);
}

export function minCameraDistance(id: BodyId): number {
  if (BODIES[id].type === "craft") return 0.02;
  return Math.max(0.02, BODIES[id].radius * 1.25);
}

export function viewDistance(id: BodyId): number {
  if (BODIES[id].type === "craft") return 0.35;
  return Math.max(0.5, BODIES[id].radius * 3.4);
}
