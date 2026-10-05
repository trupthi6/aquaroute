/**
 * RouteLayer – draws fastest and safest route polylines on the Leaflet map.
 * Spec colours:
 *   Fastest  = dark grey (#424242), dashed "6 6", weight 5
 *   Safest   = solid blue (#1565c0), weight 5, with a white casing (weight 9) underneath
 * Uses react-leaflet Polyline components inside a named Pane for correct z-order.
 */
import { Pane, Polyline } from "react-leaflet";
import type { RouteResponse } from "../../api/types";
import { toLatLng } from "../../lib/geo";

interface Props {
  routeResult: RouteResponse | null;
}

export default function RouteLayer({ routeResult }: Props) {
  if (!routeResult) return null;

  const fastCoords = toLatLng(routeResult.fastest.geometry.coordinates);
  const safeCoords =
    routeResult.safest && routeResult.recommendation === "SAFER_ROUTE"
      ? toLatLng(routeResult.safest.geometry.coordinates)
      : null;

  return (
    <Pane name="route" style={{ zIndex: 430 }}>
      {/* Fastest – dark grey dotted (spec: dark grey dotted line) */}
      <Polyline
        positions={fastCoords}
        pathOptions={{ color: "#424242", weight: 5, opacity: 0.9, dashArray: "6 6" }}
      />
      {/* Safest – white casing first, solid blue on top (spec: solid blue with white casing) */}
      {safeCoords && (
        <>
          <Polyline
            positions={safeCoords}
            pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.85 }}
          />
          <Polyline
            positions={safeCoords}
            pathOptions={{ color: "#1565c0", weight: 5, opacity: 0.95 }}
          />
        </>
      )}
    </Pane>
  );
}
