import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

const STAGE_TEXT: Record<string, string> = {
  idle: "STANDBY",
  fetching: "ACQUIRING SATELLITE CATALOG…",
  initializing: "INITIALIZING SGP4 PROPAGATORS…",
  error: "LINK FAILURE",
};

export function LoadingOverlay() {
  const stage = useStore((s) => s.stage);
  const error = useStore((s) => s.error);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (stage !== "ready") return;
    const id = setTimeout(() => setGone(true), 1400); // css fade is 1s + slack
    return () => clearTimeout(id);
  }, [stage]);

  if (gone) return null;

  return (
    <div className={`loading-overlay ${stage === "ready" ? "loading-fade" : ""}`}>
      <div className="loading-box">
        <span className="loading-mark">COSMOS</span>
        {stage === "error" ? (
          <>
            <span className="loading-stage loading-error">{STAGE_TEXT.error}</span>
            <span className="loading-detail">{error}</span>
            <button className="speed-btn" onClick={() => location.reload()}>
              RETRY
            </button>
          </>
        ) : (
          <>
            <span className="loading-stage">{STAGE_TEXT[stage] ?? ""}</span>
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
