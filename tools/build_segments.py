"""Build real road network dataset for AquaRoute (SIH26085).

Downloads OSM drivable network via OSMnx, retrieves SRTM elevation from OpenTopoData,
computes distance to nearest water body, assigns proxy drainage & history scores,
and exports GeoJSON segments matching the AquaRoute schema.

Usage:
  python tools/build_segments.py [--lat 12.928] [--lon 77.655] [--dist 1500]
                                 [--out data/pilot/segments.geojson] [--synthetic-elevation]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import networkx as nx
import osmnx as ox
import pyproj
import requests
from shapely.geometry import LineString, Point
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]

# Exclude service roads, tracks, footways, cycleways
ROAD_FILTER = (
    '["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|'
    'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"]'
)

ARTERIAL_CLASSES = {
    "motorway", "trunk", "primary", "secondary",
    "motorway_link", "trunk_link", "primary_link", "secondary_link",
}

CACHE_DIR = ROOT / ".cache"


def get_elevation_batch(coords: list[tuple[float, float]], wait_s: float = 1.2) -> list[float | None]:
    """Query OpenTopoData srtm30m for up to 100 points, fallback to Open-Elevation."""
    loc_str = "|".join(f"{lat:.6f},{lon:.6f}" for lat, lon in coords)
    try:
        url = f"https://api.opentopodata.org/v1/srtm30m?locations={loc_str}"
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "OK":
                return [r.get("elevation") for r in data.get("results", [])]
    except Exception as e:
        print(f"  OpenTopoData warning: {e}")

    # Fallback to Open-Elevation
    try:
        url = "https://api.open-elevation.com/api/v1/lookup"
        payload = {"locations": [{"latitude": lat, "longitude": lon} for lat, lon in coords]}
        resp = requests.post(url, json=payload, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            return [r.get("elevation") for r in data.get("results", [])]
    except Exception as e:
        print(f"  Open-Elevation warning: {e}")

    return [None] * len(coords)


def load_elevation_cache() -> dict[str, float]:
    cache_file = CACHE_DIR / "elevation_cache.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_elevation_cache(cache: dict[str, float]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / "elevation_cache.json"
    cache_file.write_text(json.dumps(cache), encoding="utf-8")


def fetch_node_elevations(
    nodes: dict[int, tuple[float, float]],
    synthetic: bool = False,
) -> tuple[dict[int, float], str]:
    """Fetch elevation for all nodes in the graph."""
    if synthetic:
        rng = random.Random(42)
        base = 880.0
        elevs = {}
        for nid, (lat, lon) in nodes.items():
            # Gentle slope towards Bellandur Lake (NE)
            elev = base - (lat - 12.928) * 80.0 - (lon - 77.655) * 60.0 + rng.uniform(-1.0, 1.0)
            elevs[nid] = round(elev, 1)
        return elevs, "synthetic_proxy"

    cache = load_elevation_cache()
    elevs: dict[int, float] = {}
    missing_nodes: list[tuple[int, float, float]] = []

    for nid, (lat, lon) in nodes.items():
        key = f"{lat:.6f},{lon:.6f}"
        if key in cache:
            elevs[nid] = cache[key]
        else:
            missing_nodes.append((nid, lat, lon))

    if missing_nodes:
        print(f"Fetching elevations for {len(missing_nodes)} nodes ({len(cache)} cached)...")
        chunk_size = 100
        for i in range(0, len(missing_nodes), chunk_size):
            chunk = missing_nodes[i:i + chunk_size]
            coords = [(lat, lon) for _, lat, lon in chunk]
            batch_elev = get_elevation_batch(coords)

            failed = any(e is None for e in batch_elev)
            if failed:
                print("  Elevation API failed on batch. Checking fallback...")
                raise RuntimeError(
                    "Elevation API failed for OpenTopoData and Open-Elevation. "
                    "Use --synthetic-elevation if offline or APIs are unavailable."
                )

            for (nid, lat, lon), elev in zip(chunk, batch_elev):
                if elev is not None:
                    elevs[nid] = round(elev, 1)
                    cache[f"{lat:.6f},{lon:.6f}"] = round(elev, 1)

            if i + chunk_size < len(missing_nodes):
                time.sleep(1.2)  # Respect OpenTopoData rate limit

        save_elevation_cache(cache)

    return elevs, "SRTM 30m via OpenTopoData"


def build_segments(
    lat: float = 12.928,
    lon: float = 77.655,
    dist: int = 1500,
    out_path: Path | None = None,
    synthetic_elevation: bool = False,
) -> dict:
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE_DIR / "osmnx")
    ox.settings.log_console = False

    current_dist = dist
    print(f"Downloading OSM drivable road network around ({lat}, {lon}) with dist={current_dist}m...")

    G = None
    physical_segments = []

    # Target: between 150 and 600 road segments (shrink by 200 m steps until <= 600)
    while True:
        G_raw = ox.graph_from_point((lat, lon), dist=current_dist, custom_filter=ROAD_FILTER, retain_all=False)
        # Keep largest weakly connected component
        largest_cc = max(nx.weakly_connected_components(G_raw), key=len)
        G = G_raw.subgraph(largest_cc).copy()

        # Identify physical road segments (merge u->v and v->u pairs)
        visited_pairs: set[tuple[int, int]] = set()
        candidates = []

        for u, v, k, data in G.edges(keys=True, data=True):
            pair_key = (min(u, v), max(u, v))
            if pair_key in visited_pairs:
                continue
            visited_pairs.add(pair_key)
            candidates.append((u, v, k, data))

        count = len(candidates)
        print(f"  Radius {current_dist}m: {count} physical segments, {len(G.nodes)} nodes.")

        if count <= 600 or current_dist <= 700:
            physical_segments = candidates
            break
        current_dist -= 200
        print(f"  Segment count {count} > 600, shrinking radius to {current_dist}m...")

    if not (150 <= len(physical_segments) <= 600):
        print(f"  Notice: Segment count is {len(physical_segments)} (target: 150-600).")

    # Fetch water features
    print("Fetching OSM water features...")
    water_union = None
    project_to_utm = None
    try:
        water = ox.features_from_point(
            (lat, lon), tags={"natural": ["water", "wetland"], "waterway": True}, dist=current_dist + 1000
        )
        if len(water) > 0:
            water_proj = water.to_crs(epsg=32643)
            water_union = water_proj.union_all()
            wgs84 = pyproj.CRS("EPSG:4326")
            utm = pyproj.CRS("EPSG:32643")
            project_to_utm = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            print(f"  Found {len(water)} water features.")
    except Exception as e:
        print(f"  Warning fetching water features: {e}")

    # Fallback lake points: Bellandur Lake (~12.935, 77.665), Agara Lake (~12.922, 77.648)
    lake_coords = [(12.935, 77.665), (12.922, 77.648)]

    # Fetch node elevations
    node_coords = {nid: (G.nodes[nid]["y"], G.nodes[nid]["x"]) for nid in G.nodes}
    elevations, elev_source = fetch_node_elevations(node_coords, synthetic=synthetic_elevation)

    # Hotspots seed
    hotspots_file = ROOT / "data" / "pilot" / "hotspots_seed.json"
    hotspots = []
    if hotspots_file.exists():
        try:
            hotspots = json.loads(hotspots_file.read_text(encoding="utf-8"))
        except Exception:
            hotspots = []

    # Seeded RNG for proxy values
    rng = random.Random(42)

    # First pass: construct base segment data and elevations
    raw_segments = []
    for i, (u, v, k, data) in enumerate(physical_segments, start=1):
        sid = f"R-{i:03d}"
        has_forward = G.has_edge(u, v)
        has_backward = G.has_edge(v, u)
        is_oneway = not (has_forward and has_backward)

        # Name
        name_val = data.get("name")
        if isinstance(name_val, list):
            name = str(name_val[0])
        elif name_val:
            name = str(name_val)
        else:
            name = "Unnamed road"

        # Highway
        hw_val = data.get("highway", "residential")
        if isinstance(hw_val, list):
            highway = str(hw_val[0])
        else:
            highway = str(hw_val)

        # Geometry
        u_x, u_y = G.nodes[u]["x"], G.nodes[u]["y"]
        v_x, v_y = G.nodes[v]["x"], G.nodes[v]["y"]

        geom = data.get("geometry")
        if geom is not None and isinstance(geom, LineString):
            coords = [[round(pt[0], 6), round(pt[1], 6)] for pt in geom.coords]
            # Ensure coordinates travel from u to v
            first_dist_u = math.hypot(coords[0][0] - u_x, coords[0][1] - u_y)
            first_dist_v = math.hypot(coords[0][0] - v_x, coords[0][1] - v_y)
            if first_dist_v < first_dist_u:
                coords.reverse()
        else:
            coords = [[round(u_x, 6), round(u_y, 6)], [round(v_x, 6), round(v_y, 6)]]

        # Length in meters
        length_m = round(float(data.get("length", 0)))
        if length_m <= 0:
            # Haversine calculation
            length_m = round(ox.distance.great_circle(u_y, u_x, v_y, v_x))

        # Midpoint
        mid_x = (coords[0][0] + coords[-1][0]) / 2.0
        mid_y = (coords[0][1] + coords[-1][1]) / 2.0

        # Water distance
        water_dist_m = 1000
        if water_union is not None and project_to_utm is not None:
            try:
                pt_utm = transform(project_to_utm, Point(mid_x, mid_y))
                water_dist_m = round(pt_utm.distance(water_union))
            except Exception:
                water_dist_m = 1000
        else:
            # Fallback to nearest reference lake
            min_dist = min(ox.distance.great_circle(mid_y, mid_x, l_lat, l_lon) for l_lat, l_lon in lake_coords)
            water_dist_m = round(min_dist)

        # Elevation: mean of endpoint node elevations
        elev_u = elevations.get(u, 880.0)
        elev_v = elevations.get(v, 880.0)
        seg_elev = round((elev_u + elev_v) / 2.0, 1)

        tunnel = data.get("tunnel") == "yes" or int(data.get("layer", 0)) < 0
        bridge = data.get("bridge") == "yes"

        raw_segments.append({
            "segment_id": sid,
            "name": name,
            "highway": highway,
            "oneway": is_oneway,
            "from_node": str(u),
            "to_node": str(v),
            "length_m": length_m,
            "elevation_m": seg_elev,
            "water_distance_m": water_dist_m,
            "tunnel": tunnel,
            "bridge": bridge,
            "coords": coords,
            "midpoint": (mid_x, mid_y),
            "u": u,
            "v": v,
        })

    # Node adjacency for neighbouring segments
    node_to_segs: dict[int, list[int]] = {}
    for idx, s in enumerate(raw_segments):
        node_to_segs.setdefault(s["u"], []).append(idx)
        node_to_segs.setdefault(s["v"], []).append(idx)

    # Second pass: compute is_low_point, kind, drain proxy, history score
    min_elev = min(s["elevation_m"] for s in raw_segments)
    max_elev = max(s["elevation_m"] for s in raw_segments)

    features = []
    kind_counts: dict[str, int] = {}
    underpass_count = 0
    flyover_count = 0
    water_near_count = 0
    used_hotspots = False

    for idx, s in enumerate(raw_segments):
        # Neighbouring segments
        nbr_indices = set(node_to_segs.get(s["u"], []) + node_to_segs.get(s["v"], []))
        nbr_indices.discard(idx)

        # Flag is_low_point when segment is >= 1.5m lower than every neighbouring segment
        is_dem_low = (
            len(nbr_indices) > 0 and
            all((raw_segments[n]["elevation_m"] - s["elevation_m"]) >= 1.5 for n in nbr_indices)
        )
        is_low_point = s["tunnel"] or is_dem_low

        # Assign kind
        if s["tunnel"]:
            kind = "underpass"
            underpass_count += 1
        elif s["bridge"]:
            kind = "flyover"
            flyover_count += 1
        elif s["water_distance_m"] <= 150:
            kind = "lakeside"
            water_near_count += 1
        elif s["highway"] in ARTERIAL_CLASSES:
            kind = "arterial"
        else:
            kind = "residential"

        kind_counts[kind] = kind_counts.get(kind, 0) + 1

        # Drain proxy
        if kind == "flyover":
            drain_cap = round(rng.uniform(50, 60))
            drain_dist = round(rng.uniform(25, 45))
        elif kind == "arterial":
            drain_cap = round(rng.uniform(38, 48))
            drain_dist = round(rng.uniform(70, 140))
        elif kind == "underpass":
            drain_cap = round(rng.uniform(20, 25))
            drain_dist = round(rng.uniform(160, 220))
        elif kind == "lakeside":
            drain_cap = round(rng.uniform(22, 28))
            drain_dist = round(rng.uniform(200, 300))
        else:  # residential
            drain_cap = round(rng.uniform(24, 36))
            drain_dist = round(rng.uniform(90, 200))

        # History score
        h_score = None
        for h in hotspots:
            match_str = h.get("segment_name_contains", "").strip().lower()
            if match_str and match_str in s["name"].lower():
                h_score = float(h.get("score", 0.5))
                used_hotspots = True
                break

        if h_score is None:
            elev_span = max(1.0, max_elev - min_elev)
            low_ratio = (max_elev - s["elevation_m"]) / elev_span
            water_prox = max(0.0, 1.0 - min(s["water_distance_m"], 1000.0) / 1000.0)
            base_score = 0.5 * low_ratio + 0.3 * water_prox
            if is_low_point:
                base_score += 0.25
            h_score = round(max(0.0, min(1.0, base_score + rng.uniform(-0.1, 0.1))), 2)

        if kind == "flyover":
            h_score = 0.0

        props = {
            "segment_id": s["segment_id"],
            "name": s["name"],
            "kind": kind,
            "highway": s["highway"],
            "oneway": s["oneway"],
            "from_node": s["from_node"],
            "to_node": s["to_node"],
            "length_m": s["length_m"],
            "elevation_m": s["elevation_m"],
            "is_low_point": is_low_point,
            "drain_distance_m": drain_dist,
            "drain_capacity_mm_hr": drain_cap,
            "history_score": h_score,
            "water_distance_m": s["water_distance_m"],
        }

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": s["coords"],
            },
            "properties": props,
        })

    # Compute bounding box
    all_lons = [c[0] for f in features for c in f["geometry"]["coordinates"]]
    all_lats = [c[1] for f in features for c in f["geometry"]["coordinates"]]
    bbox = [min(all_lons), min(all_lats), max(all_lons), max(all_lats)]

    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "name": "pilot_bengaluru",
            "synthetic": False,
            "source": "OpenStreetMap contributors (ODbL)",
            "elevation_source": elev_source,
            "drain_source": "synthetic_proxy",
            "history_source": "hotspots_seed.json" if used_hotspots else "heuristic_proxy",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "bbox": bbox,
            "notes": "Pilot corridor Agara-HSR-Bellandur (SIH26085). Drainage and history are documented proxies.",
        },
        "features": features,
    }

    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(geojson, indent=1), encoding="utf-8")
        print(f"Wrote {len(features)} segments to {out_path}")

    # Summary
    print("\n=== Dataset Summary ===")
    print(f"Segment count: {len(features)}")
    print(f"Node count: {len(node_coords)}")
    print(f"Kinds: {kind_counts}")
    print(f"Elevation min/max: {min_elev:.1f} m / {max_elev:.1f} m")
    print(f"Detected underpasses: {underpass_count}, flyovers: {flyover_count}")
    print(f"Near-water segments (<=150m): {water_near_count}")

    return geojson


def main():
    parser = argparse.ArgumentParser(description="Build real road network for AquaRoute pilot area.")
    parser.add_argument("--lat", type=float, default=12.928, help="Pilot center latitude (default 12.928)")
    parser.add_argument("--lon", type=float, default=77.655, help="Pilot center longitude (default 77.655)")
    parser.add_argument("--dist", type=int, default=1500, help="Initial search radius in meters (default 1500)")
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "pilot" / "segments.geojson", help="Output GeoJSON path")
    parser.add_argument("--synthetic-elevation", action="store_true", help="Generate synthetic elevation if APIs unavailable")
    args = parser.parse_args()

    build_segments(
        lat=args.lat,
        lon=args.lon,
        dist=args.dist,
        out_path=args.out,
        synthetic_elevation=args.synthetic_elevation,
    )


if __name__ == "__main__":
    main()
