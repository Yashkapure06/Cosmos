import { useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { CATEGORY_COLOR } from "../lib/constants";

export function SearchBar() {
  const meta = useStore((s) => s.meta);
  const select = useStore((s) => s.select);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const query = q.trim().toUpperCase();
    if (query.length < 2) return [];
    const out = [];
    for (const m of meta) {
      if (
        m.name.toUpperCase().includes(query) ||
        String(m.noradId).startsWith(query)
      ) {
        out.push(m);
        if (out.length >= 10) break;
      }
    }
    return out;
  }, [q, meta]);

  const pick = (index: number) => {
    select(index);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        className="search-input"
        placeholder="Search satellite or NORAD ID…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search satellites"
      />
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox">
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
