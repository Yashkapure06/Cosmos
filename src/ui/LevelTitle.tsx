// Names the current zoom regime; fades on change. Reads the frames singleton
// at low rate rather than subscribing to the render loop.

import { useEffect, useState } from "react";
import { frames } from "../scene/frames";
import { BODIES } from "../lib/bodies";
import { useStore } from "../store/useStore";
import type { BodyId } from "../lib/bodies";

function levelName(dist: number, focus: BodyId): string {
  if (focus === "earth") {
    if (dist < 6) return "LOW EARTH ORBIT";
    if (dist < 30) return "EARTH ORBIT";
    return "CISLUNAR SPACE";
  }
  if (focus === "sun") {
    if (dist < 3000) return "SOLAR CORONA";
    if (dist < 120000) return "INNER SYSTEM";
    return "THE SOLAR SYSTEM";
  }
  const def = BODIES[focus];
  if (def.type === "craft") return `${def.label.toUpperCase()} - DEEP SPACE`;
  if (def.type === "moon") return `${def.label.toUpperCase()} - ${BODIES[def.parent!].label.toUpperCase()} SYSTEM`;
  return `${def.label.toUpperCase()} SYSTEM`;
}

export function LevelTitle() {
  const focus = useStore((s) => s.focus);
  const stage = useStore((s) => s.stage);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setTitle(levelName(frames.cameraDist, focus));
    }, 250);
    return () => clearInterval(id);
  }, [focus]);

  if (stage !== "ready") return null;

  return (
    <div className="level-title" key={title} aria-hidden="true">
      {title}
    </div>
  );
}
