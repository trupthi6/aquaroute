import type { RiskFeature } from "../api/types";

export type Bounds = [[number, number], [number, number]]; // [[south, west], [north, east]]

export function computeBounds(features: RiskFeature[]): Bounds {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const f of features) {
    for (const [lon, lat] of f.geometry.coordinates) {
      s = Math.min(s, lat); n = Math.max(n, lat);
      w = Math.min(w, lon); e = Math.max(e, lon);
    }
  }
  if (!isFinite(s)) return [[12.9, 77.6], [12.95, 77.7]]; // fallback: Bengaluru
  return [[s, w], [n, e]];
}

/** GeoJSON is [lon, lat]; Leaflet polylines want [lat, lon]. */
export const toLatLng = (coords: [number, number][]): [number, number][] => coords.map(([lon, lat]) => [lat, lon]);
