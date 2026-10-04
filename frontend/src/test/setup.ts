import "@testing-library/jest-dom/vitest";

// jsdom has no SVG geometry API. Leaflet checks for createSVGRect at import time to decide whether it can
// draw vector layers, so declare support here (setup files run before test files import Leaflet).
if (typeof SVGElement !== "undefined" && !("createSVGRect" in SVGElement.prototype)) {
  (SVGElement.prototype as unknown as Record<string, unknown>).createSVGRect = () => ({});
}
