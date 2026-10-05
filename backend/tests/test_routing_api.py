import time
from pathlib import Path

import pytest

from app.core.data_loader import load_segments
from app.services.risk.base import ReportSignal
from app.services.routing.engine import RouteEngine

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = {"lat": 12.9215, "lon": 77.6400}      # N01
DESTINATION = {"lat": 12.9215, "lon": 77.6725} # N51


def set_scenario(client, scenario, offset=None, age=None):
    body = {"scenario": scenario}
    if offset is not None:
        body["now_offset_min"] = offset
    if age is not None:
        body["rain_data_age_min"] = age
    r = client.post("/api/v1/scenario", json=body)
    assert r.status_code == 200
    return r.json()


def test_deterministic_normal(client):
    set_scenario(client, "normal", 120)
    res = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "view": "peak"})
    assert res.status_code == 200
    d = res.json()
    assert d["status"] == "OK"
    assert d["recommendation"] == "FASTEST_IS_SAFE"
    assert d["fastest"]["segment_ids"] == d["safest"]["segment_ids"]


def test_deterministic_heavy_rain_240(client):
    set_scenario(client, "heavy_rain", 240)
    res = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "view": "now"})
    assert res.status_code == 200
    d = res.json()
    assert d["status"] == "OK"
    assert d["recommendation"] == "SAFER_ROUTE"
    assert "R-008" in d["fastest"]["segment_ids"]
    assert "R-008" not in d["safest"]["segment_ids"]
    assert d["safest"]["mean_risk"] < d["fastest"]["mean_risk"]
    assert any("Underpass" in r for r in d["reasons"])


def test_deterministic_extreme_rain_240(client):
    set_scenario(client, "extreme_rain", 240)
    res = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "view": "now"})
    assert res.status_code == 200
    d = res.json()
    assert "R-008" in d["fastest"]["segment_ids"]
    if d["safest"] is not None:
        assert "R-008" not in d["safest"]["segment_ids"]
    else:
        assert d["status"] == "NO_SAFE_ROUTE"


def test_deterministic_heavy_rain_180(client):
    set_scenario(client, "heavy_rain", 180)
    res_now = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "view": "now"}).json()
    res_peak = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "view": "peak"}).json()
    assert res_now["recommendation"] == "FASTEST_IS_SAFE"
    assert res_peak["recommendation"] == "SAFER_ROUTE"


def test_deterministic_blocked_segment(client):
    set_scenario(client, "normal", 120)
    req_base = {"origin": ORIGIN, "destination": DESTINATION, "view": "now"}
    r_base = client.post("/api/v1/route", json=req_base).json()
    assert "R-008" in r_base["fastest"]["segment_ids"]

    req_blk = {"origin": ORIGIN, "destination": DESTINATION, "view": "now", "blocked_segment_ids": ["R-008"]}
    r_blk = client.post("/api/v1/route", json=req_blk).json()
    assert "R-008" not in r_blk["fastest"]["segment_ids"]
    assert "R-008" not in r_blk["safest"]["segment_ids"]
    assert r_blk["fastest"]["segment_ids"] != r_base["fastest"]["segment_ids"]


def test_blocking_all_segments_touching_origin(client):
    set_scenario(client, "normal", 120)
    # Segments touching N01 in sample: R-006, R-021, R-022
    req = {
        "origin": ORIGIN,
        "destination": DESTINATION,
        "view": "now",
        "blocked_segment_ids": ["R-006", "R-021", "R-022"],
    }
    r = client.post("/api/v1/route", json=req)
    assert r.status_code in (422, 200)
    if r.status_code == 200:
        assert r.json()["status"] == "NO_SAFE_ROUTE"


def test_determinism(client):
    set_scenario(client, "heavy_rain", 240)
    req = {"origin": ORIGIN, "destination": DESTINATION, "view": "peak"}
    r1 = client.post("/api/v1/route", json=req).json()
    r2 = client.post("/api/v1/route", json=req).json()
    assert r1["fastest"]["segment_ids"] == r2["fastest"]["segment_ids"]
    assert r1["safest"]["segment_ids"] == r2["safest"]["segment_ids"]
    assert r1["recommendation"] == r2["recommendation"]


def test_validation_errors(client):
    # Invalid latitude
    r = client.post("/api/v1/route", json={"origin": {"lat": 95.0, "lon": 77.64}, "destination": DESTINATION})
    assert r.status_code == 422

    # Outside pilot area (>500m)
    r = client.post("/api/v1/route", json={"origin": {"lat": 13.50, "lon": 78.50}, "destination": DESTINATION})
    assert r.status_code == 422
    assert "outside pilot area" in r.text.lower()

    # Same origin and destination
    r = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": ORIGIN})
    assert r.status_code == 422
    assert "same" in r.text.lower()

    # Unknown segment id in blocked_segment_ids
    r = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "blocked_segment_ids": ["UNKNOWN_999"]})  # noqa: E501
    assert r.status_code == 422


def test_demo_trip_endpoint(client):
    # Normal scenario has no HIGH/CRITICAL segments -> 404
    set_scenario(client, "normal", 120)
    r = client.get("/api/v1/route/demo-trip")
    assert r.status_code == 404

    # Heavy rain 240 has high risk segments -> 200
    set_scenario(client, "heavy_rain", 240)
    r = client.get("/api/v1/route/demo-trip")
    assert r.status_code == 200
    demo = r.json()
    assert "origin" in demo and "destination" in demo

    # Route demo trip
    route_res = client.post("/api/v1/route", json={"origin": demo["origin"], "destination": demo["destination"], "view": "peak"}).json()  # noqa: E501
    assert route_res["status"] == "OK"
    assert route_res["recommendation"] == "SAFER_ROUTE"
    assert route_res["safest"]["mean_risk"] < route_res["fastest"]["mean_risk"]


def test_verified_block_closure(client):
    # Inject a verified blockage on R-008
    set_scenario(client, "normal", 120)
    risk_service = client.app.state.risk_service
    risk_service.reports_provider = lambda: {"R-008": ReportSignal(report_count=1, verified_block=True)}
    risk_service.reports_version += 1

    r = client.post("/api/v1/route", json={"origin": ORIGIN, "destination": DESTINATION, "view": "now"}).json()
    assert "R-008" not in r["fastest"]["segment_ids"]
    assert "R-008" not in r["safest"]["segment_ids"]


def test_routing_performance_on_pilot_graph(client):
    pilot_path = ROOT / "data" / "pilot" / "segments.geojson"
    if not pilot_path.exists():
        pytest.skip("Pilot segments.geojson does not exist")
    pilot_segments = load_segments(pilot_path)
    engine = RouteEngine(pilot_segments, client.app.state.risk_service)

    # Route between two pilot points
    coords = pilot_segments[0]["geometry"]["coordinates"][0]
    dest_coords = pilot_segments[-1]["geometry"]["coordinates"][-1]
    from app.models.route import LatLng, RouteRequest
    req = RouteRequest(
        origin=LatLng(lat=coords[1], lon=coords[0]),
        destination=LatLng(lat=dest_coords[1], lon=dest_coords[0]),
        view="peak",
    )
    t0 = time.perf_counter()
    res = engine.route(req)
    elapsed = time.perf_counter() - t0
    assert elapsed < 0.500, f"Routing took {elapsed:.3f}s, expected < 0.500s"
    assert res.status in ("OK", "NO_SAFE_ROUTE")
