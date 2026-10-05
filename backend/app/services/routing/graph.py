"""Graph representation of the road network for pathfinding."""
from __future__ import annotations

import networkx as nx

from .cost import get_speed_kmh, travel_time_seconds
from .snap import haversine_m


class RouteGraph:
    def __init__(self, segments: list[dict]):
        self.segments = segments
        self.by_id: dict[str, dict] = {f["properties"]["segment_id"]: f for f in segments}
        self.G = nx.MultiDiGraph()
        self.nodes: dict[str, tuple[float, float]] = {}  # node_id -> (lat, lon)
        self._build_graph()

    def _build_graph(self) -> None:
        for f in self.segments:
            p = f["properties"]
            sid = p["segment_id"]
            coords = f["geometry"]["coordinates"]
            u = str(p["from_node"])
            v = str(p["to_node"])

            # Endpoints: first coord is u (from_node), last coord is v (to_node)
            u_lon, u_lat = coords[0]
            v_lon, v_lat = coords[-1]

            if u not in self.nodes:
                self.nodes[u] = (u_lat, u_lon)
                self.G.add_node(u, lat=u_lat, lon=u_lon)
            if v not in self.nodes:
                self.nodes[v] = (v_lat, v_lon)
                self.G.add_node(v, lat=v_lat, lon=v_lon)

            length_m = float(p.get("length_m", 0))
            if length_m <= 0:
                length_m = haversine_m(u_lat, u_lon, v_lat, v_lon)

            speed_kmh = get_speed_kmh(p.get("highway", "residential"), p.get("kind", "residential"))
            travel_time_s = travel_time_seconds(length_m, speed_kmh)

            edge_attrs_forward = {
                "segment_id": sid,
                "length_m": length_m,
                "travel_time_s": travel_time_s,
                "speed_kmh": speed_kmh,
                "coords": coords,
                "forward": True,
            }
            # Add u -> v
            self.G.add_edge(u, v, key=sid, **edge_attrs_forward)

            # Unless oneway, add v -> u
            is_oneway = bool(p.get("oneway", False))
            if not is_oneway:
                edge_attrs_backward = {
                    "segment_id": sid,
                    "length_m": length_m,
                    "travel_time_s": travel_time_s,
                    "speed_kmh": speed_kmh,
                    "coords": list(reversed(coords)),
                    "forward": False,
                }
                self.G.add_edge(v, u, key=sid, **edge_attrs_backward)

    def snap(self, lat: float, lon: float) -> tuple[str, float, float, float]:
        """Find the nearest graph node by haversine distance.

        Returns (node_id, snapped_lat, snapped_lon, distance_m).
        """
        best_node = None
        best_dist = float("inf")
        best_coords = (lat, lon)

        for nid, (n_lat, n_lon) in self.nodes.items():
            d = haversine_m(lat, lon, n_lat, n_lon)
            if d < best_dist:
                best_dist = d
                best_node = nid
                best_coords = (n_lat, n_lon)

        if best_node is None:
            raise RuntimeError("Graph has no nodes to snap to")

        return best_node, best_coords[0], best_coords[1], round(best_dist, 1)
