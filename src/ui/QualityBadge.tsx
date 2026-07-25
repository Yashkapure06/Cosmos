// Tiny FPS / quality chip — confirms adaptive LOD is alive.

import { quality } from "../lib/quality";
import { useStore } from "../store/useStore";
import { useEffect, useState } from "react";

export function QualityBadge() {
  const tier = useStore((s) => s.qualityTier);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`quality-badge tier-${tier}`}
      title="Adaptive render quality — lowers particle count & DPR when FPS dips"
    >
      <span className="quality-tier">{tier.toUpperCase()}</span>
      <span className="quality-fps">{Math.round(quality.fps)} FPS</span>
    </div>
  );
}
