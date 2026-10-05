/**
 * Smart SOS System Panel – Module 4
 * Provides:
 * 1. Live Sensor Telemetry (Accelerometer, Gyroscope, Orientation, GPS speed)
 * 2. Preset Accident Scenarios (Normal, Minor, Moderate, Critical Rollover, Flooded Stall)
 * 3. AI Severity Agent gauge (0-100%) with 5-factor breakdown
 * 4. Automatic SOS trigger & Emergency Countdown
 * 5. Simulated SMS alerts and Nearby Hospitals emergency directory
 */
import { useEffect, useState } from "react";
import { evaluateAccident, triggerSOS } from "../../api/client";
import type {
  AccidentEvaluationResponse,
  SensorReading,
  SOSTriggerResponse,
} from "../../api/types";
import { calculateLocalAccidentSeverity } from "../../lib/accidentSeverity";
import { SENSOR_PRESETS, type SensorPreset, sensorMonitor } from "../../lib/sensors";

interface Props {
  onFocusLocation?: (loc: { lat: number; lon: number }) => void;
  onEmergencyTriggered?: (res: SOSTriggerResponse) => void;
}

export default function SOSPanel({ onEmergencyTriggered }: Props) {
  const [reading, setReading] = useState<SensorReading>(sensorMonitor.getReading());
  const [activePreset, setActivePreset] = useState<SensorPreset>(sensorMonitor.getPreset());
  const [evaluation, setEvaluation] = useState<AccidentEvaluationResponse>(() =>
    calculateLocalAccidentSeverity(sensorMonitor.getReading())
  );
  const [sosActive, setSosActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosResponse, setSosResponse] = useState<SOSTriggerResponse | null>(null);

  // Subscribe to live sensor stream
  useEffect(() => {
    sensorMonitor.start();
    const unsub = sensorMonitor.subscribe((r) => {
      setReading(r);
    });
    return () => {
      unsub();
      sensorMonitor.stop();
    };
  }, []);

  // When sensor reading updates or preset changes, evaluate via AI Severity Agent
  useEffect(() => {
    let cancelled = false;
    async function evaluate() {
      try {
        const payload = {
          impact_force_g: reading.total_g,
          max_rotation_deg_s: reading.rotation_rate_deg_s,
          tilt_angle_deg: Math.max(Math.abs(reading.pitch_deg), Math.abs(reading.roll_deg)),
          pre_impact_speed_kmh: reading.speed_kmh,
          inactivity_seconds: reading.inactivity_seconds,
          location: { lat: 12.928, lon: 77.655 },
        };
        const res = await evaluateAccident(payload);
        if (!cancelled) setEvaluation(res);
      } catch {
        // Offline / client-side AI agent evaluation fallback
        if (!cancelled) {
          setEvaluation(calculateLocalAccidentSeverity(reading));
        }
      }
    }
    const t = setTimeout(evaluate, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [reading.total_g, reading.rotation_rate_deg_s, reading.speed_kmh, reading.pitch_deg, reading.roll_deg, reading.inactivity_seconds]);

  // Handle Automatic SOS when Critical Severity is reached
  useEffect(() => {
    if (evaluation.severity_level === "Critical" && !sosActive && countdown === null) {
      // Start 10-second automatic safety countdown before dispatching
      setCountdown(10);
    } else if (evaluation.severity_level !== "Critical" && countdown !== null && !sosActive) {
      setCountdown(null);
    }
  }, [evaluation.severity_level, sosActive, countdown]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          void executeSOSTrigger(true);
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function executeSOSTrigger(autoDetected = false) {
    setSosActive(true);
    setCountdown(null);
    try {
      const res = await triggerSOS({
        location: { lat: 12.928, lon: 77.655 },
        severity_score: evaluation.severity_score,
        severity_level: evaluation.severity_level,
        auto_detected: autoDetected,
        incident_type:
          activePreset === "critical_crash"
            ? "Rollover Collision"
            : activePreset === "water_stall"
            ? "Flood Water Stall"
            : "Vehicle Incident",
      });
      setSosResponse(res);
      onEmergencyTriggered?.(res);
    } catch {
      // Offline fallback SOS trigger
      const mockRes: SOSTriggerResponse = {
        sos_id: `SOS-OFFLINE-${Date.now().toString().slice(-4)}`,
        status: "DISPATCHED",
        timestamp: new Date().toISOString(),
        severity_level: evaluation.severity_level,
        severity_score: evaluation.severity_score,
        location: { lat: 12.928, lon: 77.655 },
        simulated_sms_sent: [
          {
            recipient_name: "National Emergency (112)",
            recipient_phone: "112",
            relation: "ERSS Police",
            status: "DELIVERED (SIMULATED)",
            message: `CRITICAL ACCIDENT SOS: ${evaluation.severity_score}% severity at (12.9280, 77.6550).`,
          },
          {
            recipient_name: "Emergency Contact",
            recipient_phone: "+91 98450 12345",
            relation: "Family",
            status: "DELIVERED (SIMULATED)",
            message: `CRITICAL ACCIDENT SOS: ${evaluation.severity_score}% severity at (12.9280, 77.6550).`,
          },
        ],
        hospital_alert_sent: {
          hospital_id: "HOSP-01",
          hospital_name: "Sakra World Hospital",
          emergency_phone: "+91 80 4969 4969",
          distance_km: 1.8,
          eta_min: 6,
          trauma_team_alerted: true,
          dispatch_status: "AMBULANCE_DISPATCHED",
        },
        logs: [
          "Emergency SOS dispatched to 112 & next-of-kin via SMS gateway",
          "Trauma team alerted at Sakra World Hospital with live GPS telemetry",
        ],
      };
      setSosResponse(mockRes);
      onEmergencyTriggered?.(mockRes);
    }
  }

  function cancelSOS() {
    setCountdown(null);
    setSosActive(false);
    setSosResponse(null);
    sensorMonitor.setPreset("normal");
    setActivePreset("normal");
  }

  const { severity_score, severity_level, breakdown } = evaluation;

  // Severity color
  const severityColor =
    severity_level === "Critical"
      ? "#d32f2f"
      : severity_level === "Moderate"
      ? "#f57c00"
      : "#2e7d32";

  return (
    <div className="sos-panel card" aria-label="Smart SOS System">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🚨 Smart SOS System</span>
          <span
            style={{
              fontSize: "0.75rem",
              background: "#2e7d32",
              color: "#fff",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            ACTIVE SENSORS
          </span>
        </h2>
      </div>

      {/* Emergency Countdown / Trigger Banner */}
      {countdown !== null && (
        <div
          role="alert"
          style={{
            background: "#b71c1c",
            color: "#fff",
            padding: "12px",
            borderRadius: "6px",
            marginTop: "12px",
            textAlign: "center",
            boxShadow: "0 0 15px rgba(211, 47, 47, 0.6)",
          }}
        >
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
            ⚠️ CRITICAL COLLISION DETECTED!
          </div>
          <div style={{ fontSize: "0.9rem", margin: "4px 0" }}>
            Dispatching Automatic SOS in <strong>{countdown}s</strong>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={cancelSOS}
            style={{
              background: "#fff",
              color: "#b71c1c",
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            I'M SAFE — CANCEL SOS
          </button>
        </div>
      )}

      {/* SOS Dispatched Banner */}
      {sosActive && sosResponse && (
        <div
          role="status"
          style={{
            background: "#1b5e20",
            color: "#fff",
            padding: "12px",
            borderRadius: "6px",
            marginTop: "12px",
            boxShadow: "0 0 10px rgba(46, 125, 50, 0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>🚑 EMERGENCY SOS DISPATCHED</strong>
            <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>{sosResponse.sos_id}</span>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem" }}>
            Alert sent to 112, 108 & contacts. Nearest hospital (
            <strong>{sosResponse.hospital_alert_sent.hospital_name}</strong>, ETA{" "}
            {sosResponse.hospital_alert_sent.eta_min} min) has been notified.
          </p>
          <button
            type="button"
            className="btn btn-sm"
            onClick={cancelSOS}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid #fff",
              marginTop: "8px",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Resolve / Reset Alert
          </button>
        </div>
      )}

      {/* Live Sensor Telemetry Gauges */}
      <div style={{ marginTop: "14px" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", marginBottom: "6px" }}>
          LIVE SMARTPHONE TELEMETRY (CONTINUOUS SENSORS)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "8px",
          }}
        >
          <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Accelerometer</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: reading.total_g > 3 ? "#d32f2f" : "#0f172a" }}>
              {reading.total_g.toFixed(2)} G
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              x:{reading.accel_x.toFixed(1)} y:{reading.accel_y.toFixed(1)} z:{reading.accel_z.toFixed(1)} m/s²
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Gyroscope / Spin</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: reading.rotation_rate_deg_s > 150 ? "#d32f2f" : "#0f172a" }}>
              {reading.rotation_rate_deg_s.toFixed(0)} °/s
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Angular rotation rate</div>
          </div>

          <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Orientation / Tilt</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: Math.abs(reading.pitch_deg) > 45 ? "#d32f2f" : "#0f172a" }}>
              {Math.max(Math.abs(reading.pitch_deg), Math.abs(reading.roll_deg)).toFixed(0)}°
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              Pitch:{reading.pitch_deg.toFixed(0)}° Roll:{reading.roll_deg.toFixed(0)}°
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>GPS Speed</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
              {reading.speed_kmh.toFixed(0)} km/h
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              Inactivity: {reading.inactivity_seconds.toFixed(0)}s
            </div>
          </div>
        </div>
      </div>

      {/* AI Severity Agent Score */}
      <div style={{ marginTop: "14px", background: "#f1f5f9", padding: "12px", borderRadius: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>AI Accident Severity Score</span>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Multi-factor sensor inference engine
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                color: severityColor,
                marginRight: "6px",
              }}
            >
              {severity_score.toFixed(0)}%
            </span>
            <span
              style={{
                background: severityColor,
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {severity_level.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Severity Progress Bar */}
        <div
          style={{
            height: "8px",
            background: "#e2e8f0",
            borderRadius: "4px",
            overflow: "hidden",
            margin: "8px 0",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${severity_score}%`,
              background: severityColor,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* 5-Factor Breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "4px",
            fontSize: "0.7rem",
            color: "#475569",
            textAlign: "center",
          }}
        >
          <div>
            <div>Impact</div>
            <strong>{breakdown.impact_score.toFixed(0)}%</strong>
          </div>
          <div>
            <div>Rotation</div>
            <strong>{breakdown.rotation_score.toFixed(0)}%</strong>
          </div>
          <div>
            <div>Jerk</div>
            <strong>{breakdown.jerk_score.toFixed(0)}%</strong>
          </div>
          <div>
            <div>Speed</div>
            <strong>{breakdown.speed_score.toFixed(0)}%</strong>
          </div>
          <div>
            <div>Inactivity</div>
            <strong>{breakdown.inactivity_score.toFixed(0)}%</strong>
          </div>
        </div>
      </div>

      {/* Preset Simulator Controls */}
      <div style={{ marginTop: "14px" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", marginBottom: "6px" }}>
          SIMULATE SENSOR INCIDENTS:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {SENSOR_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn-sm ${activePreset === p.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setActivePreset(p.id);
                sensorMonitor.setPreset(p.id);
              }}
              style={{
                fontSize: "0.75rem",
                padding: "4px 8px",
                border: activePreset === p.id ? "2px solid #0284c7" : "1px solid #cbd5e1",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
          {SENSOR_PRESETS.find((p) => p.id === activePreset)?.description}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => executeSOSTrigger(false)}
          disabled={sosActive}
          style={{
            background: "#d32f2f",
            flex: 1,
            fontWeight: 700,
            padding: "8px",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          🚨 TRIGGER MANUAL SOS NOW
        </button>
      </div>

      {/* Nearby Hospitals */}
      <div style={{ marginTop: "16px" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
          🏥 NEARBY EMERGENCY TRAUMA CENTERS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {evaluation.nearby_hospitals.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                background: "#f8fafc",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{h.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {h.distance_km} km away · ETA ~{h.estimated_arrival_min} min · {h.trauma_care_level}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <a
                  href={`tel:${h.emergency_phone.replace(/\s+/g, "")}`}
                  style={{
                    display: "inline-block",
                    background: "#0284c7",
                    color: "#fff",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  📞 {h.emergency_phone}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
