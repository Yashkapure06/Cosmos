import { useEffect, useState } from "react";
import { isLive, simNow, useStore } from "../store/useStore";
import { fmtUtc } from "../lib/format";
import { playCue } from "../lib/audio";

// Negative tiers rewind; high positive tiers make planetary motion watchable
// (Earth: one lap in ~52 s at 1wk/s).
const SPEEDS = [-604800, -86400, -3600, -100, 1, 100, 3600, 86400, 604800];

function speedLabel(s: number): string {
  if (s === 1) return "1×";
  if (s === -1) return "−1×";
  const sign = s < 0 ? "−" : "+";
  const a = Math.abs(s);
  if (a < 3600) return `${sign}${a}×`;
  if (a === 3600) return `${sign}1h/s`;
  if (a === 86400) return `${sign}1d/s`;
  if (a === 604800) return `${sign}1wk/s`;
  return `${sign}${a}×`;
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
      <div className="time-row time-speeds">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed-btn ${time.speed === s ? "speed-on" : ""} ${s < 0 ? "speed-rev" : ""}`}
            onClick={() => {
              setSpeed(s);
              playCue("tick");
            }}
            title={
              s < 0
                ? `Rewind ${Math.abs(s).toLocaleString()}×`
                : s >= 3600
                  ? `${s.toLocaleString()}× — watch planets orbit`
                  : `${s}× real time`
            }
          >
            {speedLabel(s)}
          </button>
        ))}
      </div>
      <div className="time-row">
        <button
          className="speed-btn"
          onClick={() => jumpBy(-3_600_000)}
          title="Back 1 hour"
        >
          −1h
        </button>
        <button
          className="speed-btn"
          onClick={() => jumpBy(3_600_000)}
          title="Forward 1 hour"
        >
          +1h
        </button>
        <button className="speed-btn" onClick={() => jumpBy(-86_400_000)} title="Back 1 day">
          −1d
        </button>
        <button className="speed-btn" onClick={() => jumpBy(86_400_000)} title="Forward 1 day">
          +1d
        </button>
        <span className="time-sep" />
        <button className="speed-btn now-btn" onClick={goLive}>
          NOW
        </button>
      </div>
    </div>
  );
}
