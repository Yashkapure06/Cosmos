import { EARTH_RADIUS_KM } from "./constants";

export type BodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "moon"
  | "mars"
  | "phobos"
  | "deimos"
  | "jupiter"
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "amalthea"
  | "saturn"
  | "mimas"
  | "enceladus"
  | "tethys"
  | "dione"
  | "rhea"
  | "titan"
  | "hyperion"
  | "iapetus"
  | "phoebe"
  | "uranus"
  | "miranda"
  | "ariel"
  | "umbriel"
  | "titania"
  | "oberon"
  | "neptune"
  | "triton"
  | "pluto"
  | "charon"
  | "nix"
  | "hydra"
  | "eris"
  | "haumea"
  | "makemake"
  | "sedna"
  | "halley"
  | "churyumov"
  | "trappist1"
  | "trappist1b"
  | "trappist1c"
  | "trappist1d"
  | "trappist1e"
  | "trappist1f"
  | "trappist1g"
  | "trappist1h"
  | "proxima"
  | "proximab"
  | "proximad"
  | "alphacenA"
  | "alphacenB"
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

export type BodyType = "star" | "planet" | "moon" | "craft" | "asteroid" | "comet" | "blackhole";

/** ring system: a photographic strip texture (Saturn) or procedural bands */
export interface RingDef {
  innerKm: number;
  outerKm: number;
  /** strip texture in /textures (inner->outer along U); else bands are used */
  texture?: string;
  /** procedural bands: [uCenter 0-1, uHalfWidth, alpha] painted over `color` */
  bands?: [number, number, number][];
  /** band tint for procedural rings */
  color?: string;
}

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
  rings?: RingDef;
  /** non-spherical bodies (Haumea): per-axis scale applied to the sphere mesh */
  ellipsoid?: [number, number, number];
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

