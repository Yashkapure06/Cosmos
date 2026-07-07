import { useEffect, useState } from "react";
import { frames } from "../scene/frames";
import { useStore } from "../store/useStore";
import { EARTH_RADIUS_KM } from "../lib/constants";

const FOV_RAD = (42 * Math.PI) / 180;

export function ScaleRuler() {
  const stage = useStore((s) => s.stage);
  const [text, setText] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      const kmPerPx =
        (2 * frames.cameraDist * Math.tan(FOV_RAD / 2) * EARTH_RADIUS_KM) /
        window.innerHeight;
      const v =
        kmPerPx >= 100
          ? `${Math.round(kmPerPx).toLocaleString("en-US")} km`
          : kmPerPx >= 1
            ? `${kmPerPx.toFixed(1)} km`
            : `${Math.round(kmPerPx * 1000)} m`;
      setText(`1 px ≈ ${v}`);
    }, 250);
    return () => clearInterval(id);
  }, []);

  if (stage !== "ready") return null;

  return (
    <div className="scale-ruler" aria-hidden="true">
      {text}
    </div>
  );
}
