import { useEffect, useRef, useState } from "react";
import type { ScenarioState, ScenarioUpdate } from "../api/types";

const STALE_AGE_MIN = 90;
const FRESH_AGE_MIN = 1;

interface Props {
  scenario: ScenarioState;
  busy: boolean;
  onApply: (u: ScenarioUpdate) => void;
  debounceMs?: number;
}

/** Judge/operator controls: pick a rain scenario, scrub the simulated clock, simulate stale data. */
export default function DemoPanel({ scenario, busy, onApply, debounceMs = 250 }: Props) {
  const [offset, setOffset] = useState(scenario.now_offset_min);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Keep the slider in step with the server (e.g. after switching scenario).
  useEffect(() => setOffset(scenario.now_offset_min), [scenario.now_offset_min]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onSlide = (v: number) => {
    setOffset(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onApply({ now_offset_min: v }), debounceMs); // wait for the drag to settle
  };

  const hours = String(Math.floor(offset / 60)).padStart(2, "0");
  const mins = String(offset % 60).padStart(2, "0");

  return (
    <section className="card" aria-label="Demo controls">
      <h2>Demo controls {busy && <span className="muted small">updating…</span>}</h2>

      <label className="field">
        Rain scenario
        <select value={scenario.scenario} onChange={(e) => onApply({ scenario: e.target.value })}>
          {scenario.available_scenarios.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </label>
      <p className="muted small">{scenario.description}</p>

      <label className="field">
        Simulated time: +{hours}:{mins} · rain {scenario.current_intensity_mm_hr} mm/hr
        <input type="range" min={0} max={scenario.duration_min} step={scenario.step_minutes}
          value={offset} onChange={(e) => onSlide(Number(e.target.value))} aria-label="Simulated time offset in minutes" />
      </label>

      <label className="check">
        <input type="checkbox" checked={scenario.rain_data_age_min >= STALE_AGE_MIN}
          onChange={(e) => onApply({ rain_data_age_min: e.target.checked ? STALE_AGE_MIN : FRESH_AGE_MIN })} />
        Simulate stale rain data
      </label>
    </section>
  );
}
