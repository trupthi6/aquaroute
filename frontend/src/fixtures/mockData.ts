import type { DemoTripResponse, RiskCollection, RiskDetailProperties, RiskFeature, RouteResponse, ScenarioState } from "../api/types";
import rawRisk from "./pilot_risk.json";
import rawRoute from "./route_response.sample.json";
import rawDetail from "./risk_detail.sample.json";

export const fallbackRisk = rawRisk as unknown as RiskCollection;
export const fallbackRoute = rawRoute as unknown as RouteResponse;
export const fallbackDetail = rawDetail as unknown as RiskFeature<RiskDetailProperties>;

export const fallbackDemoTrip: DemoTripResponse = {
  origin: { lat: 12.915, lon: 77.6725 },
  destination: { lat: 12.9215, lon: 77.6465 },
  note: "Fastest route crosses Agara Underpass (sample) (HIGH), but a safer alternative is available.",
};

export const fallbackScenario: ScenarioState = {
  scenario: "heavy_rain",
  description: "Intense cloudburst-style event peaking around +240 min.",
  now_offset_min: 210,
  duration_min: 480,
  step_minutes: 5,
  simulated_now: "2026-10-03T17:30:00+05:30",
  rain_data_age_min: 1,
  current_intensity_mm_hr: 44.5,
  available_scenarios: ["extreme_rain", "heavy_rain", "moderate_rain", "normal"],
};
