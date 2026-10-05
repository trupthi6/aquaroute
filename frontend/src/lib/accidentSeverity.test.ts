import { describe, expect, it } from "vitest";
import { calculateLocalAccidentSeverity, PILOT_EMERGENCY_HOSPITALS } from "./accidentSeverity";
import type { SensorReading } from "../api/types";

const baseReading: SensorReading = {
  timestamp_ms: Date.now(),
  accel_x: 0,
  accel_y: 0,
  accel_z: 9.8,
  total_g: 1.0,
  gyro_alpha: 0,
  gyro_beta: 0,
  gyro_gamma: 0,
  rotation_rate_deg_s: 5.0,
  pitch_deg: 0,
  roll_deg: 0,
  speed_kmh: 40.0,
  inactivity_seconds: 0,
};

describe("Client-Side AI Accident Severity (Module 4)", () => {
  it("scores normal driving as Minor (< 30%) with no auto SOS", () => {
    const res = calculateLocalAccidentSeverity(baseReading);
    expect(res.severity_score).toBeLessThanOrEqual(30);
    expect(res.severity_level).toBe("Minor");
    expect(res.trigger_sos).toBe(false);
  });

  it("scores side impact collision as Moderate (31 - 70%)", () => {
    const reading: SensorReading = {
      ...baseReading,
      total_g: 4.8,
      rotation_rate_deg_s: 160.0,
      pitch_deg: 24.0,
      speed_kmh: 45.0,
      inactivity_seconds: 3.0,
    };
    const res = calculateLocalAccidentSeverity(reading);
    expect(res.severity_score).toBeGreaterThanOrEqual(31);
    expect(res.severity_score).toBeLessThanOrEqual(70);
    expect(res.severity_level).toBe("Moderate");
    expect(res.trigger_sos).toBe(false); // driver prompt
  });

  it("scores severe rollover crash as Critical (71 - 100%) and triggers auto SOS", () => {
    const reading: SensorReading = {
      ...baseReading,
      total_g: 8.8,
      rotation_rate_deg_s: 380.0,
      pitch_deg: 75.0,
      speed_kmh: 70.0,
      inactivity_seconds: 12.0,
    };
    const res = calculateLocalAccidentSeverity(reading);
    expect(res.severity_score).toBeGreaterThanOrEqual(71);
    expect(res.severity_level).toBe("Critical");
    expect(res.trigger_sos).toBe(true);
  });

  it("provides 5-factor breakdown and nearby hospitals", () => {
    const res = calculateLocalAccidentSeverity(baseReading);
    expect(res.breakdown).toHaveProperty("impact_score");
    expect(res.breakdown).toHaveProperty("rotation_score");
    expect(res.breakdown).toHaveProperty("jerk_score");
    expect(res.breakdown).toHaveProperty("speed_score");
    expect(res.breakdown).toHaveProperty("inactivity_score");
    expect(res.nearby_hospitals).toHaveLength(PILOT_EMERGENCY_HOSPITALS.length);
  });
});
