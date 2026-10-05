import { ApiError, fetchDetail, fetchDemoTrip, fetchRisk, fetchScenario, postRoute, postScenario } from "./client";
import { detailFixture, demoTripFixture, riskFixture, routeFixture, scenarioFixture } from "../test/fixtures";

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
afterEach(() => vi.unstubAllGlobals());

describe("API client", () => {
  it("fetchRisk calls /api/v1/risk", async () => {
    const f = vi.fn((_url: string, _init?: RequestInit) => ok(riskFixture));
    vi.stubGlobal("fetch", f);
    const r = await fetchRisk();
    expect(f).toHaveBeenCalledWith("/api/v1/risk", undefined);
    expect(r.features).toHaveLength(38);
  });
  it("fetchDetail encodes the id", async () => {
    const f = vi.fn((_url: string) => ok(detailFixture));
    vi.stubGlobal("fetch", f);
    await fetchDetail("R 008/x");
    expect(f.mock.calls[0][0]).toBe("/api/v1/risk/R%20008%2Fx");
  });
  it("postScenario sends JSON", async () => {
    const f = vi.fn((_url: string, _init?: RequestInit) => ok(scenarioFixture));
    vi.stubGlobal("fetch", f);
    await postScenario({ scenario: "heavy_rain", now_offset_min: 210 });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/v1/scenario");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ scenario: "heavy_rain", now_offset_min: 210 });
  });
  it("surfaces the backend's detail message on errors", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(JSON.stringify({ detail: "Unknown segment_id 'X'" }), { status: 404 })));
    await expect(fetchDetail("X")).rejects.toMatchObject({ status: 404, message: "Unknown segment_id 'X'" });
  });
  it("turns network failure into a friendly ApiError", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    const err = await fetchScenario().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/backend running/);
  });
});

describe("contract guard: fixtures from the Python backend match the TypeScript shapes", () => {
  const required = [
    "segment_id", "name", "kind", "risk_probability", "risk_class", "risk_level", "confidence",
    "peak_risk_probability", "peak_risk_class", "peak_risk_level", "peak_in_min", "expected_window",
    "top_factors", "verified_block", "data_freshness",
  ];
  it("every feature has every property the UI reads", () => {
    for (const f of riskFixture.features) for (const k of required) expect(f.properties).toHaveProperty(k);
  });
  it("metadata has the fields the UI reads", () => {
    for (const k of ["summary_now", "summary_peak", "segment_count", "generated_at", "simulated_now", "scenario", "disclaimer"])
      expect(riskFixture.metadata).toHaveProperty(k);
  });
  it("detail adds curve, factors and static features", () => {
    const p = detailFixture.properties;
    expect(p.forecast_curve).toHaveLength(13);
    expect(p.factor_contributions.length).toBeGreaterThan(0);
    expect(p.static_features).toHaveProperty("elevation_m");
  });
});

describe("routing API client – postRoute and fetchDemoTrip", () => {
  it("postRoute POSTs to /api/v1/route and returns a RouteResponse", async () => {
    const f = vi.fn((_url: string, _init?: RequestInit) => ok(routeFixture));
    vi.stubGlobal("fetch", f);
    const req = { origin: { lat: 12.915, lon: 77.6725 }, destination: { lat: 12.9215, lon: 77.6465 } };
    const result = await postRoute(req);
    expect(f).toHaveBeenCalledWith("/api/v1/route", expect.objectContaining({ method: "POST" }));
    expect(result.status).toBe("OK");
    expect(result.recommendation).toBe("SAFER_ROUTE");
  });

  it("fetchDemoTrip GETs /api/v1/route/demo-trip?view=peak by default", async () => {
    const f = vi.fn((_url: string) => ok(demoTripFixture));
    vi.stubGlobal("fetch", f);
    const result = await fetchDemoTrip();
    expect(f.mock.calls[0][0]).toBe("/api/v1/route/demo-trip?view=peak");
    expect(result).toHaveProperty("origin");
    expect(result).toHaveProperty("destination");
  });

  it("fetchDemoTrip forwards the view parameter", async () => {
    const f = vi.fn((_url: string) => ok(demoTripFixture));
    vi.stubGlobal("fetch", f);
    await fetchDemoTrip("now");
    expect(f.mock.calls[0][0]).toBe("/api/v1/route/demo-trip?view=now");
  });
});

describe("contract guard: route_response.sample.json matches RouteResponse shape", () => {
  it("has all required top-level keys", () => {
    for (const k of ["status", "recommendation", "view", "origin", "destination", "fastest", "safest", "comparison", "reasons", "warnings", "metadata"])
      expect(routeFixture).toHaveProperty(k);
  });

  it("fastest route has required route keys", () => {
    for (const k of ["segment_ids", "geometry", "distance_m", "duration_s", "mean_risk", "max_risk_class", "segments_at_risk", "cost"])
      expect(routeFixture.fastest).toHaveProperty(k);
  });

  it("fastest geometry is a LineString with coordinates", () => {
    expect(routeFixture.fastest.geometry.type).toBe("LineString");
    expect(routeFixture.fastest.geometry.coordinates.length).toBeGreaterThan(1);
  });

  it("safest route exists and mean_risk is lower than fastest", () => {
    expect(routeFixture.safest).not.toBeNull();
    expect(routeFixture.safest!.mean_risk).toBeLessThan(routeFixture.fastest.mean_risk);
  });

  it("recommendation is SAFER_ROUTE in the fixture", () => {
    expect(routeFixture.recommendation).toBe("SAFER_ROUTE");
  });

  it("fastest route contains R-008 (the sample underpass)", () => {
    expect(routeFixture.fastest.segment_ids).toContain("R-008");
  });

  it("safest route does not contain R-008", () => {
    expect(routeFixture.safest!.segment_ids).not.toContain("R-008");
  });
});
