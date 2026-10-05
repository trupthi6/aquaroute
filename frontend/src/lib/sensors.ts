/**
 * Sensor Monitoring Service – Module 4
 * Continuously reads:
 * 1. Accelerometer (m/s^2, total G-force)
 * 2. Gyroscope (angular velocity deg/s)
 * 3. Rotation vector / Orientation (pitch, roll, yaw)
 * 4. GPS Speed (km/h)
 *
 * Provides real DeviceMotionEvent/Orientation support + rich synthetic simulator
 * for rapid browser/desktop testing & demonstration.
 */
import type { SensorReading } from "../api/types";

export type SensorPreset =
  | "normal"
  | "minor_bump"
  | "moderate_impact"
  | "critical_crash"
  | "water_stall";

export interface SensorPresetInfo {
  id: SensorPreset;
  label: string;
  description: string;
  expectedSeverity: string;
  reading: Partial<SensorReading>;
}

export const SENSOR_PRESETS: SensorPresetInfo[] = [
  {
    id: "normal",
    label: "Normal Driving",
    description: "Smooth transit through HSR Sector 2 at 42 km/h. Normal 1.0g gravity, no tilt.",
    expectedSeverity: "0-15% (Minor)",
    reading: {
      total_g: 1.02,
      accel_x: 0.1,
      accel_y: 0.2,
      accel_z: 9.8,
      rotation_rate_deg_s: 12.0,
      pitch_deg: 2.0,
      roll_deg: 1.0,
      speed_kmh: 42.0,
      inactivity_seconds: 0.0,
    },
  },
  {
    id: "minor_bump",
    label: "Minor Pothole / Sudden Stop",
    description: "Sudden brake and bump near flooded curb. Impact 2.4g, moderate decel.",
    expectedSeverity: "20-30% (Minor)",
    reading: {
      total_g: 2.4,
      accel_x: 0.8,
      accel_y: 2.2,
      accel_z: 10.4,
      rotation_rate_deg_s: 45.0,
      pitch_deg: 8.0,
      roll_deg: 4.0,
      speed_kmh: 28.0,
      inactivity_seconds: 0.0,
    },
  },
  {
    id: "moderate_impact",
    label: "Side Impact Collision",
    description: "4.8g T-bone or glancing collision at 45 km/h. Noticeable device spin, 25° vehicle tilt.",
    expectedSeverity: "45-65% (Moderate)",
    reading: {
      total_g: 4.8,
      accel_x: 4.1,
      accel_y: 2.5,
      accel_z: 11.2,
      rotation_rate_deg_s: 160.0,
      pitch_deg: 24.0,
      roll_deg: 18.0,
      speed_kmh: 48.0,
      inactivity_seconds: 3.5,
    },
  },
  {
    id: "critical_crash",
    label: "High-Speed Rollover Crash",
    description: "Severe 8.9g collision at 72 km/h with 75° rollover inversion and 12s post-impact driver immobility.",
    expectedSeverity: "75-95% (Critical)",
    reading: {
      total_g: 8.9,
      accel_x: 7.2,
      accel_y: 5.4,
      accel_z: 3.1,
      rotation_rate_deg_s: 390.0,
      pitch_deg: 78.0,
      roll_deg: 65.0,
      speed_kmh: 72.0,
      inactivity_seconds: 12.0,
    },
  },
  {
    id: "water_stall",
    label: "Flooded Underpass Stalled",
    description: "Vehicle entered deep water in Agara Underpass. Speed drops to 0 km/h, 15° forward nose dip.",
    expectedSeverity: "35-50% (Moderate)",
    reading: {
      total_g: 1.8,
      accel_x: 0.3,
      accel_y: 1.6,
      accel_z: 9.9,
      rotation_rate_deg_s: 18.0,
      pitch_deg: 16.0,
      roll_deg: 5.0,
      speed_kmh: 0.0,
      inactivity_seconds: 18.0,
    },
  },
];

export class SensorMonitorService {
  private listeners = new Set<(reading: SensorReading) => void>();
  private activePreset: SensorPreset = "normal";
  private currentReading: SensorReading;
  private intervalId: any = null;
  private isLiveHardwareActive = false;

  constructor() {
    this.currentReading = this.buildInitialReading(SENSOR_PRESETS[0].reading);
  }

