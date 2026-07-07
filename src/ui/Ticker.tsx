// Signature element: a live telemetry strip. Every number is real.

import { useEffect, useMemo, useState } from "react";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { CATEGORY_LABEL, CATEGORY_ORDER, type Category } from "../lib/constants";
import { BODIES, CRAFT_IDS } from "../lib/bodies";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { helio } from "../scene/frames";
import { fmtKm, fmtSpeed } from "../lib/format";

function craftLines(): string[] {
  const year = new Date().getUTCFullYear();
  return CRAFT_IDS.map((id) => {
    const def = BODIES[id];
    const km = helio.pos[id].distanceTo(helio.pos.earth) * EARTH_RADIUS_KM;
    const dist =
      km >= 1e9
        ? `${(km / 1e9).toFixed(1)} BILLION KM`
        : `${(km / 1e6).toFixed(1)} MILLION KM`;
    const yrs = def.launchYear ? year - def.launchYear : 0;
    return `${def.label.toUpperCase()} - ${dist} FROM EARTH - ${yrs} YRS IN FLIGHT`;
  });
}

export function Ticker() {
  const meta = useStore((s) => s.meta);
  const enabled = useStore((s) => s.enabled);
  const selectedIndex = useStore((s) => s.selectedIndex);
  const stage = useStore((s) => s.stage);
  const spacecraftReady = useStore((s) => s.spacecraftReady);
  const [liveText, setLiveText] = useState("");
  const [, bump] = useState(0);

  // craft distances are read from the live helio table at render time;
  // re-render periodically so they stay current (and heal the initial zeros
  // while the canvas was still suspended on texture decode)
  useEffect(() => {
    const id = setInterval(() => bump((b) => b + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0])) as Record<
      Category,
      number
    >;
    for (const m of meta) c[m.category]++;
    return c;
  }, [meta]);

  useEffect(() => {
    const id = setInterval(() => {
      if (selectedIndex < 0) {
        setLiveText("");
        return;
      }
      const live = engine.liveSample(selectedIndex, getSimNow());
      const m = useStore.getState().meta[selectedIndex];
      if (live && m) {
        setLiveText(
          `TRACKING ${m.name} - ALT ${fmtKm(live.altitudeKm)} - VEL ${fmtSpeed(live.speedKmS)}`,
        );
      }
    }, 500);
    return () => clearInterval(id);
  }, [selectedIndex]);

  if (stage !== "ready") return null;

  const visibleTotal = meta.reduce(
    (acc, m) => acc + (enabled[m.category] ? 1 : 0),
    0,
  );

  const items = [
    `${meta.length.toLocaleString("en-US")} OBJECTS IN CATALOG`,
    `${visibleTotal.toLocaleString("en-US")} ON SCREEN`,
    ...CATEGORY_ORDER.filter((c) => counts[c] > 0).map(
      (c) => `${CATEGORY_LABEL[c].toUpperCase()} ${counts[c].toLocaleString("en-US")}`,
    ),
    ...(spacecraftReady ? craftLines() : []),
    "DATA: CELESTRAK GP + JPL HORIZONS · SGP4 PROPAGATION IN-BROWSER",
  ];
  if (liveText) items.unshift(liveText);

  const strip = items.join("   ◦   ");

  return (
    <footer className="ticker" aria-hidden="true">
      <div className="ticker-track">
        <span>{strip}</span>
        <span>{strip}</span>
      </div>
    </footer>
  );
}
