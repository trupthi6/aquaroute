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

// Module 4: Smart SOS System
export interface SensorReading {
  timestamp_ms: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  total_g: number;
  gyro_alpha: number;
  gyro_beta: number;
  gyro_gamma: number;
  rotation_rate_deg_s: number;
  pitch_deg: number;
  roll_deg: number;
  speed_kmh: number;
  inactivity_seconds: number;
}

export type SeverityLevel = "Minor" | "Moderate" | "Critical";

export interface SeverityBreakdown {
  impact_score: number;
  rotation_score: number;
  jerk_score: number;
  speed_score: number;
  inactivity_score: number;
}

export interface HospitalInfo {
  id: string;
  name: string;
  distance_km: number;
  address: string;
  emergency_phone: string;
  coordinates: { lat: number; lon: number };
  trauma_care_level: "Level 1" | "Level 2" | "Level 3";
  available_ambulances: number;
  estimated_arrival_min: number;
}

export interface AccidentEvaluationRequest {
  reading?: SensorReading;
  impact_force_g: number;
  max_rotation_deg_s: number;
  tilt_angle_deg: number;
  pre_impact_speed_kmh: number;
  inactivity_seconds: number;
  location: { lat: number; lon: number };
}

export interface AccidentEvaluationResponse {
  severity_score: number;
  severity_level: SeverityLevel;
  trigger_sos: boolean;
  breakdown: SeverityBreakdown;
  nearby_hospitals: HospitalInfo[];
  recommended_action: string;
  dispatch_log: string[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface SOSTriggerRequest {
  location: { lat: number; lon: number };
  severity_score: number;
  severity_level: SeverityLevel;
  contacts?: EmergencyContact[];
  auto_detected?: boolean;
  incident_type?: string;
  message_override?: string;
}

export interface SOSTriggerResponse {
  sos_id: string;
  status: "DISPATCHED" | "PENDING" | "CANCELLED";
  timestamp: string;
  severity_level: string;
  severity_score: number;
  location: { lat: number; lon: number };
  simulated_sms_sent: Array<{
    recipient_name: string;
    recipient_phone: string;
    relation: string;
    status: string;
    message: string;
  }>;
  hospital_alert_sent: {
    hospital_id: string;
    hospital_name: string;
    emergency_phone: string;
    distance_km: number;
    eta_min: number;
    trauma_team_alerted: boolean;
    dispatch_status: string;
  };
  logs: string[];
}

// Module 5: Offline Resilience
export type NetworkQuality = "good" | "weak" | "offline";

export interface OfflinePackageMetadata {
  version: string;
  generated_at: string;
  catchment: string;
  bbox: number[];
  total_segments: number;
  package_size_kb: number;
  description: string;
}

export interface OfflinePackage {
  metadata: OfflinePackageMetadata;
  segments_geojson: Record<string, unknown>;
  current_risk: RiskCollection;
  key_safe_routes: RouteResponse[];
  emergency_hospitals: HospitalInfo[];
}
