import type { Freshness } from "../api/types";
import { FRESHNESS_LABEL, freshnessMessage } from "../lib/freshness";

interface Props {
  freshness: Freshness;
  scenarioName: string;
  simulatedNow: string;
}

/** Always visible. Data freshness must never be hidden from the user. */
export default function FreshnessBanner({ freshness, scenarioName, simulatedNow }: Props) {
  return (
    <div className={`banner banner-${freshness.state}`} role={freshness.state === "stale" ? "alert" : "status"}>
      <strong>{FRESHNESS_LABEL[freshness.state]}</strong>
      <span>{freshnessMessage(freshness)}</span>
      <span className="banner-meta">
        Simulated scenario: {scenarioName.replace("_", " ")} · clock {simulatedNow.slice(11, 16)}
      </span>
    </div>
  );
}
