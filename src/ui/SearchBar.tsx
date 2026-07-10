import { useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { CATEGORY_COLOR } from "../lib/constants";
import { BODIES, BODY_IDS, type BodyId } from "../lib/bodies";
import { nav } from "../scene/nav";

const TYPE_TAG: Record<string, string> = {
  star: "STAR",
  planet: "PLANET",
  moon: "MOON",
  craft: "CRAFT",
  asteroid: "ASTEROID",
  comet: "COMET",
  blackhole: "BLACK HOLE",
};

export function SearchBar() {
  const meta = useStore((s) => s.meta);
  const select = useStore((s) => s.select);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // celestial bodies first: planets, moons, comets, spacecraft, ...
  const bodyResults = useMemo(() => {
    const query = q.trim().toUpperCase();
    if (query.length < 2) return [];
    const out: BodyId[] = [];
    for (const id of BODY_IDS) {
      if (BODIES[id].label.toUpperCase().includes(query)) {
        out.push(id);
        if (out.length >= 6) break;
      }
    }
    return out;
  }, [q]);

  const results = useMemo(() => {
    const query = q.trim().toUpperCase();
    if (query.length < 2) return [];
    const out = [];
    const max = 10 - bodyResults.length;
    for (const m of meta) {
      if (
        m.name.toUpperCase().includes(query) ||
        String(m.noradId).startsWith(query)
      ) {
        out.push(m);
        if (out.length >= max) break;
      }
    }
    return out;
  }, [q, meta, bodyResults]);

  const close = () => {
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const pick = (index: number) => {
    select(index);
    close();
  };

  const pickBody = (id: BodyId) => {
    nav.flyTo(id);
    close();
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        className="search-input"
        placeholder="Search planet, moon, satellite…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search bodies and satellites"
      />
      {open && (bodyResults.length > 0 || results.length > 0) && (
        <ul className="search-results" role="listbox">
          {bodyResults.map((id) => (
            <li key={id}>
              <button className="search-result" onMouseDown={() => pickBody(id)}>
                <span className="chip-dot" style={{ background: BODIES[id].color }} />
                <span className="search-result-name">{BODIES[id].label}</span>
                <span className="search-result-id">{TYPE_TAG[BODIES[id].type]}</span>
              </button>
            </li>
          ))}
          {results.map((m) => (
            <li key={m.index}>
              <button className="search-result" onMouseDown={() => pick(m.index)}>
                <span
                  className="chip-dot"
                  style={{ background: CATEGORY_COLOR[m.category] }}
                />
                <span className="search-result-name">{m.name}</span>
                <span className="search-result-id">{m.noradId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
