import type { Freshness, FreshnessState, RiskCollection, RiskWindow } from "../api/types";

export function formatAge(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min ago` : `${h} h ago`;
}

/** HH:MM taken straight from an ISO string, so output never depends on the viewer's timezone. */
export const formatClock = (iso: string): string => iso.slice(11, 16);

export const confidencePct = (c: number): number => Math.round(c * 100);

export function windowText(w: RiskWindow | null): string {
  if (!w) return "No HIGH risk expected in the next 3 h";
  if (w.start_min === 0 && w.end_min >= 180) return "HIGH risk now and for the next 3 h";
  if (w.start_min === 0) return `HIGH risk now, easing in ~${w.end_min} min`;
  if (w.end_min >= 180) return `HIGH risk from ~${w.start_min} min, lasting beyond 3 h`;
  return `HIGH risk expected in ${w.start_min}-${w.end_min} min`;
}

export const FRESHNESS_LABEL: Record<FreshnessState, string> = {
  fresh: "FRESH",
  aging: "AGING",
  stale: "STALE",
};

export function freshnessMessage(f: Freshness): string {
  const base = `Rain data as of ${formatClock(f.as_of)} (${formatAge(f.age_seconds)})`;
  if (f.state === "stale") return `${base}. Rain data is out of date - treat these estimates with caution.`;
  if (f.state === "aging") return `${base}. Data is getting old; confidence is reduced.`;
  return base;
}

/** All segments share one rain feed, so the first feature's freshness represents the map. */
export const mapFreshness = (c: RiskCollection): Freshness | null => c.features[0]?.properties.data_freshness ?? null;
