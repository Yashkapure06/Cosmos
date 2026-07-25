// Adaptive quality: FPS + distance drive particle budgets, DPR, and heavy FX.
// Module singleton so render loops read with zero React overhead.

export type QualityTier = "high" | "medium" | "low";

export interface QualityState {
  tier: QualityTier;
  fps: number;
  /** 0.35–1: scales asteroid / galaxy / local-debris draw counts */
  particleScale: number;
  /** Canvas DPR cap */
  dpr: number;
  /** Soft sat / emissive glow boost */
  glow: boolean;
  /** Earth sphere segment multiplier (0.35–1) */
  earthDetail: number;
}

export const quality: QualityState = {
  tier: "high",
  fps: 60,
  particleScale: 1,
  dpr: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2),
  glow: true,
  earthDetail: 1,
};

const TIER_BUDGET: Record<
  QualityTier,
  Pick<QualityState, "particleScale" | "dpr" | "glow" | "earthDetail">
> = {
  high: { particleScale: 1, dpr: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2), glow: true, earthDetail: 1 },
  medium: { particleScale: 0.55, dpr: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5), glow: true, earthDetail: 0.65 },
  low: { particleScale: 0.32, dpr: 1, glow: false, earthDetail: 0.4 },
};

/** Apply tier; keep live fps for HUD. */
export function setQualityTier(tier: QualityTier, fps: number) {
  const b = TIER_BUDGET[tier];
  quality.tier = tier;
  quality.fps = fps;
  quality.particleScale = b.particleScale;
  quality.dpr = b.dpr;
  quality.glow = b.glow;
  quality.earthDetail = b.earthDetail;
}

/** Hysteresis so tier doesn't flap every frame. */
export function pickTier(fps: number, prev: QualityTier): QualityTier {
  if (prev === "high") {
    if (fps < 38) return "medium";
    return "high";
  }
  if (prev === "medium") {
    if (fps > 52) return "high";
    if (fps < 28) return "low";
    return "medium";
  }
  // low
  if (fps > 40) return "medium";
  return "low";
}
