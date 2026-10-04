import type { RiskDetailProperties } from "../api/types";
import { confidencePct, windowText } from "../lib/freshness";
import ForecastCurve from "./ForecastCurve";
import RiskBadge from "./RiskBadge";

interface Props {
  detail: RiskDetailProperties;
  onClose: () => void;
}

export default function SegmentPanel({ detail: d, onClose }: Props) {
  const facts = d.static_features;
  return (
    <section className="card segment" aria-label="Selected road details">
      <div className="segment-head">
        <div>
          <h2>{d.name}</h2>
          <p className="muted">{d.segment_id} · {d.kind}</p>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close details">×</button>
      </div>

      <div className="badges">
        <RiskBadge riskClass={d.risk_class} prefix="Now:" />
        <RiskBadge riskClass={d.peak_risk_class} prefix="Peak:" />
      </div>
      {d.verified_block && <p className="notice">Responder-verified road blockage</p>}

      <dl className="kv">
        <dt>Risk index now</dt><dd>{d.risk_probability.toFixed(2)}</dd>
        <dt>Peak</dt><dd>{d.peak_risk_probability.toFixed(2)} in ~{d.peak_in_min} min</dd>
        <dt>Confidence</dt><dd>{confidencePct(d.confidence)}%</dd>
        <dt>Window</dt><dd>{windowText(d.expected_window)}</dd>
      </dl>

      <h3>Why?</h3>
      <ul className="factors">{d.top_factors.map((f) => <li key={f}>{f}</li>)}</ul>

      <h3>Next 3 hours</h3>
      <ForecastCurve points={d.forecast_curve} />

      <details>
        <summary>Road facts (sample data)</summary>
        <ul className="facts">
          <li>Elevation: {String(facts.elevation_m ?? "n/a")} m</li>
          <li>Drain capacity: {String(facts.drain_capacity_mm_hr ?? "n/a")} mm/hr</li>
          <li>Distance to drain: {String(facts.drain_distance_m ?? "n/a")} m</li>
          <li>Past waterlogging score: {String(facts.history_score ?? "n/a")}</li>
        </ul>
      </details>
      <p className="muted small">Risk estimate for decision support. The index is uncalibrated and not a guarantee.</p>
    </section>
  );
}
