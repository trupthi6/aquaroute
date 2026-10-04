import { CLASS_ORDER, CLASS_STYLE, classFor, segmentStyle, topRisks } from "./risk";
import { computeBounds, toLatLng } from "./geo";
import { confidencePct, formatAge, formatClock, freshnessMessage, mapFreshness, windowText } from "./freshness";
import { riskFixture } from "../test/fixtures";

const props = riskFixture.features.find((f) => f.id === "R-008")!.properties;

describe("risk styling", () => {
  it("never relies on colour alone: every class has a unique colour AND a unique line pattern", () => {
    const colors = new Set(CLASS_ORDER.map((c) => CLASS_STYLE[c].color));
    const patterns = new Set(CLASS_ORDER.map((c) => `${CLASS_STYLE[c].weight}|${CLASS_STYLE[c].dashArray ?? "solid"}`));
    expect(colors.size).toBe(4);
    expect(patterns.size).toBe(4);
    CLASS_ORDER.forEach((c) => expect(CLASS_STYLE[c].label).toBe(c));
  });
  it("heavier lines for higher classes", () => {
    const w = CLASS_ORDER.map((c) => CLASS_STYLE[c].weight);
    expect([...w].sort((a, b) => a - b)).toEqual(w);
  });
  it("classFor switches between now and peak", () => {
    const p = { ...props, risk_class: "LOW" as const, peak_risk_class: "HIGH" as const };
    expect(classFor(p, "now")).toBe("LOW");
    expect(classFor(p, "peak")).toBe("HIGH");
    expect(segmentStyle(p, "peak").color).toBe(CLASS_STYLE.HIGH.color);
    expect(segmentStyle(p, "now").color).toBe(CLASS_STYLE.LOW.color);
  });
  it("topRisks sorts by the chosen view and respects n", () => {
    const top = topRisks(riskFixture.features, "peak", 3);
    expect(top).toHaveLength(3);
    expect(top[0].peak_risk_probability).toBeGreaterThanOrEqual(top[2].peak_risk_probability);
    const all = riskFixture.features.map((f) => f.properties.peak_risk_probability);
    expect(top[0].peak_risk_probability).toBe(Math.max(...all));
  });
});

describe("freshness and wording", () => {
  it("formatAge", () => {
    expect(formatAge(20)).toBe("just now");
    expect(formatAge(60)).toBe("1 min ago");
    expect(formatAge(5400)).toBe("1 h 30 min ago");
    expect(formatAge(7200)).toBe("2 h ago");
  });
  it("formatClock ignores the viewer's timezone", () => {
    expect(formatClock("2026-10-03T17:30:00+05:30")).toBe("17:30");
  });
  it("windowText covers every case", () => {
    expect(windowText(null)).toMatch(/No HIGH risk/);
    expect(windowText({ start_min: 0, end_min: 180 })).toMatch(/now and for the next 3 h/);
    expect(windowText({ start_min: 0, end_min: 60 })).toMatch(/now, easing in ~60 min/);
    expect(windowText({ start_min: 45, end_min: 180 })).toMatch(/from ~45 min, lasting beyond/);
    expect(windowText({ start_min: 35, end_min: 50 })).toBe("HIGH risk expected in 35-50 min");
  });
  it("stale message warns the user", () => {
    const m = freshnessMessage({ as_of: "2026-10-03T16:00:00+05:30", age_seconds: 5400, state: "stale" });
    expect(m).toMatch(/out of date/);
    expect(m).toMatch(/1 h 30 min ago/);
  });
  it("confidencePct rounds", () => expect(confidencePct(0.815)).toBe(82));
  it("mapFreshness reads the first feature", () => {
    expect(mapFreshness(riskFixture)?.state).toBe("fresh");
    expect(mapFreshness({ ...riskFixture, features: [] })).toBeNull();
  });
});

describe("geo helpers", () => {
  it("computeBounds encloses every coordinate", () => {
    const [[s, w], [n, e]] = computeBounds(riskFixture.features);
    for (const f of riskFixture.features)
      for (const [lon, lat] of f.geometry.coordinates) {
        expect(lat).toBeGreaterThanOrEqual(s); expect(lat).toBeLessThanOrEqual(n);
        expect(lon).toBeGreaterThanOrEqual(w); expect(lon).toBeLessThanOrEqual(e);
      }
  });
  it("computeBounds falls back for empty input", () => expect(computeBounds([])[0][0]).toBeGreaterThan(0));
  it("toLatLng swaps lon/lat", () => expect(toLatLng([[77.6, 12.9]])).toEqual([[12.9, 77.6]]));
});
