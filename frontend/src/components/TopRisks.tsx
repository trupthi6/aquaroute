import type { RiskProperties, ViewMode } from "../api/types";
import { classFor, probabilityFor } from "../lib/risk";
import RiskBadge from "./RiskBadge";

interface Props {
  items: RiskProperties[];
  view: ViewMode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Keyboard- and screen-reader-friendly alternative to clicking on the map. */
export default function TopRisks({ items, view, selectedId, onSelect }: Props) {
  return (
    <section className="card" aria-label="Highest-risk roads">
      <h2>Highest-risk roads</h2>
      <ol className="toplist">
        {items.map((p) => (
          <li key={p.segment_id}>
            <button type="button" className={p.segment_id === selectedId ? "sel" : ""} onClick={() => onSelect(p.segment_id)}>
              <span className="top-name">{p.name}</span>
              <span className="top-meta">{Math.round(probabilityFor(p, view) * 100)}%</span>
              <RiskBadge riskClass={classFor(p, view)} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
