import { useMemo } from "react";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type Category,
} from "../lib/constants";
import { useStore } from "../store/useStore";
import { loadDebris } from "../hooks/useBootstrap";

export function FilterRail() {
  const meta = useStore((s) => s.meta);
  const enabled = useStore((s) => s.enabled);
  const toggleCategory = useStore((s) => s.toggleCategory);
  const debrisLoaded = useStore((s) => s.debrisLoaded);
  const debrisLoading = useStore((s) => s.debrisLoading);
  const showLabels = useStore((s) => s.showLabels);
  const toggleLabels = useStore((s) => s.toggleLabels);
  const showConstellations = useStore((s) => s.showConstellations);
  const toggleConstellations = useStore((s) => s.toggleConstellations);

  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0])) as Record<
      Category,
      number
    >;
    for (const m of meta) c[m.category]++;
    return c;
  }, [meta]);

  const onToggle = (cat: Category) => {
    if (cat === "debris" && !debrisLoaded) {
      loadDebris();
      // enable so freshly appended debris shows as soon as it arrives
      if (!enabled.debris) toggleCategory("debris");
      return;
    }
    toggleCategory(cat);
  };

  return (
    <nav className="filter-rail" aria-label="Satellite categories">
      {CATEGORY_ORDER.map((cat) => {
        const isDebris = cat === "debris";
        const count = counts[cat];
        const on = enabled[cat] && (!isDebris || debrisLoaded);
        return (
          <button
            key={cat}
            className={`chip ${on ? "chip-on" : ""}`}
            onClick={() => onToggle(cat)}
            aria-pressed={on}
          >
            <span className="chip-dot" style={{ background: CATEGORY_COLOR[cat] }} />
            <span className="chip-label">{CATEGORY_LABEL[cat]}</span>
            <span className="chip-count">
              {isDebris && !debrisLoaded
                ? debrisLoading
                  ? "…"
                  : "LOAD"
                : count.toLocaleString("en-US")}
            </span>
          </button>
        );
      })}
      <button
        className={`chip chip-labels ${showLabels ? "chip-on" : ""}`}
        onClick={toggleLabels}
        aria-pressed={showLabels}
      >
        <span className="chip-dot" style={{ background: "var(--amber)" }} />
        <span className="chip-label">BODY NAMES</span>
        <span className="chip-count">{showLabels ? "ON" : "OFF"}</span>
      </button>
      <button
        className={`chip chip-labels ${showConstellations ? "chip-on" : ""}`}
        onClick={toggleConstellations}
        aria-pressed={showConstellations}
      >
        <span className="chip-dot" style={{ background: "#44608a" }} />
        <span className="chip-label">CONSTELLATIONS</span>
        <span className="chip-count">{showConstellations ? "ON" : "OFF"}</span>
      </button>
    </nav>
  );
}
