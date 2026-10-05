import { describe, expect, it } from "vitest";
import { computeOfflineRoute } from "./offlineRouting";

describe("Client-Side Offline Routing Engine (Module 5)", () => {
  it("computes safe offline route when network is unavailable", () => {
    const res = computeOfflineRoute({
      origin: { lat: 12.915, lon: 77.6725 },
      destination: { lat: 12.9215, lon: 77.6465 },
      view: "peak",
    });

    expect(res.status).toBe("OK");
    expect(res.recommendation).toBe("SAFER_ROUTE");
    expect(res.fastest).toBeDefined();
    expect(res.safest).toBeDefined();
    expect(res.safest!.mean_risk).toBeLessThan(res.fastest.mean_risk);
    expect(res.comparison).toBeDefined();
    expect(res.comparison!.mean_risk_reduction).toBeGreaterThan(0);
    expect(res.metadata.engine).toContain("AquaRoute");
  });
});
