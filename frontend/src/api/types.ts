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

// ── Module 3: Routing ──────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lon: number;
}

export interface SnappedPoint extends LatLng {
  snapped_lat: number;
  snapped_lon: number;
  snap_distance_m: number;
}

export interface SegmentAtRisk {
  segment_id: string;
  name: string;
  risk_class: RiskClass;
  risk_probability: number;
}

export interface Route {
  segment_ids: string[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance_m: number;
  duration_s: number;
  mean_risk: number;
  max_risk_class: RiskClass;
  segments_at_risk: SegmentAtRisk[];
  cost: number;
}

export interface RouteComparison {
  extra_time_s: number;
  extra_distance_m: number;
  high_risk_roads_avoided: number;
  critical_roads_avoided: number;
  mean_risk_reduction: number;
}

export interface RouteResponse {
  status: "OK" | "NO_SAFE_ROUTE";
  recommendation: "FASTER_IS_SAFE" | "FASTEST_IS_SAFE" | "SAFER_ROUTE" | "NO_SAFE_ROUTE";
  view: ViewMode;
  origin: SnappedPoint;
  destination: SnappedPoint;
  fastest: Route;
  safest: Route | null;
  comparison: RouteComparison | null;
  reasons: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  view?: ViewMode;
  blocked_segment_ids?: string[];
}

export interface DemoTripResponse {
  origin: LatLng;
  destination: LatLng;
  note: string;
}
