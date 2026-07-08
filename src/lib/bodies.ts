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
  | "parker"
  | "ceres"
  | "vesta"
  | "pallas"
  | "hygiea"
  | "interamnia"
  | "davida"
  | "blackhole";

export type BodyType = "star" | "planet" | "moon" | "craft" | "asteroid" | "blackhole";

/** circular-orbit approximation for moons astronomy-engine doesn't cover */
export interface ApproxOrbit {
  /** semi-major axis, km */
  aKm: number;
  /** sidereal period, days (negative = retrograde) */
  periodDays: number;
  /** arbitrary-but-stable phase offset, rad */
  phase: number;
}

/** heliocentric Keplerian elements (J2000 ecliptic) for minor bodies that
 *  astronomy-engine doesn't ship. Mean motion is derived from `aAu`. */
export interface HelioElements {
  aAu: number;
  e: number;
  iDeg: number;
  nodeDeg: number;
  argDeg: number;
  m0Deg: number;
  /** epoch of m0, ms since Unix epoch (J2000 = 946728000000) */
  epochMs: number;
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
  /** minor bodies: heliocentric orbit driven by these elements */
  helioElements?: HelioElements;
  /** deep-space object pinned at a fixed heliocentric point, scene units */
  fixedHelioUnits?: [number, number, number];
  /** asteroid only: which downloaded rock texture set (0-9) to skin it with */
  rockIndex?: number;
  /** spacecraft only: for the ticker's years-in-flight line */
  launchYear?: number;
}

const KM = 1 / EARTH_RADIUS_KM;

// Direction of Sagittarius A* (galactic centre) mapped into scene coords, and
// the distance we pin our black hole out at -- deep space, but reachable.
const SGRA_DIR = ((): [number, number, number] => {
  const ra = (266.417 * Math.PI) / 180;
  const dec = (-28.936 * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return [x, z, -y]; // EQJ -> scene (x, z, -y)
})();
const BH_DIST = 600000;

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

  // Main-belt dwarf planet + the largest asteroids: real orbits, visitable and
  // focusable exactly like the planets, skinned with the real rock textures.
  ceres: {
    id: "ceres",
    label: "Ceres",
    type: "asteroid",
    parent: "sun",
    radius: 469.7 * KM,
    color: "#8a8178",
    rotationHours: 9.074,
    rockIndex: 9,
    helioElements: { aAu: 2.7691, e: 0.076, iDeg: 10.594, nodeDeg: 80.393, argDeg: 73.597, m0Deg: 95.989, epochMs: 946728000000 },
  },
  vesta: {
    id: "vesta",
    label: "Vesta",
    type: "asteroid",
    parent: "sun",
    radius: 262.7 * KM,
    color: "#b7a98f",
    rotationHours: 5.342,
    rockIndex: 6,
    helioElements: { aAu: 2.3615, e: 0.0887, iDeg: 7.14, nodeDeg: 103.81, argDeg: 151.2, m0Deg: 307.8, epochMs: 946728000000 },
  },
  pallas: {
    id: "pallas",
    label: "Pallas",
    type: "asteroid",
    parent: "sun",
    radius: 256 * KM,
    color: "#9a978f",
    rotationHours: 7.813,
    rockIndex: 2,
    helioElements: { aAu: 2.7721, e: 0.2302, iDeg: 34.837, nodeDeg: 173.024, argDeg: 310.202, m0Deg: 40.6, epochMs: 946728000000 },
  },
  hygiea: {
    id: "hygiea",
    label: "Hygiea",
    type: "asteroid",
    parent: "sun",
    radius: 217 * KM,
    color: "#6f6a61",
    rotationHours: 13.83,
    rockIndex: 0,
    helioElements: { aAu: 3.1415, e: 0.1125, iDeg: 3.8316, nodeDeg: 283.2, argDeg: 312.3, m0Deg: 152.2, epochMs: 946728000000 },
  },
  interamnia: {
    id: "interamnia",
    label: "Interamnia",
    type: "asteroid",
    parent: "sun",
    radius: 166 * KM,
    color: "#7c766c",
    rotationHours: 8.727,
    rockIndex: 8,
    helioElements: { aAu: 3.0627, e: 0.1553, iDeg: 17.3, nodeDeg: 280.3, argDeg: 95.7, m0Deg: 200, epochMs: 946728000000 },
  },
  davida: {
    id: "davida",
    label: "Davida",
    type: "asteroid",
    parent: "sun",
    radius: 145 * KM,
    color: "#a3937a",
    rotationHours: 5.129,
    rockIndex: 3,
    helioElements: { aAu: 3.1685, e: 0.1861, iDeg: 15.938, nodeDeg: 107.6, argDeg: 337.2, m0Deg: 100, epochMs: 946728000000 },
  },

  // A visitable black hole, pinned in the direction of Sagittarius A*. Fly to
  // it and orbit it like any body; the render (BlackHole.tsx) gives the disk.
  blackhole: {
    id: "blackhole",
    label: "Sagittarius A*",
    type: "blackhole",
    parent: "sun",
    radius: 60, // event-horizon radius, scene units (a deliberately dramatic size)
    color: "#c9a3ff",
    fixedHelioUnits: [SGRA_DIR[0] * BH_DIST, SGRA_DIR[1] * BH_DIST, SGRA_DIR[2] * BH_DIST],
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
  if (b.type === "asteroid") return Math.max(2.5, b.radius * 25);
  if (b.type === "blackhole") return b.radius * 30;
  return Math.max(1.5, b.radius * 10);
}

/** camera farther than this -> focus climbs to parent */
export function releaseRadius(id: BodyId): number {
  const b = BODIES[id];
  if (b.type === "star") return Infinity;
  if (b.type === "planet") return Math.max(45, b.radius * 60);
  if (b.type === "craft") return 15;
  if (b.type === "asteroid") return Math.max(30, b.radius * 120);
  if (b.type === "blackhole") return b.radius * 200;
  return Math.max(20, b.radius * 60);
}

export function minCameraDistance(id: BodyId): number {
  if (BODIES[id].type === "craft") return 0.02;
  // never let the camera cross the event horizon
  if (BODIES[id].type === "blackhole") return BODIES[id].radius * 1.15;
  return Math.max(0.02, BODIES[id].radius * 1.25);
}

export function viewDistance(id: BodyId): number {
  const b = BODIES[id];
  if (b.type === "craft") return 0.35;
  // asteroids are small: pull the camera in close so the stone fills the view
  if (b.type === "asteroid") return Math.max(0.12, b.radius * 3);
  // frame the whole accretion disk, which extends to ~4.3x the horizon radius
  if (b.type === "blackhole") return b.radius * 9;
  return Math.max(0.5, b.radius * 3.4);
}
