// Focused-body fact card: what you're looking at and why it's interesting.
// Craft keep their own richer CraftPanel; Earth is home (no card needed).

import { useEffect, useState } from "react";
import { BODIES } from "../lib/bodies";
import { factsFor, fmtHours, fmtPeriod } from "../lib/facts";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { helio } from "../scene/frames";
import { useStore } from "../store/useStore";

const TYPE_LABEL: Record<string, string> = {
  star: "STAR",
  planet: "PLANET",
  moon: "NATURAL SATELLITE",
  asteroid: "ASTEROID / DWARF",
  comet: "COMET",
  nebula: "STELLAR NURSERY",
  blackhole: "SUPERMASSIVE BLACK HOLE",
};

function fmtKm(km: number): string {
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} billion km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(1) } million km`;
  return `${km.toLocaleString("en-US")} km`;
}

export function BodyPanel() {
  const focus = useStore((s) => s.focus);
  const def = BODIES[focus];
  const show = focus !== "earth" && def.type !== "craft";
  const [distKm, setDistKm] = useState(0);

  useEffect(() => {
    if (!show) return;
    const update = () =>
      setDistKm(helio.pos[focus].distanceTo(helio.pos.earth) * EARTH_RADIUS_KM);
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [show, focus]);

  if (!show) return null;
  const f = factsFor(focus);
  const parent = def.parent ? BODIES[def.parent] : null;

  return (
    <aside className="info-panel body-panel" aria-label="Body details">
      <div className="info-head">
        <div>
          <span className="info-cat" style={{ color: def.color }}>
            ● {TYPE_LABEL[def.type] ?? def.type.toUpperCase()}
            {parent && def.type === "moon" ? ` OF ${parent.label.toUpperCase()}` : ""}
          </span>
          <h2 className="info-name">{def.label}</h2>
        </div>
      </div>
      <dl className="info-grid">
        {f.radiusKm !== null && (
          <div>
            <dt>RADIUS</dt>
            <dd>{f.radiusKm.toLocaleString("en-US")} km</dd>
          </div>
        )}
        {f.orbitDays !== null && (
          <div>
            <dt>ORBITAL PERIOD</dt>
            <dd>{fmtPeriod(f.orbitDays)}</dd>
          </div>
        )}
        {f.dayHours !== null && (
          <div>
            <dt>DAY LENGTH</dt>
            <dd>{fmtHours(f.dayHours)}</dd>
          </div>
        )}
        {f.moons > 0 && (
          <div>
            <dt>MOONS SHOWN</dt>
            <dd>{f.moons}</dd>
          </div>
        )}
        <div>
          <dt>DISTANCE FROM EARTH</dt>
          <dd>{fmtKm(distKm)}</dd>
        </div>
      </dl>
      {f.blurb && <p className="body-blurb">{f.blurb}</p>}
    </aside>
  );
}
