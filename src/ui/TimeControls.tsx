import { useEffect, useState } from "react";
import { isLive, simNow, useStore } from "../store/useStore";
import { fmtUtc } from "../lib/format";

const SPEEDS = [1, 10, 100];

function speedLabel(s: number): string {
  return s === 1 ? "1×" : `+${s}×`;
}

export function TimeControls() {
  const time = useStore((s) => s.time);
  const setSpeed = useStore((s) => s.setSpeed);
  const jumpBy = useStore((s) => s.jumpBy);
  const goLive = useStore((s) => s.goLive);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const now = simNow(time);
  const live = isLive(time);
  const offsetH = (now - Date.now()) / 3_600_000;

  return (
    <div className="time-controls" aria-label="Time machine">
      <div className="time-row">
        <span className={`live-badge ${live ? "live-on" : ""}`} onClick={goLive} role="button">
          {live ? "● LIVE" : "○ SIM"}
        </span>
        <span className="time-clock">{fmtUtc(now)}</span>
        {!live && (
          <span className="time-offset">
            {offsetH >= 0 ? "+" : ""}
            {offsetH.toFixed(1)}h
          </span>
        )}
      </div>
      <div className="time-row">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed-btn ${time.speed === s ? "speed-on" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {speedLabel(s)}
          </button>
        ))}
        <span className="time-sep" />
        <button className="speed-btn" onClick={() => jumpBy(-3_600_000)} title="Back 1 hour">
          −1h
        </button>
        <button className="speed-btn" onClick={() => jumpBy(3_600_000)} title="Forward 1 hour">
          +1h
        </button>
        <button className="speed-btn now-btn" onClick={goLive}>
          NOW
        </button>
      </div>
    </div>
  );
}
