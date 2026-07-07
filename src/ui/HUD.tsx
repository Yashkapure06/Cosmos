import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useStore } from "../store/useStore";

export function HUD() {
  const stage = useStore((s) => s.stage);
  const total = useStore((s) => s.meta.length);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (stage !== "ready" || !countRef.current) return;
    const obj = { v: 0 };
    const el = countRef.current;
    const tween = gsap.to(obj, {
      v: total,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = Math.round(obj.v).toLocaleString("en-US");
      },
    });
    return () => {
      tween.kill();
    };
  }, [stage, total]);

  return (
    <header className="hud-top">
      <div className="wordmark">
        <span className="wordmark-name">COSMOS</span>
        <span className="wordmark-sub">LIVE SATELLITE TRACKER</span>
      </div>
      <div className="tracked">
        <span ref={countRef} className="tracked-count">
          0
        </span>
        <span className="tracked-label">OBJECTS TRACKED</span>
      </div>
    </header>
  );
}
