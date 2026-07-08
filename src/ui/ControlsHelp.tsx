import { useState } from "react";

// Small collapsible legend for the mouse + keyboard controls. Collapsed to a
// pill by default so it never dominates the view; expands into a compact card.
export function ControlsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className={`controls-help${open ? " open" : ""}`}>
      {open && (
        <div className="controls-card">
          <div className="controls-section">
            <div className="controls-head">Navigate</div>
            <ul>
              <li><kbd>Drag</kbd><span>rotate view</span></li>
              <li><kbd>Scroll</kbd><span>zoom toward cursor</span></li>
              <li><kbd>Dbl-click</kbd><span>fly to a body</span></li>
            </ul>
          </div>
          <div className="controls-section">
            <div className="controls-head">
              Fly mode <kbd>K</kbd>
            </div>
            <ul>
              <li><kbd>↑ ↓</kbd><span>forward / back</span></li>
              <li><kbd>← →</kbd><span>strafe left / right</span></li>
              <li><kbd>W / S</kbd><span>look up / down</span></li>
              <li><kbd>A / D</kbd><span>look left / right</span></li>
              <li><kbd>Q / E</kbd><span>descend / rise</span></li>
            </ul>
          </div>
        </div>
      )}
      <button
        className="controls-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Show controls"
      >
        <span className="controls-icon">⌨</span>
        <span>CONTROLS</span>
        <span className="controls-caret">{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );
}
