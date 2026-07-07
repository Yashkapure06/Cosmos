import { useEffect } from "react";
import { useStore } from "../store/useStore";

export function FlyToggle() {
  const active = useStore((s) => s.flyMode);
  const toggle = useStore((s) => s.toggleFlyMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && !e.repeat) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <button
      className={`fly-toggle${active ? " active" : ""}`}
      onClick={toggle}
      title="Toggle keyboard fly mode"
    >
      <span className="dot" />
      <span>{active ? "FLY ON" : "FLY MODE"}</span>
      <span className="key-hint">[K]</span>
    </button>
  );
}
