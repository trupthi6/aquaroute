/**
 * RoutePanel – Module 3 safe-routing UI.
 * Calls POST /api/v1/route, shows fastest vs safest comparison.
 */
import { useState } from "react";
import { ApiError, fetchDemoTrip, postRoute } from "../api/client";
import type { LatLng, RouteResponse, ViewMode } from "../api/types";

interface Props {
  view: ViewMode;
  onRouteResult: (res: RouteResponse | null) => void;
}

const fmtDur = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

const REC_STYLE: Record<string, { label: string; cls: string }> = {
  SAFER_ROUTE:     { label: "Safer route available", cls: "rec-safer" },
  FASTEST_IS_SAFE: { label: "Fastest is safe",       cls: "rec-safe"  },
  NO_SAFE_ROUTE:   { label: "No safe route",          cls: "rec-none"  },
};

export default function RoutePanel({ view, onRouteResult }: Props) {
  const [oLat, setOLat] = useState("");
  const [oLon, setOLon] = useState("");
  const [dLat, setDLat] = useState("");
  const [dLon, setDLon] = useState("");
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const validCoord = (v: string) => v.trim() !== "" && !isNaN(Number(v));
  const canRoute = validCoord(oLat) && validCoord(oLon) && validCoord(dLat) && validCoord(dLon);

  async function loadDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      const demo = await fetchDemoTrip(view);
      setOLat(String(demo.origin.lat));
      setOLon(String(demo.origin.lon));
      setDLat(String(demo.destination.lat));
      setDLon(String(demo.destination.lon));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load demo trip");
    } finally {
      setDemoLoading(false);
    }
  }

  async function compute() {
    if (!canRoute) return;
    setBusy(true);
    setError(null);
    try {
      const origin: LatLng = { lat: Number(oLat), lon: Number(oLon) };
      const destination: LatLng = { lat: Number(dLat), lon: Number(dLon) };
      const res = await postRoute({ origin, destination, view });
      setResult(res);
      onRouteResult(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Route computation failed";
      setError(msg);
      setResult(null);
      onRouteResult(null);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setResult(null);
    setError(null);
    onRouteResult(null);
    setOLat(""); setOLon(""); setDLat(""); setDLon("");
  }

  const rec = result ? REC_STYLE[result.recommendation] ?? REC_STYLE.NO_SAFE_ROUTE : null;

  return (
    <section className="card route-panel" aria-label="Safe route planner">
      <h2>🗺 Safe Route Planner</h2>

      {/* Origin */}
      <fieldset className="coord-set">
        <legend className="coord-legend">Origin</legend>
        <div className="coord-row">
          <label className="coord-label">
            Lat
            <input
              id="route-origin-lat"
              className="coord-input"
              type="number"
              step="any"
              placeholder="12.9215"
              value={oLat}
              onChange={(e) => setOLat(e.target.value)}
              aria-label="Origin latitude"
            />
          </label>
          <label className="coord-label">
            Lon
            <input
              id="route-origin-lon"
              className="coord-input"
              type="number"
              step="any"
              placeholder="77.6400"
              value={oLon}
              onChange={(e) => setOLon(e.target.value)}
              aria-label="Origin longitude"
            />
          </label>
        </div>
      </fieldset>

      {/* Destination */}
      <fieldset className="coord-set">
        <legend className="coord-legend">Destination</legend>
        <div className="coord-row">
          <label className="coord-label">
            Lat
            <input
              id="route-dest-lat"
              className="coord-input"
              type="number"
              step="any"
              placeholder="12.9215"
              value={dLat}
              onChange={(e) => setDLat(e.target.value)}
              aria-label="Destination latitude"
            />
          </label>
          <label className="coord-label">
            Lon
            <input
              id="route-dest-lon"
              className="coord-input"
              type="number"
              step="any"
              placeholder="77.6725"
              value={dLon}
              onChange={(e) => setDLon(e.target.value)}
              aria-label="Destination longitude"
            />
          </label>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="route-actions">
        <button
          id="route-demo-btn"
          className="btn-secondary"
          onClick={loadDemo}
          disabled={demoLoading || busy}
          aria-label="Load demo trip coordinates"
        >
          {demoLoading ? "Loading…" : "Load demo trip"}
        </button>
        <button
          id="route-compute-btn"
          className="btn-primary"
          onClick={compute}
          disabled={!canRoute || busy}
          aria-label="Compute safe route"
        >
          {busy ? "Computing…" : "Compute route"}
        </button>
        {result && (
          <button id="route-clear-btn" className="btn-ghost" onClick={clear} aria-label="Clear route">
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="route-error" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      {/* Result */}
      {result && rec && (
        <div className="route-result" aria-label="Route result">
          <span className={`route-rec ${rec.cls}`} aria-label="Route recommendation">
            {rec.label}
          </span>

          <table className="route-table" aria-label="Route comparison">
            <thead>
              <tr>
                <th></th>
                <th>Fastest</th>
                {result.safest && result.recommendation === "SAFER_ROUTE" && <th>Safest</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Distance</td>
                <td>{fmtDist(result.fastest.distance_m)}</td>
                {result.safest && result.recommendation === "SAFER_ROUTE" && <td>{fmtDist(result.safest.distance_m)}</td>}
              </tr>
              <tr>
                <td>Duration</td>
                <td>{fmtDur(result.fastest.duration_s)}</td>
                {result.safest && result.recommendation === "SAFER_ROUTE" && <td>{fmtDur(result.safest.duration_s)}</td>}
              </tr>
              <tr>
                <td>Mean risk</td>
                <td>{(result.fastest.mean_risk * 100).toFixed(0)}%</td>
                {result.safest && result.recommendation === "SAFER_ROUTE" && <td>{(result.safest.mean_risk * 100).toFixed(0)}%</td>}
              </tr>
              <tr>
                <td>Max class</td>
                <td>
                  <span className={`badge badge-${result.fastest.max_risk_class}`}>
                    {result.fastest.max_risk_class}
                  </span>
                </td>
                {result.safest && result.recommendation === "SAFER_ROUTE" && (
                  <td>
                    <span className={`badge badge-${result.safest.max_risk_class}`}>
                      {result.safest.max_risk_class}
                    </span>
                  </td>
                )}
              </tr>
            </tbody>
          </table>

          {result.comparison && result.recommendation === "SAFER_ROUTE" && (
            <dl className="route-diff">
              <dt>Extra time</dt>
              <dd>+{fmtDur(result.comparison.extra_time_s)}</dd>
              <dt>Extra distance</dt>
              <dd>+{fmtDist(result.comparison.extra_distance_m)}</dd>
              <dt>High-risk roads avoided</dt>
              <dd>{result.comparison.high_risk_roads_avoided}</dd>
              <dt>Risk reduction</dt>
              <dd>{(result.comparison.mean_risk_reduction * 100).toFixed(0)}%</dd>
            </dl>
          )}

          {result.reasons.length > 0 && (
            <ul className="route-reasons" aria-label="Route reasons">
              {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}

          {result.warnings.length > 0 && (
            <ul className="route-warnings" aria-label="Route warnings">
              {result.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
