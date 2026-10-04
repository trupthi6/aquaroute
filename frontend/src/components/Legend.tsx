import { CLASS_ORDER, CLASS_STYLE } from "../lib/risk";

export default function Legend() {
  return (
    <div className="legend" aria-label="Map legend">
      {CLASS_ORDER.map((c) => {
        const s = CLASS_STYLE[c];
        return (
          <div key={c} className="legend-row">
            <svg width="34" height="12" aria-hidden="true">
              <line x1="2" y1="6" x2="32" y2="6" stroke={s.color} strokeWidth={s.weight} strokeDasharray={s.dashArray} strokeLinecap="round" />
            </svg>
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
