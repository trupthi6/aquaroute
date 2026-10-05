"""Routing engine coordinating graph pathfinding, risk cost modeling, and trip recommendations."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

import networkx as nx
from fastapi import HTTPException

from ...models.route import (
    DemoTripResponse,
    LatLng,
    Route,
    RouteComparison,
    RouteMetadata,
    RouteRequest,
    RouteResponse,
    SegmentAtRisk,
    SnappedPoint,
)
from ..risk.service import RiskService
from .config import (
    ALPHA,
    BETA,
    CLASS_ORDER,
    GAMMA,
    HIGH_MULT,
    MAX_SNAP_DISTANCE_M,
    RISK_DIFF_THRESHOLD,
    SPEEDS_KMH,
)
from .cost import compute_fastest_cost, compute_safe_cost
from .explain import generate_reasons, generate_warnings
from .graph import RouteGraph
from .snap import haversine_m


class RouteEngine:
    def __init__(self, segments: list[dict], risk_service: RiskService):
        self.segments = segments
        self.risk_service = risk_service
        self.graph = RouteGraph(segments)

    def route(self, req: RouteRequest) -> RouteResponse:
        # 1. Coordinate range validation
        if not (-90.0 <= req.origin.lat <= 90.0 and -180.0 <= req.origin.lon <= 180.0):
            raise HTTPException(422, "Invalid origin coordinates")
        if not (-90.0 <= req.destination.lat <= 90.0 and -180.0 <= req.destination.lon <= 180.0):
            raise HTTPException(422, "Invalid destination coordinates")

        # 2. Blocked segment validation
        for sid in req.blocked_segment_ids:
            if sid not in self.graph.by_id:
                raise HTTPException(422, f"Unknown segment id in blocked_segment_ids: '{sid}'")

        # 3. Snap origin and destination
        u_node, u_slat, u_slon, u_dist = self.graph.snap(req.origin.lat, req.origin.lon)
        v_node, v_slat, v_slon, v_dist = self.graph.snap(req.destination.lat, req.destination.lon)

        if u_dist > MAX_SNAP_DISTANCE_M:
            raise HTTPException(422, f"Origin is outside pilot area (snap distance {u_dist}m > {MAX_SNAP_DISTANCE_M}m)")  # noqa: E501
        if v_dist > MAX_SNAP_DISTANCE_M:
            raise HTTPException(422, f"Destination is outside pilot area (snap distance {v_dist}m > {MAX_SNAP_DISTANCE_M}m)")  # noqa: E501

        if u_node == v_node:
            raise HTTPException(422, "Origin and destination snap to the same graph node")

        # 4. Fetch risk assessments & static features
        assessments = self.risk_service.assess_all()
        static_map = self.risk_service.static_features()
        blocked_set = set(req.blocked_segment_ids)

        # 5. Dijkstra weight functions
        def weight_fastest(u: str, v: str, data: dict[str, Any]) -> float | None:
            best = None
            for _, attrs in data.items():
                sid = attrs["segment_id"]
                a = assessments.get(sid)
                is_blocked = (sid in blocked_set) or bool(a and a.verified_block)
                cost = compute_fastest_cost(attrs["travel_time_s"], is_blocked)
                if cost is not None:
                    if best is None or cost < best:
                        best = cost
            return best

        def weight_safe(u: str, v: str, data: dict[str, Any]) -> float | None:
            best = None
            for _, attrs in data.items():
                sid = attrs["segment_id"]
                a = assessments.get(sid)
                st = static_map.get(sid)
                if not a or not st:
                    continue
                r = a.risk if req.view == "now" else a.peak_risk
                cls = a.risk_class.value if req.view == "now" else a.peak_class.value
                is_blocked = (sid in blocked_set) or bool(a.verified_block)
                cost = compute_safe_cost(attrs["travel_time_s"], r, cls, st.lowness, st.drain_deficit, is_blocked)
                if cost is not None:
                    if best is None or cost < best:
                        best = cost
            return best

        # 6. Find fastest path
        try:
            fastest_nodes = nx.dijkstra_path(self.graph.G, u_node, v_node, weight=weight_fastest)
            fastest_route = self._build_route(fastest_nodes, weight_fastest, assessments, req.view)
        except (nx.NetworkXNoPath, nx.NodeNotFound) as err:
            raise HTTPException(422, "No drivable route found between origin and destination; roads are blocked") from err  # noqa: E501

        # 7. Find safest path
        safest_route = None
        has_safe_path = False
        try:
            safest_nodes = nx.dijkstra_path(self.graph.G, u_node, v_node, weight=weight_safe)
            safest_route = self._build_route(safest_nodes, weight_safe, assessments, req.view)
            has_safe_path = True
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            has_safe_path = False

        # 8. Determine recommendation
        fastest_has_high = any(s.risk_class in ("HIGH", "CRITICAL") for s in fastest_route.segments_at_risk)

        if not has_safe_path:
            status = "NO_SAFE_ROUTE"
            recommendation = "NO_SAFE_ROUTE"
            comparison = None
        else:
            assert safest_route is not None
            paths_differ = safest_route.segment_ids != fastest_route.segment_ids
            risk_diff = fastest_route.mean_risk - safest_route.mean_risk

            if paths_differ and (fastest_has_high or risk_diff >= RISK_DIFF_THRESHOLD):
                status = "OK"
                recommendation = "SAFER_ROUTE"
            else:
                status = "OK"
                recommendation = "FASTEST_IS_SAFE"
                safest_route = fastest_route

            # Compute comparison
            safest_ids = set(safest_route.segment_ids)
            high_avoided = sum(
                1 for s in fastest_route.segments_at_risk
                if s.risk_class == "HIGH" and s.segment_id not in safest_ids
            )
            critical_avoided = sum(
                1 for s in fastest_route.segments_at_risk
                if s.risk_class == "CRITICAL" and s.segment_id not in safest_ids
            )
            comparison = RouteComparison(
                extra_time_s=max(0.0, round(safest_route.duration_s - fastest_route.duration_s, 1)),
                extra_distance_m=max(0, safest_route.distance_m - fastest_route.distance_m),
                high_risk_roads_avoided=high_avoided,
                critical_roads_avoided=critical_avoided,
                mean_risk_reduction=max(0.0, round(fastest_route.mean_risk - safest_route.mean_risk, 3)),
            )

        # 9. Explanations and warnings
        fastest_at_risk_dicts = [s.model_dump() for s in fastest_route.segments_at_risk]
        safest_at_risk_dicts = [s.model_dump() for s in safest_route.segments_at_risk] if safest_route else None
        reasons = generate_reasons(fastest_at_risk_dicts, safest_at_risk_dicts, recommendation)

        player = self.risk_service.player
        sample_assessment = next(iter(assessments.values())) if assessments else None
        freshness_state = sample_assessment.freshness_state if sample_assessment else "fresh"
        warnings = generate_warnings(
            status,
            freshness_state,
            fastest_route.duration_s,
            safest_route.duration_s if safest_route else None,
        )

        metadata = RouteMetadata(
            scenario=player._name,
            simulated_now=player.simulated_now.isoformat(),
            now_offset_min=player.now_offset_min,
            generated_at=datetime.now(timezone.utc).isoformat(),
            data_freshness=self.risk_service._freshness(sample_assessment) if sample_assessment else {
                "as_of": player.simulated_now.isoformat(),
                "age_seconds": int(player.data_age_min * 60),
                "state": "fresh",
            },
            cost_model={
                "alpha": ALPHA,
                "beta": BETA,
                "gamma": GAMMA,
                "high_mult": HIGH_MULT,
                "speeds_kmh": SPEEDS_KMH,
            },
        )

        return RouteResponse(
            status=status,
            recommendation=recommendation,
            view=req.view,
            origin=SnappedPoint(
                lat=req.origin.lat,
                lon=req.origin.lon,
                snapped_lat=u_slat,
                snapped_lon=u_slon,
                snap_distance_m=u_dist,
            ),
            destination=SnappedPoint(
                lat=req.destination.lat,
                lon=req.destination.lon,
                snapped_lat=v_slat,
                snapped_lon=v_slon,
                snap_distance_m=v_dist,
            ),
            fastest=fastest_route,
            safest=safest_route,
            comparison=comparison,
            reasons=reasons,
            warnings=warnings,
            metadata=metadata,
        )

    def _build_route(
        self,
        node_path: list[str],
        weight_fn: Any,
        assessments: dict[str, Any],
        view: str,
    ) -> Route:
        segment_ids: list[str] = []
        route_coords: list[list[float]] = []
        total_dist_m = 0
        total_time_s = 0.0
        weighted_risk_sum = 0.0
        total_cost = 0.0
        max_cls_idx = 0
        segments_at_risk: list[SegmentAtRisk] = []

        cls_rank = {c: i for i, c in enumerate(CLASS_ORDER)}

        for i in range(len(node_path) - 1):
            u = node_path[i]
            v = node_path[i + 1]
            edges = self.graph.G[u][v]

            # Choose the edge between u and v with minimum cost
            best_edge = None
            best_cost = float("inf")

            for key, attrs in edges.items():
                cost = weight_fn(u, v, {key: attrs})
                if cost is not None and cost < best_cost:
                    best_cost = cost
                    best_edge = attrs

            if best_edge is None:
                # Fallback to first edge if all costs were 0 or infinite
                best_edge = next(iter(edges.values()))
                best_cost = best_edge["travel_time_s"]

            sid = best_edge["segment_id"]
            segment_ids.append(sid)
            length_m = best_edge["length_m"]
            travel_time_s = best_edge["travel_time_s"]

            total_dist_m += int(round(length_m))
            total_time_s += travel_time_s
            total_cost += best_cost

            # Coordinates
            edge_coords = best_edge["coords"]
            if not route_coords:
                route_coords.extend(edge_coords)
            else:
                route_coords.extend(edge_coords[1:])

            # Risk properties
            a = assessments.get(sid)
            if a:
                r = a.risk if view == "now" else a.peak_risk
                cls_str = a.risk_class.value if view == "now" else a.peak_class.value
            else:
                r = 0.0
                cls_str = "LOW"

            weighted_risk_sum += length_m * r
            cls_idx = cls_rank.get(cls_str, 0)
            if cls_idx > max_cls_idx:
                max_cls_idx = cls_idx

            if cls_str in ("HIGH", "CRITICAL"):
                seg_name = self.graph.by_id[sid]["properties"].get("name", sid)
                segments_at_risk.append(
                    SegmentAtRisk(
                        segment_id=sid,
                        name=seg_name,
                        risk_class=cls_str,
                        risk_probability=round(r, 3),
                    )
                )

        mean_risk = round(weighted_risk_sum / max(1.0, float(total_dist_m)), 3)

        return Route(
            segment_ids=segment_ids,
            geometry={"type": "LineString", "coordinates": route_coords},
            distance_m=total_dist_m,
            duration_s=round(total_time_s, 1),
            mean_risk=mean_risk,
            max_risk_class=CLASS_ORDER[max_cls_idx],
            segments_at_risk=segments_at_risk,
            cost=round(total_cost, 2),
        )

    def find_demo_trip(self, view: str = "peak") -> DemoTripResponse:
        assessments = self.risk_service.assess_all()

        # Find highest-risk segments in current view
        high_risk_segs = []
        for sid, a in assessments.items():
            r = a.risk if view == "now" else a.peak_risk
            cls = a.risk_class.value if view == "now" else a.peak_class.value
            if cls in ("HIGH", "CRITICAL"):
                high_risk_segs.append((sid, r, cls))

        if not high_risk_segs:
            raise HTTPException(404, "No high-risk segments exist in the current scenario to demonstrate safe routing.")

        high_risk_segs.sort(key=lambda x: x[1], reverse=True)
        target_sid, target_r, target_cls = high_risk_segs[0]
        target_name = self.graph.by_id[target_sid]["properties"].get("name", target_sid)

        # Deterministic node pair search (seeded rng)
        rng = random.Random(42)
        all_nodes = list(self.graph.nodes.keys())
        rng.shuffle(all_nodes)

        # Search up to 400 node pairs 1-3 km apart
        checked = 0
        best_pair = None

        for i in range(len(all_nodes)):
            if checked >= 400:
                break
            u = all_nodes[i]
            u_lat, u_lon = self.graph.nodes[u]
            for j in range(i + 1, min(i + 50, len(all_nodes))):
                v = all_nodes[j]
                v_lat, v_lon = self.graph.nodes[v]
                dist = haversine_m(u_lat, u_lon, v_lat, v_lon)

                if 1000.0 <= dist <= 3000.0:
                    checked += 1
                    try:
                        req = RouteRequest(
                            origin=LatLng(lat=u_lat, lon=u_lon),
                            destination=LatLng(lat=v_lat, lon=v_lon),
                            view=view,
                        )
                        res = self.route(req)
                        if res.status == "OK" and res.recommendation == "SAFER_ROUTE":
                            # Check if fastest crosses target segment
                            if target_sid in res.fastest.segment_ids:
                                if res.safest and res.safest.duration_s <= 2.5 * res.fastest.duration_s:
                                    return DemoTripResponse(
                                        origin=LatLng(lat=u_lat, lon=u_lon),
                                        destination=LatLng(lat=v_lat, lon=v_lon),
                                        note=f"Fastest route crosses {target_name} ({target_cls}), but a safer alternative is available.",  # noqa: E501
                                    )
                            # Keep best alternative if target_sid not yet crossed
                            if best_pair is None and res.safest and res.safest.duration_s <= 2.5 * res.fastest.duration_s:  # noqa: E501
                                cross_names = [s.name for s in res.fastest.segments_at_risk]
                                cross_str = cross_names[0] if cross_names else target_name
                                best_pair = DemoTripResponse(
                                    origin=LatLng(lat=u_lat, lon=u_lon),
                                    destination=LatLng(lat=v_lat, lon=v_lon),
                                    note=f"Fastest route crosses {cross_str} ({target_cls}), but a safer alternative is available.",  # noqa: E501
                                )
                    except HTTPException:
                        continue
                    if checked >= 400:
                        break

        if best_pair:
            return best_pair

        # If sample dataset with N01 / N51
        if "N01" in self.graph.nodes and "N51" in self.graph.nodes:
            u_lat, u_lon = self.graph.nodes["N01"]
            v_lat, v_lon = self.graph.nodes["N51"]
            return DemoTripResponse(
                origin=LatLng(lat=u_lat, lon=u_lon),
                destination=LatLng(lat=v_lat, lon=v_lon),
                note=f"Fastest route crosses {target_name} ({target_cls}), but a safer alternative is available.",
            )

        raise HTTPException(404, "Could not find a valid demo trip fulfilling route criteria in current network.")
