// Per-body fact sheets for the focused-body panel. Numbers are derived from
// the body registry wherever possible; the one-liners are curated.

import { BODIES, BODY_IDS, type BodyId } from "./bodies";
import { EARTH_RADIUS_KM } from "./constants";

const ORBIT_DAYS: Partial<Record<BodyId, number>> = {
  mercury: 87.97, venus: 224.7, earth: 365.25, mars: 687,
  jupiter: 4332.6, saturn: 10759, uranus: 30687, neptune: 60190, pluto: 90560,
};

const BLURBS: Partial<Record<BodyId, string>> = {
  sun: "Contains 99.86% of the solar system's mass. Its core fuses 600 million tons of hydrogen every second.",
  mercury: "A year here is shorter than a day-night cycle. Surface swings 600°C between noon and midnight.",
  venus: "Hottest planet — runaway greenhouse at 465°C. Spins backwards, slower than it orbits.",
  earth: "The only known world with liquid-water oceans on its surface. You are here.",
  moon: "Drifting away from Earth at 3.8 cm per year — the same rate your fingernails grow.",
  mars: "Home to Olympus Mons, 22 km tall — nearly three Everests — and Valles Marineris, a canyon as long as the USA.",
  phobos: "Orbits Mars faster than Mars rotates: it rises in the west. Doomed to crash or shred into a ring in ~50 Myr.",
  deimos: "Only 12 km across. From Mars it looks like a bright star, not a moon.",
  jupiter: "More massive than every other planet combined. The Great Red Spot has raged for centuries.",
  io: "The most volcanically active world known — hundreds of active volcanoes, driven by tidal squeezing.",
  europa: "Beneath the ice crust: a salty ocean with twice the water of all Earth's oceans.",
  ganymede: "Largest moon in the solar system — bigger than Mercury — and the only one with its own magnetic field.",
  callisto: "The most heavily cratered object known; its surface is 4 billion years old.",
  amalthea: "A red, potato-shaped rock that gives off more heat than it gets from the Sun.",
  saturn: "So light it would float in water. Its rings are 280,000 km wide but only ~10 m thick.",
  enceladus: "Geysers at its south pole vent its subsurface ocean straight into space, feeding Saturn's E ring.",
  titan: "Thicker atmosphere than Earth's, with methane rain, rivers and seas. Huygens landed here in 2005.",
  mimas: "The 130-km Herschel crater makes it look exactly like the Death Star.",
  hyperion: "A tumbling sponge: chaotic rotation, no fixed day length at all.",
  iapetus: "Two-toned — one hemisphere coal-dark, the other bright ice — with a mysterious equatorial ridge.",
  phoebe: "Orbits backwards: almost certainly a captured object from the Kuiper belt.",
  uranus: "Rolls around the Sun on its side — its seasons last 21 years each. Its moons are named for Shakespeare.",
  miranda: "Verona Rupes: a 20-km cliff, the tallest known. A fall would take ~12 minutes.",
  titania: "Largest Uranian moon, canyon systems hint at an ancient internal ocean.",
  neptune: "Fastest winds in the solar system — 2,100 km/h. Found by mathematics before telescopes saw it.",
  triton: "Orbits backwards and is spiralling inward — a captured Kuiper-belt world with nitrogen geysers.",
  pluto: "Reclassified in 2006, still beloved. Its heart-shaped nitrogen glacier is the size of Texas.",
  charon: "Half Pluto's size — the pair orbit a point between them, a true double world.",
  eris: "More massive than Pluto; its discovery forced the 'dwarf planet' definition into existence.",
  haumea: "Spins in under 4 hours — so fast it has stretched into an egg. Has its own ring.",
  makemake: "One of the brightest Kuiper-belt objects; covered in frozen methane.",
  sedna: "So distant its year lasts ~11,400 Earth years. Never gets closer than 76 AU.",
  halley: "The first comet recognised as periodic. Returns in 2061 — see it with the time controls.",
  churyumov: "Rosetta orbited this duck-shaped comet for two years; Philae landed on it in 2014.",
  ceres: "The largest asteroid and the first discovered (1801). Dawn found bright salt deposits in Occator crater.",
  vesta: "The brightest asteroid, sometimes visible to the naked eye. Source of many meteorites on Earth.",
  blackhole: "4.15 million solar masses at the true galactic centre, 26,000 light-years away. Imaged by the EHT in 2022.",
  orionnebula: "The nearest massive star-forming region, 1,344 light-years away — a cloud 24 light-years across where ~700 new stars are condensing right now. Watch the knots: stars ignite before your eyes.",
  trappist1: "An ultra-cool red dwarf barely bigger than Jupiter, hosting SEVEN Earth-sized worlds — three in the habitable zone. 40 light-years away.",
  trappist1e: "The most promising: dense, rocky, likely temperate. A prime JWST target for biosignatures.",
  proxima: "The nearest star to the Sun — 4.24 light-years. A flare star: its planets endure violent radiation storms.",
  proximab: "The closest known exoplanet. Receives Earth-like energy, but tidally locked: eternal day and eternal night.",
  alphacenA: "Sun's nearest Sun-like twin. With B, a brilliant double star — brightest in Centaurus.",
  alphacenB: "Orbits its partner every 80 years, swinging between Saturn-and-Pluto-like distances.",
};

export interface BodyFacts {
  radiusKm: number | null;
  dayHours: number | null;
  orbitDays: number | null;
  moons: number;
  blurb: string | null;
}

export function factsFor(id: BodyId): BodyFacts {
  const def = BODIES[id];
  // craft are model-scale; the nebula's "radius" is a scene extent, not a body
  const radiusKm =
    def.type === "craft" || def.type === "nebula"
      ? null
      : Math.round(def.radius * EARTH_RADIUS_KM);
  const orbitDays =
    def.approxOrbit?.periodDays != null
      ? Math.abs(def.approxOrbit.periodDays)
      : def.helioElements
        ? Math.pow(def.helioElements.aAu, 1.5) * 365.25
        : (ORBIT_DAYS[id] ?? null);
  const moons = BODY_IDS.filter(
    (m) => BODIES[m].parent === id && BODIES[m].type === "moon",
  ).length;
  return {
    radiusKm,
    dayHours: def.rotationHours ? Math.abs(def.rotationHours) : null,
    orbitDays,
    moons,
    blurb: BLURBS[id] ?? null,
  };
}

export function fmtPeriod(days: number): string {
  if (days < 2) return `${(days * 24).toFixed(1)} h`;
  if (days < 800) return `${days.toFixed(1)} d`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

export function fmtHours(h: number): string {
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}
