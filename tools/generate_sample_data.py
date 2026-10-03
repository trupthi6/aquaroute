"""Generate the SYNTHETIC pilot dataset used by AquaRoute Module 1.

Outputs (deterministic, seed=42):
  data/pilot/segments.geojson
  data/scenarios/rain_scenarios.json

The catchment is a 6x4 street grid loosely placed over the Agara-HSR-Bellandur
corridor in Bengaluru. Terrain slopes down towards a "lake" in the north-east
corner. Every number here is synthetic - replace with real OSM / DEM / BBMP
drain data (see tools/build_segments.py in a later module) before any real use.

Run:  python tools/generate_sample_data.py
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLS, ROWS = 6, 4
LON0, LAT0, STEP = 77.640, 12.915, 0.0065  # ~700 m per cell
LAKE = (LON0 + 5.6 * STEP, LAT0 + 3.4 * STEP)  # (lon, lat) of the synthetic lake


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def haversine_m(lon1, lat1, lon2, lat2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dlmb = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def node_xy(c, r):
    return LON0 + c * STEP, LAT0 + r * STEP


def node_elev(c, r):
    return 912.0 - 1.6 * c - 1.2 * r  # slopes down towards the NE lake


# Hand-set overrides so the demo has clear archetypes. Keys are segment ids.
OVERRIDES = {
    "R-008": dict(name="Agara Underpass (sample)", kind="underpass", elev_delta=-5.0,
                  is_low_point=True, history_score=0.90, drain_distance_m=180, drain_capacity_mm_hr=22),
    "R-007": dict(name="Underpass approach West (sample)", kind="arterial", elev_delta=-1.5,
                  history_score=0.60, drain_distance_m=140, drain_capacity_mm_hr=26),
    "R-009": dict(name="Underpass approach East (sample)", kind="arterial", elev_delta=-1.5,
                  history_score=0.60, drain_distance_m=160, drain_capacity_mm_hr=26),
    "R-012": dict(name="Flyover Deck A (sample)", kind="flyover", elev_delta=6.0,
                  history_score=0.0, drain_distance_m=30, drain_capacity_mm_hr=50),
    "R-013": dict(name="Flyover Deck B (sample)", kind="flyover", elev_delta=6.0,
                  history_score=0.0, drain_distance_m=30, drain_capacity_mm_hr=50),
    "R-020": dict(name="Lakeside Road North (sample)", kind="lakeside", history_score=0.70,
                  drain_distance_m=260, drain_capacity_mm_hr=24),
    "R-038": dict(name="Lakeside Road East (sample)", kind="lakeside", history_score=0.70,
                  drain_distance_m=300, drain_capacity_mm_hr=24),
}


def build_segments():
    rng = random.Random(42)
    edges = []  # (u, v) as (c, r) tuples; horizontals first, then verticals
    for r in range(ROWS):
        for c in range(COLS - 1):
            edges.append(((c, r), (c + 1, r)))
    for c in range(COLS):
        for r in range(ROWS - 1):
            edges.append(((c, r), (c, r + 1)))

    features = []
    for i, (u, v) in enumerate(edges, start=1):
        sid = f"R-{i:03d}"
        (x1, y1), (x2, y2) = node_xy(*u), node_xy(*v)
        elev = (node_elev(*u) + node_elev(*v)) / 2 + rng.uniform(-0.4, 0.4)
        low_est = clamp((912.0 - elev) / 11.6)
        is_arterial = u[1] == 1 and v[1] == 1  # row 1 horizontals
        props = dict(
            segment_id=sid,
            name=f"Sample Road {sid}",
            kind="arterial" if is_arterial else "residential",
            from_node=f"N{u[0]}{u[1]}",
            to_node=f"N{v[0]}{v[1]}",
            is_low_point=False,
            history_score=round(clamp(0.6 * low_est + rng.uniform(-0.15, 0.15)), 2),
            drain_distance_m=round(rng.uniform(40, 350)),
            drain_capacity_mm_hr=round(rng.uniform(38, 48) if is_arterial else rng.uniform(22, 45)),
        )
        ov = dict(OVERRIDES.get(sid, {}))
        elev += ov.pop("elev_delta", 0.0)
        props.update(ov)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        props["elevation_m"] = round(elev, 1)
        props["length_m"] = round(haversine_m(x1, y1, x2, y2))
        props["water_distance_m"] = round(haversine_m(mx, my, *LAKE))
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[x1, y1], [x2, y2]]},
            "properties": props,
        })
    return {
        "type": "FeatureCollection",
        "metadata": {"synthetic": True, "note": "Synthetic sample catchment for AquaRoute Module 1. Not real survey data.",
                     "crs": "EPSG:4326"},
        "features": features,
    }


def gaussian_series(peak, center, width, n, step):
    return [round(peak * math.exp(-(((i * step + step / 2) - center) / width) ** 2), 2) for i in range(n)]


def build_scenarios():
    step, n = 5, 96  # 8 hours at 5-minute resolution
    def sc(desc, peak, center, width, default_offset):
        return dict(description=desc, default_now_offset_min=default_offset, rain_data_age_min=1,
                    intensity_mm_hr=gaussian_series(peak, center, width, n, step))
    return {
        "start": "2026-10-03T14:00:00+05:30",
        "step_minutes": step,
        "scenarios": {
            "normal": sc("Light drizzle, no flood concern.", 3, 240, 90, 120),
            "moderate_rain": sc("Steady moderate rain; drains mostly cope.", 28, 240, 70, 180),
            "heavy_rain": sc("Intense cloudburst-style event peaking around +240 min.", 60, 240, 45, 180),
            "extreme_rain": sc("Stress test: extreme event that pushes the worst spots to CRITICAL.", 90, 240, 55, 210),
        },
    }


if __name__ == "__main__":
    (ROOT / "data/pilot").mkdir(parents=True, exist_ok=True)
    (ROOT / "data/scenarios").mkdir(parents=True, exist_ok=True)
    seg = build_segments()
    (ROOT / "data/pilot/segments.geojson").write_text(json.dumps(seg, indent=1))
    (ROOT / "data/scenarios/rain_scenarios.json").write_text(json.dumps(build_scenarios()))
    print(f"wrote {len(seg['features'])} segments and {len(build_scenarios()["scenarios"])} scenarios")
