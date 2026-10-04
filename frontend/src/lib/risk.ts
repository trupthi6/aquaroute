import type { PathOptions } from "leaflet";
import type { RiskClass, RiskProperties, ViewMode } from "../api/types";

// Colour is NEVER the only signal: every class also has a text label and a distinct line pattern.
export interface ClassStyle {
  color: string;
  weight: number;
  dashArray?: string;
  label: string;
}
export const CLASS_STYLE: Record<RiskClass, ClassStyle> = {
  LOW: { color: "#2e7d32", weight: 4, label: "LOW" },
  MEDIUM: { color: "#f9a825", weight: 5, dashArray: "10 6", label: "MEDIUM" },
  HIGH: { color: "#d32f2f", weight: 7, label: "HIGH" },
  CRITICAL: { color: "#6a1b9a", weight: 9, dashArray: "2 6", label: "CRITICAL" },
};
export const CLASS_ORDER: RiskClass[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const classFor = (p: RiskProperties, view: ViewMode): RiskClass =>
  view === "now" ? p.risk_class : p.peak_risk_class;

export const probabilityFor = (p: RiskProperties, view: ViewMode): number =>
  view === "now" ? p.risk_probability : p.peak_risk_probability;

export function segmentStyle(p: RiskProperties, view: ViewMode): PathOptions {
  const s = CLASS_STYLE[classFor(p, view)];
  return { color: s.color, weight: s.weight, dashArray: s.dashArray, opacity: 0.95, lineCap: "round" };
}

export function topRisks(features: { properties: RiskProperties }[], view: ViewMode, n = 5) {
  return [...features]
    .sort((a, b) => probabilityFor(b.properties, view) - probabilityFor(a.properties, view))
    .slice(0, n)
    .map((f) => f.properties);
}
