/**
 * RouteLayer – draws fastest (orange) and safest (green) route polylines on the Leaflet map.
 * Uses react-leaflet Polyline components inside named Panes for correct z-order.
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
      {/* Fastest – orange */}
      <Polyline
        positions={fastCoords}
        pathOptions={{ color: "#e65100", weight: 5, opacity: 0.85, dashArray: "8 4" }}
      />
      {/* Safest – green (only when it differs from fastest) */}
      {safeCoords && (
        <Polyline
          positions={safeCoords}
          pathOptions={{ color: "#1b5e20", weight: 5, opacity: 0.85 }}
        />
      )}
    </Pane>
  );
}
