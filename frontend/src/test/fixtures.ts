import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RiskCollection, RiskDetailProperties, RiskFeature, ScenarioState } from "../api/types";

// Shared with the backend: data/fixtures/*.sample.json (regenerate with tools/export_fixtures.py)
// Vitest runs with cwd = frontend/, so the shared fixtures live one level up.
const load = (name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), "..", "data", "fixtures", name), "utf8"));

export const riskFixture = load("risk_response.sample.json") as RiskCollection;
export const detailFixture = load("risk_detail.sample.json") as RiskFeature<RiskDetailProperties>;
export const scenarioFixture: ScenarioState = {
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
