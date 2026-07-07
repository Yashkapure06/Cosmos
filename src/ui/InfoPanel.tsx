import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "../lib/constants";
import { fmtDeg, fmtKm, fmtLatLon, fmtPeriod, fmtSpeed } from "../lib/format";
import type { LiveSample } from "../lib/types";

export function InfoPanel() {
  const selectedIndex = useStore((s) => s.selectedIndex);
  const meta = useStore((s) => s.meta[s.selectedIndex]);
  const follow = useStore((s) => s.follow);
  const setFollow = useStore((s) => s.setFollow);
  const clearSelection = useStore((s) => s.clearSelection);

  const [live, setLive] = useState<LiveSample | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const id = setInterval(() => {
      setLive(engine.liveSample(selectedIndex, getSimNow()));
    }, 250);
    return () => clearInterval(id);
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex < 0 || !panelRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    gsap.fromTo(
      panelRef.current,
      { x: 40, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" },
    );
  }, [selectedIndex]);

  if (selectedIndex < 0 || !meta) return null;

  const color = CATEGORY_COLOR[meta.category];

  return (
    <aside className="info-panel" ref={panelRef} aria-label="Satellite details">
      <div className="info-head">
        <div>
          <span className="info-cat" style={{ color }}>
            ● {CATEGORY_LABEL[meta.category].toUpperCase()}
          </span>
          <h2 className="info-name">{meta.name}</h2>
          <span className="info-ids">
            NORAD {meta.noradId} · {meta.intlDes}
          </span>
        </div>
        <button className="icon-btn" onClick={clearSelection} aria-label="Close">
          ✕
        </button>
      </div>

      <dl className="info-grid">
        <div>
          <dt>ALTITUDE</dt>
          <dd>{live ? fmtKm(live.altitudeKm) : "-"}</dd>
        </div>
        <div>
          <dt>VELOCITY</dt>
          <dd>{live ? fmtSpeed(live.speedKmS) : "-"}</dd>
        </div>
        <div>
          <dt>GROUND POINT</dt>
          <dd>{live ? fmtLatLon(live.latitudeDeg, live.longitudeDeg) : "-"}</dd>
        </div>
        <div>
          <dt>INCLINATION</dt>
          <dd>{fmtDeg(meta.inclination)}</dd>
        </div>
        <div>
          <dt>PERIOD</dt>
          <dd>{fmtPeriod(meta.periodMin)}</dd>
        </div>
        <div>
          <dt>APOGEE / PERIGEE</dt>
          <dd>
            {fmtKm(meta.apogeeKm)} / {fmtKm(meta.perigeeKm)}
          </dd>
        </div>
        {meta.launchYear && (
          <div>
            <dt>LAUNCHED</dt>
            <dd>{meta.launchYear}</dd>
          </div>
        )}
      </dl>

      <button
        className={`follow-btn ${follow ? "follow-on" : ""}`}
        onClick={() => setFollow(!follow)}
      >
        {follow ? "■ STOP FOLLOWING" : "▶ FOLLOW CAMERA"}
      </button>
    </aside>
  );
}