// fixed deep-space anchor from RA/Dec + a (compressed) distance, scene units
function fixedAt(raDeg: number, decDeg: number, units: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return [x * units, z * units, -y * units]; // EQJ -> scene
}

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
  phobos: {
    id: "phobos",
    label: "Phobos",
    type: "moon",
    parent: "mars",
    radius: 11.1 * KM,
    color: "#8a7f74",
    rockIndex: 7,
    approxOrbit: { aKm: 9376, periodDays: 0.3189, phase: 1.3 },
  },
  deimos: {
    id: "deimos",
    label: "Deimos",
    type: "moon",
    parent: "mars",
    radius: 6.2 * KM,
    color: "#9c9184",
    rockIndex: 1,
    approxOrbit: { aKm: 23463, periodDays: 1.2624, phase: 4.4 },
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
    // faint dusty main ring (Voyager/Galileo): barely-there amber sheen
    rings: {
      innerKm: 122500,
      outerKm: 129000,
      color: "#c8a888",
      bands: [
        [0.5, 0.5, 0.05],
        [0.88, 0.12, 0.1],
      ],
    },
  },
  amalthea: {
    id: "amalthea",
    label: "Amalthea",
    type: "moon",
    parent: "jupiter",
    radius: 83.5 * KM,
    color: "#b5624a",
    rockIndex: 8,
    approxOrbit: { aKm: 181366, periodDays: 0.4982, phase: 3.1 },
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
    rings: { innerKm: 74658, outerKm: 136775, texture: "8k_saturn_ring_alpha.png" },
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
  hyperion: {
    id: "hyperion",
    label: "Hyperion",
    type: "moon",
    parent: "saturn",
    radius: 135 * KM,
    color: "#c2a37a",
    rockIndex: 5,
    approxOrbit: { aKm: 1481010, periodDays: 21.277, phase: 5.6 },
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
  phoebe: {
    id: "phoebe",
    label: "Phoebe",
    type: "moon",
    parent: "saturn",
    radius: 106.5 * KM,
    color: "#5a544c",
    rockIndex: 0,
    // retrograde irregular: negative period flips the orbit direction
    approxOrbit: { aKm: 12947780, periodDays: -550.56, phase: 2.4 },
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
    // narrow charcoal rings; epsilon (outermost) is by far the brightest
    rings: {
      innerKm: 38000,
      outerKm: 51400,
      color: "#9aa5aa",
      bands: [
        [0.15, 0.12, 0.04], // zeta: broad faint dust sheet
        [0.286, 0.004, 0.3], // 6
        [0.316, 0.004, 0.3], // 5
        [0.341, 0.004, 0.3], // 4
        [0.501, 0.005, 0.42], // alpha
        [0.572, 0.005, 0.42], // beta
        [0.685, 0.004, 0.35], // eta
        [0.718, 0.004, 0.4], // gamma
        [0.769, 0.005, 0.45], // delta
        [0.897, 0.003, 0.22], // lambda
        [0.981, 0.008, 0.85], // epsilon
      ],
    },
  },
  miranda: {
    id: "miranda",
    label: "Miranda",
    type: "moon",
    parent: "uranus",
    radius: 235.8 * KM,
    color: "#c5c9c7",
    approxOrbit: { aKm: 129390, periodDays: 1.4135, phase: 0.9 },
  },
  ariel: {
    id: "ariel",
    label: "Ariel",
    type: "moon",
    parent: "uranus",
    radius: 578.9 * KM,
    color: "#b9bdba",
    approxOrbit: { aKm: 190900, periodDays: 2.52, phase: 2.6 },
  },
  umbriel: {
    id: "umbriel",
    label: "Umbriel",
    type: "moon",
    parent: "uranus",
    radius: 584.7 * KM,
    color: "#6d6f6e",
    approxOrbit: { aKm: 266000, periodDays: 4.144, phase: 4.1 },
  },
  titania: {
    id: "titania",
    label: "Titania",
    type: "moon",
    parent: "uranus",
    radius: 788.4 * KM,
    color: "#a9a49b",
    approxOrbit: { aKm: 435910, periodDays: 8.706, phase: 5.5 },
  },
  oberon: {
    id: "oberon",
    label: "Oberon",
    type: "moon",
    parent: "uranus",
    radius: 761.4 * KM,
    color: "#968f85",
    approxOrbit: { aKm: 583520, periodDays: 13.463, phase: 1.1 },
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
    // dusty rings: Galle, LeVerrier, Lassell/Arago sheet, clumpy Adams
    rings: {
      innerKm: 41900,
      outerKm: 62930,
      color: "#8fa3c0",
      bands: [
        [0.024, 0.024, 0.08], // Galle: broad, faint
        [0.537, 0.004, 0.32], // LeVerrier
        [0.63, 0.09, 0.06], // Lassell dust sheet out to Arago
        [0.727, 0.003, 0.18], // Arago
        [0.998, 0.005, 0.5], // Adams (arcs live here)
      ],
    },
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

  // Pluto system: Pluto itself rides astronomy-engine's real ephemeris; the
  // moons circle in Pluto's (heavily tilted) equatorial plane, which is also
  // Charon's true orbit plane -- the pair is mutually tidally locked.
  pluto: {
    id: "pluto",
    label: "Pluto",
    type: "planet",
    parent: "sun",
    radius: 1188.3 * KM,
    texture: "2k_pluto.jpg",
    color: "#cbb598",
    poleRaDeg: 132.99,
    poleDecDeg: -6.16,
    rotationHours: -153.29,
    rim: "#d8c8b0",
  },
  charon: {
    id: "charon",
    label: "Charon",
    type: "moon",
    parent: "pluto",
    radius: 606 * KM,
    color: "#a49a92",
    approxOrbit: { aKm: 19591, periodDays: 6.3872, phase: 0.6 },
  },
  nix: {
    id: "nix",
    label: "Nix",
    type: "moon",
    parent: "pluto",
    radius: 20 * KM,
    color: "#c9c2b8",
    rockIndex: 4,
    approxOrbit: { aKm: 48694, periodDays: 24.855, phase: 3.9 },
  },
  hydra: {
    id: "hydra",
    label: "Hydra",
    type: "moon",
    parent: "pluto",
    radius: 19 * KM,
    color: "#bfb9ae",
    rockIndex: 6,
    approxOrbit: { aKm: 64738, periodDays: 38.202, phase: 1.7 },
  },

  // Trans-Neptunian dwarf planets on real Keplerian elements. Textures for
  // Eris/Haumea/Makemake are the Solar System Scope "fictional" maps (CC BY);
  // no spacecraft has ever imaged them up close.
  eris: {
    id: "eris",
    label: "Eris",
    type: "planet",
    parent: "sun",
    radius: 1163 * KM,
    texture: "2k_eris_fictional.jpg",
    color: "#d8dde2",
    rotationHours: 378.9, // tidally locked to Dysnomia
    rim: "#e2e8ee",
    helioElements: { aAu: 67.86, e: 0.4358, iDeg: 44.04, nodeDeg: 35.95, argDeg: 151.64, m0Deg: 205.99, epochMs: 946728000000 },
  },
  haumea: {
    id: "haumea",
    label: "Haumea",
    type: "planet",
    parent: "sun",
    radius: 1161 * KM, // longest semi-axis; ellipsoid squashes the rest
    texture: "2k_haumea_fictional.jpg",
    color: "#d9d5cd",
    rotationHours: 3.9155, // fastest-spinning large body known: hence the egg
    ellipsoid: [1, 0.442, 0.734],
    helioElements: { aAu: 43.12, e: 0.196, iDeg: 28.21, nodeDeg: 122.16, argDeg: 238.8, m0Deg: 217.8, epochMs: 946728000000 },
  },
  makemake: {
    id: "makemake",
    label: "Makemake",
    type: "planet",
    parent: "sun",
    radius: 715 * KM,
    texture: "2k_makemake_fictional.jpg",
    color: "#c78b6a",
    rotationHours: 22.83,
    rim: "#d8a184",
    helioElements: { aAu: 45.43, e: 0.161, iDeg: 28.98, nodeDeg: 79.62, argDeg: 294.83, m0Deg: 165.5, epochMs: 946728000000 },
  },
  sedna: {
    id: "sedna",
    label: "Sedna",
    type: "planet",
    parent: "sun",
    radius: 500 * KM,
    color: "#c46a4a", // one of the reddest objects in the solar system
    rotationHours: 10.27,
    rim: "#d8836a",
    helioElements: { aAu: 506, e: 0.855, iDeg: 11.93, nodeDeg: 144.25, argDeg: 311.35, m0Deg: 358.16, epochMs: 946728000000 },
  },

  // Comets: nucleus + coma + anti-sunward tail (Comets.tsx). Tail activity
  // scales with heliocentric distance, so they light up near perihelion.
  halley: {
    id: "halley",
    label: "1P/Halley",
    type: "comet",
    parent: "sun",
    radius: 5.5 * KM,
    color: "#9fd8e8",
    rotationHours: 52.8,
    // retrograde (i > 90); perihelion 1986-02-09, period ~75.3 yr
    helioElements: { aAu: 17.834, e: 0.96714, iDeg: 162.26, nodeDeg: 58.42, argDeg: 111.33, m0Deg: 66.4, epochMs: 946728000000 },
  },
  churyumov: {
    id: "churyumov",
    label: "67P/Churyumov-Gerasimenko",
    type: "comet",
    parent: "sun",
    radius: 2.2 * KM,
    color: "#b8cad4",
    rotationHours: 12.4,
    // Rosetta's comet; period ~6.44 yr so it's often active
    helioElements: { aAu: 3.463, e: 0.6405, iDeg: 7.04, nodeDeg: 50.19, argDeg: 12.78, m0Deg: 221, epochMs: 946728000000 },
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

  // ------------------------------------------------------------------
  // Neighbouring star systems: real stars at their true sky directions
  // (distances compressed like the black hole -- light-years don't fit),
  // planets on their real orbits (NASA Exoplanet Archive params: real
  // semi-major axes, periods and radii). Fully explorable: fly to the star,
  // hand off to a planet, orbit it -- exactly like home.
  //
  // TRAPPIST-1 (40 ly, M8V): seven Earth-sized worlds. Transit system --
  // we see it edge-on, so the pole is set perpendicular to the line of sight.
  trappist1: {
    id: "trappist1",
    label: "TRAPPIST-1",
    type: "star",
    parent: "sun",
    radius: 82900 * KM, // 0.119 R_sun -- barely bigger than Jupiter
    color: "#ff8a5e",
    poleRaDeg: 346.62,
    poleDecDeg: 84.96,
    rotationHours: 79.2,
    fixedHelioUnits: fixedAt(346.62, -5.04, 12_000_000),
  },
  trappist1b: { id: "trappist1b", label: "TRAPPIST-1b", type: "planet", parent: "trappist1", radius: 7110 * KM, color: "#b5644a", rim: "#d8825e", rotationHours: 36.26, approxOrbit: { aKm: 1726000, periodDays: 1.5109, phase: 0.4 } },
  trappist1c: { id: "trappist1c", label: "TRAPPIST-1c", type: "planet", parent: "trappist1", radius: 6990 * KM, color: "#c28a5e", rim: "#dba876", rotationHours: 58.12, approxOrbit: { aKm: 2364000, periodDays: 2.4218, phase: 1.7 } },
  trappist1d: { id: "trappist1d", label: "TRAPPIST-1d", type: "planet", parent: "trappist1", radius: 5022 * KM, color: "#d8b48a", rim: "#e8cba6", rotationHours: 97.19, approxOrbit: { aKm: 3332000, periodDays: 4.0496, phase: 3.1 } },
  trappist1e: { id: "trappist1e", label: "TRAPPIST-1e", type: "planet", parent: "trappist1", radius: 5863 * KM, color: "#6a9ec4", rim: "#8fbcd8", rotationHours: 146.38, approxOrbit: { aKm: 4376000, periodDays: 6.0993, phase: 4.4 } },
  trappist1f: { id: "trappist1f", label: "TRAPPIST-1f", type: "planet", parent: "trappist1", radius: 6660 * KM, color: "#9ab4c8", rim: "#b4cdd8", rotationHours: 220.96, approxOrbit: { aKm: 5758000, periodDays: 9.2065, phase: 5.6 } },
  trappist1g: { id: "trappist1g", label: "TRAPPIST-1g", type: "planet", parent: "trappist1", radius: 7195 * KM, color: "#8aa6b8", rim: "#a8c2cf", rotationHours: 296.49, approxOrbit: { aKm: 7006000, periodDays: 12.3538, phase: 0.9 } },
  trappist1h: { id: "trappist1h", label: "TRAPPIST-1h", type: "planet", parent: "trappist1", radius: 4812 * KM, color: "#cfd8de", rim: "#e2e8ec", rotationHours: 450.41, approxOrbit: { aKm: 9259000, periodDays: 18.7671, phase: 2.3 } },

  // Proxima Centauri (4.24 ly, M5.5V): the nearest star to the Sun.
  proxima: {
    id: "proxima",
    label: "Proxima Centauri",
    type: "star",
    parent: "sun",
    radius: 107300 * KM,
    color: "#ff7a52",
    poleRaDeg: 217.43,
    poleDecDeg: 27.32,
    rotationHours: 1992,
    fixedHelioUnits: fixedAt(217.43, -62.68, 6_500_000),
  },
  proximab: { id: "proximab", label: "Proxima b", type: "planet", parent: "proxima", radius: 7000 * KM, color: "#7aa0b8", rim: "#98bccf", rotationHours: 268.4, approxOrbit: { aKm: 7266000, periodDays: 11.184, phase: 1.2 } },
  proximad: { id: "proximad", label: "Proxima d", type: "planet", parent: "proxima", radius: 5160 * KM, color: "#c8a888", rim: "#dbc2a4", rotationHours: 122.9, approxOrbit: { aKm: 4316000, periodDays: 5.122, phase: 4.8 } },

  // Alpha Centauri A + B (4.37 ly): the Sun's nearest Sun-like neighbours,
  // a true binary -- B rides a (circularised) 80-year orbit around A.
  alphacenA: {
    id: "alphacenA",
    label: "Alpha Centauri A",
    type: "star",
    parent: "sun",
    radius: 851000 * KM,
    color: "#fff1cf",
    poleRaDeg: 219.9,
    poleDecDeg: 29.17,
    rotationHours: 528,
    fixedHelioUnits: fixedAt(219.9, -60.83, 10_000_000),
  },
  alphacenB: {
    id: "alphacenB",
    label: "Alpha Centauri B",
    type: "star",
    parent: "alphacenA",
    radius: 600500 * KM,
    color: "#ffd9a0",
    poleRaDeg: 219.9,
    poleDecDeg: 29.17,
    rotationHours: 984,
    approxOrbit: { aKm: 3_520_000_000, periodDays: 29200, phase: 2.0 },
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
  if (b.type === "comet") return 2.5;
  if (b.type === "blackhole") return b.radius * 30;
  // tiny rock moons: a 1.5-unit floor would swallow their whole orbit
  // (Phobos circles Mars at ~1.47 units) and cause focus flapping
  if (b.type === "moon" && b.rockIndex !== undefined) return Math.max(0.15, b.radius * 20);
  return Math.max(1.5, b.radius * 10);
}

/** camera farther than this -> focus climbs to parent */
export function releaseRadius(id: BodyId): number {
  const b = BODIES[id];
  // remote stars release back to the Sun's frame; the Sun itself never does
  if (b.type === "star") return b.parent ? 60000 : Infinity;
  if (b.type === "planet") return Math.max(45, b.radius * 60);
  if (b.type === "craft") return 15;
  if (b.type === "asteroid") return Math.max(30, b.radius * 120);
  if (b.type === "comet") return 30;
  if (b.type === "blackhole") return b.radius * 200;
  if (b.type === "moon" && b.rockIndex !== undefined) return Math.max(1.2, b.radius * 80);
  return Math.max(20, b.radius * 60);
}

export function minCameraDistance(id: BodyId): number {
  if (BODIES[id].type === "craft") return 0.02;
  // nucleus meshes render enlarged (COMET_MESH_GAIN), keep the camera outside
  if (BODIES[id].type === "comet") return 0.06;
  // never let the camera cross the event horizon
  if (BODIES[id].type === "blackhole") return BODIES[id].radius * 1.15;
  return Math.max(0.02, BODIES[id].radius * 1.25);
}

export function viewDistance(id: BodyId): number {
  const b = BODIES[id];
  if (b.type === "craft") return 0.35;
  // asteroids are small: pull the camera in close so the stone fills the view
  if (b.type === "asteroid") return Math.max(0.12, b.radius * 3);
  // frame the coma, not the (tiny) nucleus
  if (b.type === "comet") return 0.5;
  // frame the whole accretion disk, which extends to ~4.3x the horizon radius
  if (b.type === "blackhole") return b.radius * 9;
  // tiny rock moons (Phobos, Nix, ...): pull right in so the stone fills the view
  if (b.type === "moon" && b.rockIndex !== undefined) return Math.max(0.035, b.radius * 4.5);
  return Math.max(0.5, b.radius * 3.4);
}
