// Guided grand tour: a cinematic autopilot through the whole scene using the
// same fly-to the markers use. Any manual input (pointer/wheel on the canvas)
// cancels it -- the user always wins.

import { useEffect, useRef, useState } from "react";
import { BODIES, type BodyId } from "../lib/bodies";
import { nav } from "../scene/nav";
import { useStore } from "../store/useStore";

const STOPS: BodyId[] = [
  "moon", "mars", "ceres", "jupiter", "io", "saturn", "titan",
  "uranus", "neptune", "pluto", "halley", "sun", "blackhole",
  "trappist1", "trappist1e", "proxima", "alphacenA", "earth",
];

const DWELL_MS = 11_000; // flight (up to ~6 s) + a few seconds to look around

export function TourButton() {
  const stage = useStore((s) => s.stage);
  const [active, setActive] = useState(false);
  const [stop, setStop] = useState(0);
  const timerRef = useRef<number | null>(null);

  const halt = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setActive(false);
  };

  useEffect(() => {
    if (!active) return;
    let i = 0;
    const next = () => {
      if (i >= STOPS.length) {
        halt();
        return;
      }
      setStop(i);
      nav.flyTo(STOPS[i]);
      i += 1;
      timerRef.current = window.setTimeout(next, DWELL_MS);
    };
    next();

    // manual input cancels the tour
    const cancel = () => halt();
    const canvas = document.querySelector(".scene-canvas");
    canvas?.addEventListener("pointerdown", cancel);
    canvas?.addEventListener("wheel", cancel, { passive: true });
    return () => {
      canvas?.removeEventListener("pointerdown", cancel);
      canvas?.removeEventListener("wheel", cancel);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [active]);

  if (stage !== "ready") return null;

  return (
    <button
      className={`tour-btn ${active ? "tour-on" : ""}`}
      onClick={() => (active ? halt() : setActive(true))}
      aria-pressed={active}
    >
      {active
        ? `■ TOUR ${stop + 1}/${STOPS.length} — ${BODIES[STOPS[stop]].label.toUpperCase()}`
        : "▶ GRAND TOUR"}
    </button>
  );
}
