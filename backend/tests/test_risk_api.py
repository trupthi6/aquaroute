import json
import time
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[2] / "data" / "fixtures"


def set_scenario(client, scenario, offset=None, age=None):
    body = {"scenario": scenario}
    if offset is not None:
        body["now_offset_min"] = offset
    if age is not None:
        body["rain_data_age_min"] = age
    r = client.post("/api/v1/scenario", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_risk_is_valid_geojson_feature_collection(client):
    d = client.get("/api/v1/risk").json()
    assert d["type"] == "FeatureCollection" and len(d["features"]) == 38
    for f in d["features"]:
        assert f["type"] == "Feature" and f["geometry"]["type"] == "LineString"
        p = f["properties"]
        assert p["risk_level"] in ("LOW", "MEDIUM", "HIGH")
        assert p["risk_class"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert 0 <= p["risk_probability"] <= 1 and 0 <= p["confidence"] <= 1
        assert p["data_freshness"]["state"] in ("fresh", "aging", "stale")
        assert 1 <= len(p["top_factors"]) <= 3


def test_normal_scenario_mostly_low(client):
    set_scenario(client, "normal")
    d = client.get("/api/v1/risk").json()
    assert d["metadata"]["summary_now"]["LOW"] == 38


def test_heavy_rain_flags_underpass_high_and_flyover_not(client):
    set_scenario(client, "heavy_rain", 240)
    by_id = {f["id"]: f["properties"] for f in client.get("/api/v1/risk").json()["features"]}
    assert by_id["R-008"]["risk_level"] == "HIGH"
    assert by_id["R-012"]["risk_level"] != "HIGH"
    assert by_id["R-008"]["top_factors"]


def test_detail_endpoint_has_curve_and_breakdown(client):
    set_scenario(client, "heavy_rain", 180)
    p = client.get("/api/v1/risk/R-008").json()["properties"]
    assert [c["t_min"] for c in p["forecast_curve"]] == list(range(0, 181, 15))
    assert p["factor_contributions"][0]["contribution"] >= p["factor_contributions"][-1]["contribution"]
    assert p["expected_window"]["start_min"] >= 0
    assert "elevation_m" in p["static_features"]


def test_unknown_segment_404(client):
    assert client.get("/api/v1/risk/NOPE").status_code == 404


def test_scenario_switching_and_validation(client):
    s = set_scenario(client, "heavy_rain")
    assert s["now_offset_min"] == 180  # scenario default offset
    assert client.get("/api/v1/scenario").json()["scenario"] == "heavy_rain"
    assert client.post("/api/v1/scenario", json={"scenario": "meteor"}).status_code == 422
    assert client.post("/api/v1/scenario", json={"now_offset_min": 99999}).status_code == 422
    assert client.post("/api/v1/scenario", json={"now_offset_min": -5}).status_code == 422


def test_offset_snaps_to_data_resolution(client):
    assert set_scenario(client, "heavy_rain", 203)["now_offset_min"] == 200


def test_stale_data_visible_in_api(client):
    set_scenario(client, "heavy_rain", 240, 90)
    p = client.get("/api/v1/risk/R-008").json()["properties"]
    assert p["data_freshness"]["state"] == "stale" and p["confidence"] <= 0.4


def test_risk_response_is_fast_on_cache_miss(client):
    set_scenario(client, "heavy_rain", 235)
    t = time.perf_counter()
    assert client.get("/api/v1/risk").status_code == 200
    assert time.perf_counter() - t < 0.2


def test_response_matches_fixture_contract(client):
    set_scenario(client, "heavy_rain", 210)
    live = client.get("/api/v1/risk").json()
    fixture = json.loads((FIXTURES / "risk_response.sample.json").read_text())
    assert set(live) == set(fixture)
    assert set(live["features"][0]) == set(fixture["features"][0])
    assert set(live["features"][0]["properties"]) == set(fixture["features"][0]["properties"])
    assert set(live["metadata"]) == set(fixture["metadata"])
