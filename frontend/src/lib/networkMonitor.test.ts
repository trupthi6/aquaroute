import { describe, expect, it } from "vitest";
import { networkMonitor } from "./networkMonitor";

describe("Network Monitoring Agent (Module 5)", () => {
  it("initializes and reports network state", () => {
    const state = networkMonitor.getState();
    expect(state).toHaveProperty("online");
    expect(state).toHaveProperty("quality");
    expect(state).toHaveProperty("signalStrengthPercent");
  });

  it("simulates weak network and triggers weak connectivity prompt", () => {
    networkMonitor.simulateQuality("weak");
    const state = networkMonitor.getState();
    expect(state.quality).toBe("weak");
    expect(state.signalStrengthPercent).toBeLessThan(30);
    expect(state.promptWeakConnectivity).toBe(true);
  });

  it("simulates offline mode", () => {
    networkMonitor.simulateQuality("offline");
    const state = networkMonitor.getState();
    expect(state.quality).toBe("offline");
    expect(state.online).toBe(false);
    expect(state.signalStrengthPercent).toBe(0);
  });

  it("resets back to good network", () => {
    networkMonitor.simulateQuality("good");
    const state = networkMonitor.getState();
    expect(state.quality).toBe("good");
    expect(state.online).toBe(true);
    expect(state.signalStrengthPercent).toBeGreaterThan(80);
  });
});
