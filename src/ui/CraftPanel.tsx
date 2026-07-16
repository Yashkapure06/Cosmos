// Focused-spacecraft card: live distance, speed, and the goosebump number -
// one-way light time back to Earth.

import { useEffect, useState } from "react";
import { BODIES } from "../lib/bodies";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { craftStates } from "../lib/spacecraft";
import { helio } from "../scene/frames";
import { useStore } from "../store/useStore";

const C_KM_S = 299792.458;

function fmtBigKm(km: number): string {
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} billion km`;
  return `${(km / 1e6).toFixed(2)} million km`;
}

function fmtLightTime(km: number): string {
  const s = km / C_KM_S;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} m ${Math.round(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} m`;
}

export function CraftPanel() {
  const focus = useStore((s) => s.focus);
  const def = BODIES[focus];
  const isCraft = def.type === "craft";
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isCraft) return;
    const id = setInterval(() => tick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [isCraft]);

  if (!isCraft) return null;
  const state = craftStates.get(focus);
  if (!state) return null;

  const km = helio.pos[focus].distanceTo(helio.pos.earth) * EARTH_RADIUS_KM;
  const speed = state.v.length() * EARTH_RADIUS_KM * 1000; // units/ms -> km/s
  const years = def.launchYear
    ? new Date().getUTCFullYear() - def.launchYear
    : null;

  return (
    <aside className="info-panel craft-panel" aria-label="Spacecraft details">
      <div className="info-head">
        <div>
          <span className="info-cat" style={{ color: def.color }}>
            ● DEEP-SPACE MISSION
          </span>
          <h2 className="info-name">{def.label}</h2>
          <span className="info-ids">NASA / JPL HORIZONS</span>
        </div>
      </div>
      <dl className="info-grid">
        <div>
          <dt>DISTANCE FROM EARTH</dt>
          <dd>{fmtBigKm(km)}</dd>
        </div>
        <div>
          <dt>HELIOCENTRIC SPEED</dt>
          <dd>{speed.toFixed(2)} km/s</dd>
        </div>
        <div>
          <dt>ONE-WAY LIGHT TIME</dt>
          <dd>{fmtLightTime(km)}</dd>
        </div>
        {years !== null && (
          <div>
            <dt>IN FLIGHT</dt>
            <dd>
              {years} years ({def.launchYear})
            </dd>
          </div>
        )}
      </dl>
      {focus === "jwst" && (
        <ul className="jwst-list">
          {JWST_MILESTONES.map((m) => (
            <li key={m.year + m.text}>
              <span className="jwst-year">{m.year}</span>
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// highlights from Webb's first years -- the discoveries this dot in the sky
// actually made
const JWST_MILESTONES = [
  { year: "2022", text: "First deep field: thousands of galaxies in a grain-of-sand patch of sky" },
  { year: "2022", text: "Water vapour read in exoplanet WASP-96b's atmosphere" },
  { year: "2023", text: "Cassiopeia A supernova remnant imaged inside-out" },
  { year: "2024", text: "The Crab Nebula's pulsar heart in infrared detail" },
  { year: "2025", text: "TRAPPIST-1e atmosphere search — the habitable-zone test" },
  { year: "2026", text: "Most distant galaxy yet: light from <300 Myr after the Big Bang" },
];
