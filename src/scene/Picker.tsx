// Click-to-select: projects every visible satellite to screen space on
// pointer-up (cheap, click-time only) and picks the nearest within 14 px.

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { frames } from "./frames";

export function Picker() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    let downX = 0;
    let downY = 0;

    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // drag
      const rect = el.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const hit = engine.pick(
        camera,
        ndcX,
        ndcY,
        getSimNow(),
        engine.visibleMask,
        14,
        rect.width,
        rect.height,
        frames.earthOffset,
      );
      const { select, clearSelection } = useStore.getState();
      if (hit >= 0) select(hit);
      else clearSelection();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera]);

  return null;
}