  private buildInitialReading(seed: Partial<SensorReading>): SensorReading {
    return {
      timestamp_ms: Date.now(),
      accel_x: seed.accel_x ?? 0.0,
      accel_y: seed.accel_y ?? 0.0,
      accel_z: seed.accel_z ?? 9.8,
      total_g: seed.total_g ?? 1.0,
      gyro_alpha: 0.0,
      gyro_beta: 0.0,
      gyro_gamma: 0.0,
      rotation_rate_deg_s: seed.rotation_rate_deg_s ?? 0.0,
      pitch_deg: seed.pitch_deg ?? 0.0,
      roll_deg: seed.roll_deg ?? 0.0,
      speed_kmh: seed.speed_kmh ?? 0.0,
      inactivity_seconds: seed.inactivity_seconds ?? 0.0,
    };
  }

  public start(frequencyMs = 250) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), frequencyMs);
    this.attachHardwareListeners();
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public subscribe(fn: (reading: SensorReading) => void): () => void {
    this.listeners.add(fn);
    fn(this.currentReading);
    return () => this.listeners.delete(fn);
  }

  public setPreset(preset: SensorPreset) {
    this.activePreset = preset;
    const target = SENSOR_PRESETS.find((p) => p.id === preset) ?? SENSOR_PRESETS[0];
    this.currentReading = {
      ...this.currentReading,
      ...target.reading,
      timestamp_ms: Date.now(),
    };
    this.broadcast();
  }

  public getReading(): SensorReading {
    return this.currentReading;
  }

  public getPreset(): SensorPreset {
    return this.activePreset;
  }

  private tick() {
    // Add micro jitter to make telemetry feel organic and live
    const jitter = (range: number) => (Math.random() - 0.5) * range;
    const base = SENSOR_PRESETS.find((p) => p.id === this.activePreset)?.reading ?? {};

    const total_g = Math.max(0.8, Number(((base.total_g ?? 1.0) + jitter(0.06)).toFixed(2)));
    const rotation = Math.max(0.0, Number(((base.rotation_rate_deg_s ?? 5.0) + jitter(4.0)).toFixed(1)));
    const pitch = Number(((base.pitch_deg ?? 0.0) + jitter(0.8)).toFixed(1));
    const roll = Number(((base.roll_deg ?? 0.0) + jitter(0.8)).toFixed(1));
    const speed = Math.max(0.0, Number(((base.speed_kmh ?? 0.0) + jitter(1.5)).toFixed(1)));

    this.currentReading = {
      ...this.currentReading,
      timestamp_ms: Date.now(),
      total_g,
      accel_x: Number(((base.accel_x ?? 0.0) + jitter(0.1)).toFixed(2)),
      accel_y: Number(((base.accel_y ?? 0.0) + jitter(0.1)).toFixed(2)),
      accel_z: Number(((base.accel_z ?? 9.8) + jitter(0.15)).toFixed(2)),
      rotation_rate_deg_s: rotation,
      pitch_deg: pitch,
      roll_deg: roll,
      speed_kmh: speed,
      inactivity_seconds: base.inactivity_seconds ?? 0.0,
    };

    this.broadcast();
  }

  private broadcast() {
    for (const fn of this.listeners) {
      fn(this.currentReading);
    }
  }

  private attachHardwareListeners() {
    if (typeof window === "undefined") return;

    if ("DeviceMotionEvent" in window && !this.isLiveHardwareActive) {
      try {
        window.addEventListener("devicemotion", (e) => {
          if (!e.accelerationIncludingGravity) return;
          const ax = e.accelerationIncludingGravity.x ?? 0;
          const ay = e.accelerationIncludingGravity.y ?? 0;
          const az = e.accelerationIncludingGravity.z ?? 9.8;
          const totalG = Math.sqrt(ax * ax + ay * ay + az * az) / 9.80665;
          const rot = e.rotationRate
            ? Math.sqrt(
                (e.rotationRate.alpha ?? 0) ** 2 +
                (e.rotationRate.beta ?? 0) ** 2 +
                (e.rotationRate.gamma ?? 0) ** 2
              )
            : 0;

          this.currentReading = {
            ...this.currentReading,
            accel_x: Number(ax.toFixed(2)),
            accel_y: Number(ay.toFixed(2)),
            accel_z: Number(az.toFixed(2)),
            total_g: Number(totalG.toFixed(2)),
            rotation_rate_deg_s: Number(rot.toFixed(1)),
          };
          this.broadcast();
        });
        this.isLiveHardwareActive = true;
      } catch {
        /* device motion not granted/available */
      }
    }
  }
}

// Global singleton instance for app-wide telemetry
export const sensorMonitor = new SensorMonitorService();
