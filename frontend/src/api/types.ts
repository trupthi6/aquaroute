// Mirrors backend/app/models/risk.py. Keep in sync with docs/api-contract.md.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskClass = RiskLevel | "CRITICAL";
export type FreshnessState = "fresh" | "aging" | "stale";
export type ViewMode = "now" | "peak";

export interface Freshness {
  as_of: string;
  age_seconds: number;
  state: FreshnessState;
}
export interface RiskWindow {
  start_min: number;
  end_min: number;
}
export interface RiskProperties {
  segment_id: string;
  name: string;
  kind: string;
  risk_probability: number;
  risk_class: RiskClass;
  risk_level: RiskLevel;
  confidence: number;
  peak_risk_probability: number;
  peak_risk_class: RiskClass;
  peak_risk_level: RiskLevel;
  peak_in_min: number;
  expected_window: RiskWindow | null;
  top_factors: string[];
  verified_block: boolean;
  data_freshness: Freshness;
}
export interface CurvePoint {
  t_min: number;
  risk_probability: number;
  risk_class: RiskClass;
  risk_level: RiskLevel;
}
export interface FactorContribution {
  factor: string;
  key: string;
  contribution: number;
  share: number;
}
export interface RiskDetailProperties extends RiskProperties {
  forecast_curve: CurvePoint[];
  factor_contributions: FactorContribution[];
  static_features: Record<string, unknown>;
}
export interface LineStringGeometry {
  type: "LineString";
  coordinates: [number, number][]; // [lon, lat]
}
export interface RiskFeature<P = RiskProperties> {
  type: "Feature";
  id: string;
  geometry: LineStringGeometry;
  properties: P;
}
export type LevelCounts = Record<RiskLevel, number>;
export interface DatasetMetadata {
  name: string;
  synthetic: boolean;
  source: string;
  notes?: string;
}
export interface RiskMetadata {
  model: string;
  scenario: string;
  scenario_description: string;
  simulated_now: string;
  now_offset_min: number;
  horizon_min: number;
  generated_at: string;
  segment_count: number;
  summary_now: LevelCounts;
  summary_peak: LevelCounts;
  disclaimer: string;
  dataset?: DatasetMetadata;
}
export interface RiskCollection {
  type: "FeatureCollection";
  metadata: RiskMetadata;
  features: RiskFeature[];
}
export interface ScenarioState {
  scenario: string;
  description: string;
  now_offset_min: number;
  duration_min: number;
  step_minutes: number;
  simulated_now: string;
  rain_data_age_min: number;
  current_intensity_mm_hr: number;
  available_scenarios: string[];
}
export interface ScenarioUpdate {
  scenario?: string;
  now_offset_min?: number;
  rain_data_age_min?: number;
}
