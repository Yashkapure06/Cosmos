// 2D equirectangular ground-track strip for the selected satellite.

import { useEffect, useRef } from "react";
import { eciToGeodetic, gstime, degreesLat, degreesLong } from "satellite.js";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow } from "../store/useStore";
import { EARTH_RADIUS_KM } from "../lib/constants";

const W = 280;
const H = 120;
const SAMPLES = 96;

function sceneToEciKm(sx: number, sy: number, sz: number) {
  return {
    x: sx * EARTH_RADIUS_KM,
    y: -sz * EARTH_RADIUS_KM,
    z: sy * EARTH_RADIUS_KM,
  };
}

function project(lon: number, lat: number) {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return { x, y };
}

export function GroundMap({
  selectedIndex,
  periodMin,
  color,
}: {
  selectedIndex: number;
  periodMin: number;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas || selectedIndex < 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const orbit = await engine.requestOrbit(selectedIndex, getSimNow(), SAMPLES);
      if (cancelled) return;

      const sim0 = getSimNow();
      const periodMs = Math.max(60_000, periodMin * 60_000);
      const pts: { x: number; y: number }[] = [];

      for (let s = 0; s < orbit.length / 3; s++) {
        const j = s * 3;
        const t = sim0 + (s / Math.max(1, orbit.length / 3 - 1)) * periodMs;
        const eci = sceneToEciKm(orbit[j], orbit[j + 1], orbit[j + 2]);
        if (eci.x === 0 && eci.y === 0 && eci.z === 0) continue;
        const geo = eciToGeodetic(eci, gstime(new Date(t)));
        pts.push(project(degreesLong(geo.longitude), degreesLat(geo.latitude)));
      }

      const paint = () => {
        if (cancelled || !canvasRef.current) return;
        const c = canvasRef.current.getContext("2d");
        if (!c) return;

        c.clearRect(0, 0, W, H);
        // ocean / land vibe
        c.fillStyle = "#0a1628";
        c.fillRect(0, 0, W, H);
        c.strokeStyle = "rgba(28, 39, 64, 0.9)";
        c.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          const y = (H / 4) * i;
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(W, y);
          c.stroke();
        }
        for (let i = 1; i < 6; i++) {
          const x = (W / 6) * i;
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x, H);
          c.stroke();
        }
        // equator
        c.strokeStyle = "rgba(125, 211, 252, 0.25)";
        c.beginPath();
        c.moveTo(0, H / 2);
        c.lineTo(W, H / 2);
        c.stroke();

        // track (split on date-line jumps)
        c.strokeStyle = color;
        c.lineWidth = 1.5;
        c.globalAlpha = 0.85;
        c.beginPath();
        let penUp = true;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (i > 0 && Math.abs(p.x - pts[i - 1].x) > W * 0.4) penUp = true;
          if (penUp) {
            c.moveTo(p.x, p.y);
            penUp = false;
          } else c.lineTo(p.x, p.y);
        }
        c.stroke();
        c.globalAlpha = 1;

        // live sub-point
        const live = engine.liveSample(selectedIndex, getSimNow());
        if (live) {
          const p = project(live.longitudeDeg, live.latitudeDeg);
          c.fillStyle = color;
          c.beginPath();
          c.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "#e8edf6";
          c.lineWidth = 1;
          c.stroke();
        }

        raf = window.setTimeout(paint, 500);
      };
      paint();
    };

    void draw();
    return () => {
      cancelled = true;
      window.clearTimeout(raf);
    };
  }, [selectedIndex, periodMin, color]);

  return (
    <div className="ground-map" aria-label="Ground track map">
      <div className="ground-map-label">GROUND TRACK</div>
      <canvas ref={canvasRef} width={W} height={H} />
    </div>
  );
}
