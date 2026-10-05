import { describe, expect, it } from "vitest";
import { SENSOR_PRESETS, SensorMonitorService } from "./sensors";

describe("SensorMonitorService (Module 4)", () => {
  it("initializes with normal driving telemetry", () => {
    const service = new SensorMonitorService();
    const reading = service.getReading();
    expect(reading.total_g).toBeCloseTo(1.0, 1);
    expect(reading.speed_kmh).toBeGreaterThan(0);
    expect(reading.inactivity_seconds).toBe(0);
  });

  it("switches presets and updates telemetry", () => {
    const service = new SensorMonitorService();
    service.setPreset("critical_crash");
    const reading = service.getReading();
    expect(reading.total_g).toBeGreaterThan(7.0);
    expect(reading.rotation_rate_deg_s).toBeGreaterThan(200);
    expect(reading.pitch_deg).toBeGreaterThan(45);
    expect(reading.inactivity_seconds).toBeGreaterThan(5);
  });

  it("subscribes and receives updates", () => {
    const service = new SensorMonitorService();
    let received = 0;
    const unsub = service.subscribe(() => {
      received++;
    });
    service.setPreset("minor_bump");
    expect(received).toBeGreaterThanOrEqual(1);
    unsub();
  });

  it("contains all 5 required presets", () => {
    expect(SENSOR_PRESETS).toHaveLength(5);
    const ids = SENSOR_PRESETS.map((p) => p.id);
    expect(ids).toContain("normal");
    expect(ids).toContain("minor_bump");
    expect(ids).toContain("moderate_impact");
    expect(ids).toContain("critical_crash");
    expect(ids).toContain("water_stall");
  });
});
