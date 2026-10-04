import type { ViewMode } from "../api/types";

const OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "peak", label: "Peak (next 3 h)" },
];

export default function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="toggle" role="group" aria-label="Risk view">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" aria-pressed={view === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
