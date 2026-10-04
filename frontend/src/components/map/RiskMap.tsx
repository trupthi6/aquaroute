import type { Feature } from "geojson";
import type { Layer } from "leaflet";
import { useMemo } from "react";
import { GeoJSON, MapContainer, Pane, Polyline, TileLayer } from "react-leaflet";
import type { RiskCollection, RiskProperties, RouteResponse, ViewMode } from "../../api/types";
import { computeBounds, toLatLng } from "../../lib/geo";
import { CLASS_STYLE, classFor, probabilityFor, segmentStyle } from "../../lib/risk";
import RouteLayer from "./RouteLayer";

interface Props {
  data: RiskCollection;
  view: ViewMode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  routeResult?: RouteResponse | null;
}

export default function RiskMap({ data, view, selectedId, onSelect, routeResult = null }: Props) {
  // Bounds are only used for the initial view (MapContainer props are fixed after mount).
  const bounds = useMemo(() => computeBounds(data.features), [data.features.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = data.features.find((f) => f.id === selectedId);

  const onEachFeature = (f: Feature, layer: Layer) => {
    const p = f.properties as RiskProperties;
    const cls = classFor(p, view);
    layer.bindTooltip(`${p.name}: ${CLASS_STYLE[cls].label} (${Math.round(probabilityFor(p, view) * 100)}%)`, { sticky: true });
    layer.on("click", () => onSelect(p.segment_id));
  };

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [30, 30] }} className="map" scrollWheelZoom>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <Pane name="halo" style={{ zIndex: 410 }}>
        {selected && (
          <Polyline positions={toLatLng(selected.geometry.coordinates)} pathOptions={{ color: "#fff", weight: 16, opacity: 0.9 }} />
        )}
      </Pane>
      <Pane name="risk" style={{ zIndex: 420 }}>
        <GeoJSON
          key={`${data.metadata.generated_at}|${view}`}
          data={data as unknown as GeoJSON.FeatureCollection}
          style={(f) => segmentStyle(f?.properties as RiskProperties, view)}
          onEachFeature={onEachFeature}
        />
      </Pane>
      <RouteLayer routeResult={routeResult} />
    </MapContainer>
  );
}
