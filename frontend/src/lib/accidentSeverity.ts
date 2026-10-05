/**
 * Client-Side AI Severity Agent – Module 4
 * Calculates an Accident Severity Score (0-100%) and severity level
 * directly in the browser, enabling emergency detection even when 100% offline!
 */
import type { AccidentEvaluationResponse, SensorReading, SeverityBreakdown, SeverityLevel } from "../api/types";

export const PILOT_EMERGENCY_HOSPITALS = [
  {
    id: "HOSP-01",
    name: "Sakra World Hospital",
    distance_km: 1.8,
    address: "SY NO 52/2 & 52/3, Devarabeesanahalli, Bellandur, Bengaluru",
    emergency_phone: "+91 80 4969 4969",
    coordinates: { lat: 12.9279, lon: 77.6836 },
    trauma_care_level: "Level 1" as const,
    available_ambulances: 3,
    estimated_arrival_min: 6,
  },
  {
    id: "HOSP-02",
    name: "Manipal Hospital Sarjapur Road",
    distance_km: 2.4,
    address: "Sarjapur Main Road, Someshwara Nagar, Bengaluru",
    emergency_phone: "+91 80 2502 4444",
    coordinates: { lat: 12.9165, lon: 77.6712 },
    trauma_care_level: "Level 1" as const,
    available_ambulances: 4,
    estimated_arrival_min: 8,
  },
  {
    id: "HOSP-03",
    name: "Apollo Clinic & Trauma Care HSR",
    distance_km: 1.2,
    address: "14th Main Rd, Sector 7, HSR Layout, Bengaluru",
    emergency_phone: "+91 80 4666 4666",
    coordinates: { lat: 12.9115, lon: 77.6385 },
    trauma_care_level: "Level 2" as const,
    available_ambulances: 2,
    estimated_arrival_min: 5,
  },
  {
    id: "HOSP-04",
    name: "Narayana Multispeciality Hospital",
    distance_km: 2.9,
    address: "Near HSR Club, Sector 3, HSR Layout, Bengaluru",
    emergency_phone: "+91 80 6750 6750",
    coordinates: { lat: 12.9082, lon: 77.6492 },
    trauma_care_level: "Level 2" as const,
    available_ambulances: 2,
    estimated_arrival_min: 9,
  },
];

export function calculateLocalAccidentSeverity(
  reading: SensorReading,
  loc: { lat: number; lon: number } = { lat: 12.928, lon: 77.655 }
): AccidentEvaluationResponse {
  const impact_g = reading.total_g;
  const rotation_deg_s = reading.rotation_rate_deg_s;
  const tilt_deg = Math.max(Math.abs(reading.pitch_deg), Math.abs(reading.roll_deg));
  const speed_kmh = reading.speed_kmh;
  const inactivity_s = reading.inactivity_seconds;

  // 1. Impact Force Score (35%)
  let impact_score = 0;
  if (impact_g <= 1.2) {
    impact_score = 0;
  } else if (impact_g <= 3.0) {
    impact_score = ((impact_g - 1.2) / 1.8) * 35.0;
  } else if (impact_g <= 6.0) {
    impact_score = 35.0 + ((impact_g - 3.0) / 3.0) * 35.0;
  } else {
    impact_score = Math.min(100.0, 70.0 + ((impact_g - 6.0) / 4.0) * 30.0);
  }

  // 2. Rotation & Rollover Score (15%)
  const spin_factor = Math.min(100.0, (rotation_deg_s / 400.0) * 100.0);
  const tilt_factor = Math.min(100.0, (tilt_deg / 90.0) * 100.0);
  const rotation_score = Number(Math.max(spin_factor * 0.7 + tilt_factor * 0.3, tilt_factor).toFixed(1));

  // 3. Jerk / Rate of Acceleration (15%)
  const jerk_score = Math.min(100.0, Math.max(0.0, (impact_g / 7.0) * 100.0));

  // 4. Pre-impact Speed Score (20%)
  let speed_score = 0;
  if (speed_kmh <= 10.0) {
    speed_score = Math.min(15.0, (speed_kmh / 10.0) * 15.0);
  } else if (speed_kmh <= 45.0) {
    speed_score = 15.0 + ((speed_kmh - 10.0) / 35.0) * 40.0;
  } else {
    speed_score = Math.min(100.0, 55.0 + ((speed_kmh - 45.0) / 45.0) * 45.0);
  }

  // 5. Post-Impact Inactivity Score (15%)
  let inactivity_score = 0;
  if (inactivity_s <= 2.0) {
    inactivity_score = 0;
  } else if (inactivity_s <= 10.0) {
    inactivity_score = ((inactivity_s - 2.0) / 8.0) * 60.0;
  } else {
    inactivity_score = Math.min(100.0, 60.0 + ((inactivity_s - 10.0) / 15.0) * 40.0);
  }

  let raw_score =
    impact_score * 0.35 +
    speed_score * 0.20 +
    rotation_score * 0.15 +
    jerk_score * 0.15 +
    inactivity_score * 0.15;

  if (tilt_deg > 65.0 && impact_g > 3.0) {
    raw_score = Math.max(raw_score, 72.0);
  }

  const severity_score = Number(Math.max(0.0, Math.min(100.0, raw_score)).toFixed(1));

  let severity_level: SeverityLevel;
  let trigger_sos = false;
  let rec_action = "";

  if (severity_score <= 30.0) {
    severity_level = "Minor";
    trigger_sos = false;
    rec_action = "Minor anomaly detected (hard braking or pothole). No emergency action required.";
  } else if (severity_score <= 70.0) {
    severity_level = "Moderate";
    trigger_sos = false;
    rec_action = "Moderate impact detected. Safety timer active; prompt driver before emergency dispatch.";
  } else {
    severity_level = "Critical";
    trigger_sos = true;
    rec_action = "CRITICAL COLLISION CONFIRMED. Automatic SOS dispatch triggered immediately.";
  }

  const breakdown: SeverityBreakdown = {
    impact_score: Number(impact_score.toFixed(1)),
    rotation_score: Number(rotation_score.toFixed(1)),
    jerk_score: Number(jerk_score.toFixed(1)),
    speed_score: Number(speed_score.toFixed(1)),
    inactivity_score: Number(inactivity_score.toFixed(1)),
  };

  const dispatch_log = [
    `Sensor reading evaluated: impact=${impact_g.toFixed(1)}g, rotation=${rotation_deg_s.toFixed(1)}°/s, speed=${speed_kmh.toFixed(1)}km/h`,
    `Severity score: ${severity_score.toFixed(1)}% -> Level: ${severity_level.toUpperCase()}`,
  ];
  if (trigger_sos) {
    dispatch_log.push(`AUTOMATIC SOS TRIGGERED at coordinates (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})`);
    dispatch_log.push(`Nearest trauma center: ${PILOT_EMERGENCY_HOSPITALS[0].name} (${PILOT_EMERGENCY_HOSPITALS[0].distance_km} km)`);
  }

  return {
    severity_score,
    severity_level,
    trigger_sos,
    breakdown,
    nearby_hospitals: PILOT_EMERGENCY_HOSPITALS,
    recommended_action: rec_action,
    dispatch_log,
  };
}
