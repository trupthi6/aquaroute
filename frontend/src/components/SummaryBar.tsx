import type { LevelCounts, ViewMode } from "../api/types";
import { CLASS_STYLE } from "../lib/risk";

const LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export default function SummaryBar({ counts, view, total }: { counts: LevelCounts; view: ViewMode; total: number }) {
  return (
    <section className="card" aria-label="Risk summary">
      <h2>{view === "now" ? "Right now" : "Worst case, next 3 h"}</h2>
      <div className="summary">
        {LEVELS.map((l) => (
          <div key={l} className="summary-item" data-testid={`count-${l}`}>
            <span className="summary-dot" style={{ background: CLASS_STYLE[l].color }} aria-hidden="true" />
            <strong>{counts[l]}</strong> {l}
          </div>
        ))}
      </div>
      <p className="muted">{total} road segments in the pilot catchment</p>
    </section>
  );
}
