import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchDetail } from "./api/client";
import type { RiskDetailProperties, RouteResponse, ViewMode } from "./api/types";
import { fallbackDetail } from "./fixtures/mockData";
import DemoPanel from "./components/DemoPanel";
import FreshnessBanner from "./components/FreshnessBanner";
import Legend from "./components/Legend";
import RiskMap from "./components/map/RiskMap";
import NetworkStatusBanner from "./components/offline/NetworkStatusBanner";
import RoutePanel from "./components/RoutePanel";
import SegmentPanel from "./components/SegmentPanel";
import SOSPanel from "./components/sos/SOSPanel";
import SummaryBar from "./components/SummaryBar";
import TopRisks from "./components/TopRisks";
import ViewToggle from "./components/ViewToggle";
import { useRiskData } from "./hooks/useRiskData";
import { mapFreshness } from "./lib/freshness";
import { topRisks } from "./lib/risk";

export default function App() {
  const { risk, scenario, error, loading, busy, applyScenario } = useRiskData();
  const [view, setView] = useState<ViewMode>("peak");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiskDetailProperties | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"route" | "sos" | "scenario">("route");
  const detailSeq = useRef(0);

  // Re-fetch the selected road whenever the risk data refreshes, so the panel never goes stale.
  const generatedAt = risk?.metadata.generated_at;
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const id = ++detailSeq.current;
    fetchDetail(selectedId)
      .then((f) => id === detailSeq.current && setDetail(f.properties))
      .catch((e) => {
        if (id !== detailSeq.current) return;
        if (selectedId === fallbackDetail.id) {
          setDetail(fallbackDetail.properties);
        } else {
          const match = risk?.features.find((f) => f.id === selectedId);
          if (match) {
            setDetail({
              ...fallbackDetail.properties,
              ...match.properties,
              forecast_curve: fallbackDetail.properties.forecast_curve,
              factor_contributions: fallbackDetail.properties.factor_contributions,
              static_features: fallbackDetail.properties.static_features,
            });
          } else if (e instanceof ApiError && e.status === 404) {
            setSelectedId(null);
          }
        }
      });
  }, [selectedId, generatedAt, risk]);

  const top = useMemo(() => (risk ? topRisks(risk.features, view) : []), [risk, view]);
  const freshness = risk ? mapFreshness(risk) : null;
  const isSynthetic = risk?.metadata.dataset ? risk.metadata.dataset.synthetic : true;
  const datasetTag = isSynthetic ? "SAMPLE DATA" : "PILOT DATA - OSM roads, proxy drainage";

  return (
    <div className="app">
      <NetworkStatusBanner />
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1>AquaRoute</h1>
          <span className="tag">Street-level flood risk · next 0-3 h · {datasetTag}</span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "sos" ? "btn-danger" : "btn-secondary"}`}
            onClick={() => setActiveTab("sos")}
            style={{
              background: activeTab === "sos" ? "#d32f2f" : "#1e293b",
              color: "#fff",
              border: activeTab === "sos" ? "1px solid #ef4444" : "1px solid #475569",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🚨 Smart SOS
          </button>
        </div>
      </header>

      {error && (
        <div className="banner banner-error" role="alert">
          <strong>CONNECTION PROBLEM</strong>
          <span>{error}{risk ? " Showing the last data received." : ""}</span>
        </div>
      )}
      {risk && freshness && (
        <FreshnessBanner freshness={freshness} scenarioName={risk.metadata.scenario} simulatedNow={risk.metadata.simulated_now} />
      )}

      <main className="layout">
        <section className="map-wrap" aria-label="Flood risk map">
          <ViewToggle view={view} onChange={setView} />
          {risk ? (
            <RiskMap data={risk} view={view} selectedId={selectedId} onSelect={setSelectedId} routeResult={routeResult} />
          ) : (
            <div className="placeholder">{loading ? "Loading flood risk…" : "No data available."}</div>
          )}
          <Legend />
        </section>

        <aside className="side">
          {/* Module Selection Navigation Tabs */}
          <div
            className="module-tabs"
            style={{
              display: "flex",
              gap: "4px",
              background: "#0f172a",
              padding: "4px",
              borderRadius: "6px",
              marginBottom: "8px",
            }}
          >
            <button
              type="button"
              className={`tab-btn ${activeTab === "route" ? "active" : ""}`}
              onClick={() => setActiveTab("route")}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                background: activeTab === "route" ? "#0284c7" : "transparent",
                color: activeTab === "route" ? "#fff" : "#94a3b8",
                cursor: "pointer",
              }}
            >
              🗺 Route Planner
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "sos" ? "active" : ""}`}
              onClick={() => setActiveTab("sos")}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                background: activeTab === "sos" ? "#d32f2f" : "transparent",
                color: activeTab === "sos" ? "#fff" : "#94a3b8",
                cursor: "pointer",
              }}
            >
              🚨 Smart SOS
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "scenario" ? "active" : ""}`}
              onClick={() => setActiveTab("scenario")}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                background: activeTab === "scenario" ? "#0284c7" : "transparent",
                color: activeTab === "scenario" ? "#fff" : "#94a3b8",
                cursor: "pointer",
              }}
            >
              ⚡ Scenarios
            </button>
          </div>

          {activeTab === "route" && <RoutePanel view={view} onRouteResult={setRouteResult} />}
          {activeTab === "sos" && <SOSPanel />}

          {detail && <SegmentPanel detail={detail} onClose={() => setSelectedId(null)} />}
          {risk && (
            <SummaryBar
              counts={view === "now" ? risk.metadata.summary_now : risk.metadata.summary_peak}
              view={view}
              total={risk.metadata.segment_count}
            />
          )}
          {scenario && <DemoPanel scenario={scenario} busy={busy} onApply={applyScenario} />}
          {risk && <TopRisks items={top} view={view} selectedId={selectedId} onSelect={setSelectedId} />}
          <p className="muted small">{risk?.metadata.disclaimer}</p>
        </aside>
      </main>
    </div>
  );
}
