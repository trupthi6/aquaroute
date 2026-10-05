/**
 * RouteLayer.test.tsx – Real Leaflet render test for Module 3 route polylines.
 *
 * Spec (docs/routing.md):
 *   Fastest route  = dark grey (#424242), dashed "6 6", weight 5
 *   Safest route   = solid blue (#1565c0), weight 5, white casing (#ffffff, weight 9)
 *   A marker (origin) and B marker (destination) must be present
 *
 * Covers:
 *   1. No polylines rendered when routeResult is null.
 *   2. One fastest polyline (dark grey dashed) when recommendation is FASTEST_IS_SAFE.
 *   3. Three polylines (fastest + casing + safest) when recommendation is SAFER_ROUTE.
 *   4. Fastest polyline has dark grey colour and dash pattern.
 *   5. Safest polyline has blue colour and no dash.
 *   6. White casing polyline is present behind the safest line.
 */
import { render } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import RouteLayer from "./RouteLayer";
import type { RouteResponse } from "../../api/types";
import { routeFixture } from "../../test/fixtures";

// Leaflet renders SVG <path> elements for each Polyline.
const paths = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("path.leaflet-interactive"));

// Helper to render with MapContainer context
const renderWithMap = (ui: React.ReactElement) =>
  render(<MapContainer center={[0, 0]} zoom={13}>{ui}</MapContainer>);

// A FASTEST_IS_SAFE response: safest == fastest, recommendation is not SAFER_ROUTE.
const fastestOnlyFixture: RouteResponse = {
  ...routeFixture,
  recommendation: "FASTEST_IS_SAFE",
  safest: null,
  comparison: null,
};

describe("RouteLayer (real Leaflet)", () => {
  it("renders nothing when routeResult is null", () => {
    const { container } = renderWithMap(<RouteLayer routeResult={null} />);
    expect(paths(container)).toHaveLength(0);
  });

  it("draws only the fastest polyline when recommendation is FASTEST_IS_SAFE", () => {
    const { container } = renderWithMap(<RouteLayer routeResult={fastestOnlyFixture} />);
    // Only one interactive path = the fastest route
    expect(paths(container)).toHaveLength(1);
  });

  it("draws three polylines (fastest + white casing + safest blue) when SAFER_ROUTE", () => {
    const { container } = renderWithMap(<RouteLayer routeResult={routeFixture} />);
    // 3 = 1 fastest (grey) + 1 white casing + 1 safest (blue)
    expect(paths(container)).toHaveLength(3);
  });

  it("fastest polyline is dark grey (#424242) and has a dash pattern", () => {
    const { container } = renderWithMap(<RouteLayer routeResult={routeFixture} />);
    const grey = paths(container).find(
      (p) => p.getAttribute("stroke") === "#424242"
    );
    expect(grey).toBeTruthy();
    expect(grey!.getAttribute("stroke-dasharray")).not.toBeNull();
  });

  it("safest polyline is solid blue (#1565c0) with no dash", () => {
    const { container } = renderWithMap(<RouteLayer routeResult={routeFixture} />);
    const blue = paths(container).find(
      (p) => p.getAttribute("stroke") === "#1565c0"
    );
    expect(blue).toBeTruthy();
    // Solid = no dasharray attribute, or empty string
    const da = blue!.getAttribute("stroke-dasharray");
    expect(!da || da === "none" || da === "").toBe(true);
  });

  it("white casing polyline is present underneath the safest route", () => {
    const { container } = renderWithMap(<RouteLayer routeResult={routeFixture} />);
    const white = paths(container).filter(
      (p) => p.getAttribute("stroke") === "#ffffff"
    );
    expect(white).toHaveLength(1);
  });
});
