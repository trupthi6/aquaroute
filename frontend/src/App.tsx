import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchDetail } from "./api/client";
import type { RiskDetailProperties, ViewMode } from "./api/types";
import DemoPanel from "./components/DemoPanel";
import FreshnessBanner from "./components/FreshnessBanner";
import Legend from "./components/Legend";
import RiskMap from "./components/map/RiskMap";
import SegmentPanel from "./components/SegmentPanel";
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
        if (e instanceof ApiError && e.status === 404) setSelectedId(null);
      });
  }, [selectedId, generatedAt]);

  const top = useMemo(() => (risk ? topRisks(risk.features, view) : []), [risk, view]);
  const freshness = risk ? mapFreshness(risk) : null;
  const isSynthetic = risk?.metadata.dataset ? risk.metadata.dataset.synthetic : true;
  const datasetTag = isSynthetic ? "SAMPLE DATA" : "PILOT DATA - OSM roads, proxy drainage";

  return (
    <div className="app">
      <header className="topbar">
        <h1>AquaRoute</h1>
        <span className="tag">Street-level flood risk · next 0-3 h · {datasetTag}</span>
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
            <RiskMap data={risk} view={view} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <div className="placeholder">{loading ? "Loading flood risk…" : "No data available."}</div>
          )}
          <Legend />
        </section>

        <aside className="side">
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
