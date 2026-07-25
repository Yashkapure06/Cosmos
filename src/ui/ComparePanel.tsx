// True-scale silhouette compare: focused body vs Earth (and a peer).
// DOM overlay — zero GPU cost, high UX payoff.

import { useEffect, useMemo } from "react";
import { BODIES, type BodyId } from "../lib/bodies";
import { EARTH_RADIUS_KM } from "../lib/constants";
import { useStore } from "../store/useStore";
import { playCue } from "../lib/audio";

const PEERS: BodyId[] = ["moon", "mars", "earth", "neptune", "jupiter", "sun"];

function radiusKm(id: BodyId): number {
  return BODIES[id].radius * EARTH_RADIUS_KM;
}

function pickPeer(focus: BodyId): BodyId {
  const r = radiusKm(focus);
  // nearest peer by log-radius for a readable side-by-side
  let best: BodyId = "earth";
  let bestD = Infinity;
  for (const id of PEERS) {
    if (id === focus) continue;
    const d = Math.abs(Math.log(radiusKm(id)) - Math.log(r));
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function Silhouette({
  id,
  maxPx,
  scaleTo,
}: {
  id: BodyId;
  maxPx: number;
  scaleTo: number;
}) {
  const def = BODIES[id];
  const r = radiusKm(id);
  const px = Math.max(4, (r / scaleTo) * maxPx);
  return (
    <div className="compare-item">
      <div
        className="compare-disk"
        style={{
          width: px,
          height: px,
          background: `radial-gradient(circle at 35% 30%, ${def.color}cc, ${def.color}55 55%, ${def.color}22)`,
          boxShadow: `0 0 ${Math.max(6, px * 0.15)}px ${def.color}55`,
        }}
        title={`${def.label}: ${Math.round(r).toLocaleString()} km radius`}
      />
      <div className="compare-meta">
        <span className="compare-name">{def.label}</span>
        <span className="compare-r">{Math.round(r).toLocaleString()} km</span>
        <span className="compare-ratio">
          {r >= EARTH_RADIUS_KM
            ? `${(r / EARTH_RADIUS_KM).toFixed(2)}× Earth`
            : `1/${(EARTH_RADIUS_KM / r).toFixed(1)} Earth`}
        </span>
      </div>
    </div>
  );
}

export function ComparePanel() {
  const open = useStore((s) => s.compareMode);
  const focus = useStore((s) => s.focus);
  const toggle = useStore((s) => s.toggleCompareMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c" && !e.repeat && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        toggle();
        playCue("tick");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const peer = useMemo(() => pickPeer(focus), [focus]);
  const ids = useMemo(() => {
    const set = new Set<BodyId>([focus, "earth", peer]);
    return [...set];
  }, [focus, peer]);

  const scaleTo = useMemo(
    () => Math.max(...ids.map(radiusKm)),
    [ids],
  );

  if (!open) {
    return (
      <button
        className="compare-toggle"
        onClick={() => {
          toggle();
          playCue("tick");
        }}
        title="Compare true sizes [C]"
      >
        COMPARE <span className="key-hint">[C]</span>
      </button>
    );
  }

  return (
    <aside className="compare-panel" aria-label="True-scale size compare">
      <div className="compare-head">
        <span className="compare-title">TRUE SCALE</span>
        <button className="icon-btn" onClick={toggle} aria-label="Close compare">
          ✕
        </button>
      </div>
      <p className="compare-blurb">Disks share one scale — radius, not diameter.</p>
      <div className="compare-row">
        {ids.map((id) => (
          <Silhouette key={id} id={id} maxPx={110} scaleTo={scaleTo} />
        ))}
      </div>
    </aside>
  );
}
