// EVENTS: one-click time-travel to the sky's greatest hits. Each entry jumps
// the time machine to the date and either flies to a body or swings the view
// to the right patch of sky. Without this, events like SN 1054 are locked
// behind dates the +/-1h buttons can never reach.

import { useEffect, useRef, useState } from "react";
import { getSimNow, useStore } from "../store/useStore";
import { nav } from "../scene/nav";
import type { BodyId } from "../lib/bodies";

interface SkyEvent {
  id: string;
  label: string;
  detail: string;
  /** target sim date */
  dateMs: number;
  /** fly to a body... */
  flyTo?: BodyId;
  /** ...or aim the view at a sky direction */
  aim?: [number, number];
}

const EVENTS: SkyEvent[] = [
  {
    id: "sn1054",
    label: "A STAR EXPLODES — SN 1054",
    detail: "the supernova that built the Crab Nebula",
    dateMs: Date.UTC(1054, 6, 10),
    aim: [83.63, 22.01],
  },
  {
    id: "tycho",
    label: "TYCHO'S SUPERNOVA — 1572",
    detail: "as bright as Venus, seen by Tycho Brahe",
    dateMs: Date.UTC(1572, 10, 12),
    aim: [6.34, 64.14],
  },
  {
    id: "eclipse2027",
    label: "TOTAL SOLAR ECLIPSE — AUG 2027",
    detail: "the Moon's shadow crosses Earth",
    dateMs: Date.UTC(2027, 7, 2, 10, 0),
    flyTo: "moon",
  },
  {
    id: "67p",
    label: "67P AT PERIHELION — 2028",
    detail: "Rosetta's comet lights up",
    dateMs: Date.UTC(2028, 2, 20),
    flyTo: "churyumov",
  },
  {
    id: "halley",
    label: "HALLEY RETURNS — 2061",
    detail: "once-in-a-lifetime, in your lifetime",
    dateMs: Date.UTC(2061, 6, 28),
    flyTo: "halley",
  },
  {
    id: "crabnow",
    label: "CRAB NEBULA — TODAY",
    detail: "what 972 years leaves behind",
    dateMs: 0, // 0 = NOW
    aim: [83.63, 22.01],
  },
];

export function EventsMenu() {
  const stage = useStore((s) => s.stage);
  const jumpBy = useStore((s) => s.jumpBy);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (stage !== "ready") return null;

  const go = (ev: SkyEvent) => {
    const target = ev.dateMs === 0 ? Date.now() : ev.dateMs;
    jumpBy(target - getSimNow());
    if (ev.flyTo) nav.flyTo(ev.flyTo);
    else if (ev.aim) nav.aimSky(ev.aim[0], ev.aim[1]);
    setOpen(false);
  };

  return (
    <div className="events-menu" ref={panelRef}>
      <button
        className={`events-btn ${open ? "events-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        ★ EVENTS
      </button>
      {open && (
        <div className="events-pop">
          {EVENTS.map((ev) => (
            <button key={ev.id} className="events-item" onClick={() => go(ev)}>
              <span className="events-label">{ev.label}</span>
              <span className="events-detail">{ev.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
