// Samples frame time, picks quality tier, applies DPR. Must sit inside Canvas.

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { pickTier, quality, setQualityTier as applyQuality } from "../lib/quality";
import { useStore } from "../store/useStore";

export function QualityMonitor() {
  const gl = useThree((s) => s.gl);
  const setTier = useStore((s) => s.setQualityTier);
  const last = useRef(performance.now());
  const emaDt = useRef(16.7);

  useFrame((_, dt) => {
    // EMA of frame dt (seconds → ms)
    const ms = Math.min(100, dt * 1000);
    emaDt.current = emaDt.current * 0.9 + ms * 0.1;

    const now = performance.now();
    if (now - last.current < 500) return;
    last.current = now;

    const fps = 1000 / emaDt.current;
    const next = pickTier(fps, quality.tier);
    applyQuality(next, fps);

    const dpr = quality.dpr;
    if (Math.abs(gl.getPixelRatio() - dpr) > 0.05) {
      gl.setPixelRatio(dpr);
    }

    // push to zustand sparingly for HUD
    if (useStore.getState().qualityTier !== next) setTier(next);
  });

  return null;
}
