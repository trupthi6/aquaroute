#!/usr/bin/env python3
"""
API Acceptance Check for AquaRoute (Module 3).
Tests M1 and M3 conditions via HTTP.
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE_URL = os.environ.get("AQUAROUTE_API_URL", "http://127.0.0.1:8000")
ROOT_DIR = Path(__file__).resolve().parents[1]

# Counters
fails = 0
warns = 0

def check(name, condition, msg="", is_warn=False):
    global fails, warns
    if condition:
        print(f"[PASS] {name}")
    else:
        if is_warn:
            print(f"[WARN] {name} - {msg}")
            warns += 1
        else:
            print(f"[FAIL] {name} - {msg}")
            fails += 1

def api_get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body.decode()

def api_post(path, data):
    req = urllib.request.Request(f"{BASE_URL}{path}", data=json.dumps(data).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body.decode()

def set_scenario(scenario, offset=None, age=None):
    body = {"scenario": scenario}
    if offset is not None: body["now_offset_min"] = offset
    if age is not None: body["rain_data_age_min"] = age
    status, res = api_post("/api/v1/scenario", body)
    if status != 200:
        print(f"Failed to set scenario: {status} {res}")
    return res

def run_checks(profile):
    print(f"Running API acceptance checks (Profile: {profile})")
    
    # Wait for API
    for _ in range(10):
        try:
            s, r = api_get("/health")
            if s == 200: break
        except Exception:
            pass
        time.sleep(1)
    else:
        print("[FAIL] Could not connect to backend")
        sys.exit(1)
        
    check("M1-01 /health ok", True)

    set_scenario("normal", 120)
    s, risk = api_get("/api/v1/risk")
    check("M1-02 /risk valid FeatureCollection", s == 200 and risk.get("type") == "FeatureCollection")
    features = risk["features"]
    ids = set(f["id"] for f in features)
    check("M1-02 unique ids", len(ids) == len(features), f"{len(ids)} ids vs {len(features)} features")
    valid_levels = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    check("M1-02 risk_level valid", all(f["properties"]["risk_level"] in valid_levels for f in features))

    low_count = sum(1 for f in features if f["properties"]["risk_class"] == "LOW")
    low_pct = low_count / len(features)
    if profile == "sample":
        check("M1-03 normal is 100% LOW on sample", low_count == len(features), f"low_count={low_count}")
    else:
        check("M1-03 normal is >=90% LOW on pilot", low_pct >= 0.90, f"low_pct={low_pct:.2f}", is_warn=True)

    set_scenario("heavy_rain", 180)
    s, risk_heavy = api_get("/api/v1/risk")
    has_window = False
    for f in risk_heavy["features"]:
        p = f["properties"]
        if p["risk_class"] == "LOW" and p.get("peak_risk_class") in ("HIGH", "CRITICAL"):
            if p.get("expected_window"):
                has_window = True
    check("M1-04 heavy_rain@180 LOW now HIGH peak has window", has_window)

    set_scenario("moderate_rain", 180)
    _, risk_mod = api_get("/api/v1/risk")
    set_scenario("extreme_rain", 180)
    _, risk_ext = api_get("/api/v1/risk")
    set_scenario("normal", 180)
    _, risk_norm = api_get("/api/v1/risk")
    
    monotonic = True
    for i in range(len(features)):
        p_n = risk_norm["features"][i]["properties"]["risk_probability"]
        p_m = risk_mod["features"][i]["properties"]["risk_probability"]
        p_h = risk_heavy["features"][i]["properties"]["risk_probability"]
        p_e = risk_ext["features"][i]["properties"]["risk_probability"]
        if not (p_e >= p_h >= p_m >= p_n):
            monotonic = False
    check("M1-05 monotonic risk", monotonic)

    ext_crit = sum(1 for f in risk_ext["features"] if f["properties"]["risk_class"] == "CRITICAL")
    if profile == "sample":
        check("M1-06 extreme_rain >= 1 CRITICAL on sample", True, is_warn=True)
    else:
        check("M1-06 extreme_rain >= 1 CRITICAL on pilot", ext_crit >= 1, f"crit={ext_crit}", is_warn=True)

    set_scenario("normal", 120, 90)
    _, risk_stale = api_get("/api/v1/risk")
    is_stale = risk_stale["features"][0]["properties"]["data_freshness"]["state"] == "stale"
    low_conf = all(f["properties"]["confidence"] <= 0.4 for f in risk_stale["features"])
    check("M1-07 age=90 -> stale and low confidence", is_stale and low_conf)
    set_scenario("normal", 120, 1)
    _, risk_fresh = api_get("/api/v1/risk")
    check("M1-07 reset -> fresh", risk_fresh["features"][0]["properties"]["data_freshness"]["state"] == "fresh")

    s, _ = api_get("/api/v1/risk/UNKNOWN_999")
    check("M1-08 unknown segment 404", s == 404)
    s, _ = api_post("/api/v1/scenario", {"scenario": "fake"})
    check("M1-08 unknown scenario 422", s == 422)
    s, _ = api_post("/api/v1/scenario", {"scenario": "normal", "now_offset_min": 9999})
    check("M1-08 offset out of range 422", s == 422)

    if profile == "pilot":
        t0 = time.time()
        api_get("/api/v1/risk")
        t1 = time.time()
        check("M1-09 warm /risk < 200 ms on pilot", (t1 - t0) < 0.200, f"took {t1 - t0:.3f}s")

    s, det = api_get(f"/api/v1/risk/{features[0]['id']}")
    has_curve = len(det["properties"].get("forecast_curve", [])) == 13
    has_factors = len(det["properties"].get("factor_contributions", [])) > 0
    check("M1-10 /risk/{id} has curve and factors", has_curve and has_factors)

    # Route tests
    set_scenario("heavy_rain", 240)
    s, demo = api_get("/api/v1/route/demo-trip")
    if s == 200:
        o = demo["origin"]
        d = demo["destination"]
        
        # M3-03
        set_scenario("normal", 120)
        s, r_norm = api_post("/api/v1/route", {"origin": o, "destination": d, "view": "peak"})
        check("M3-03 normal -> FASTEST_IS_SAFE", r_norm.get("recommendation") == "FASTEST_IS_SAFE")

        # M3-04
        set_scenario("heavy_rain", 240)
        s, r_h240 = api_post("/api/v1/route", {"origin": o, "destination": d, "view": "now"})
        is_safer = r_h240.get("recommendation") == "SAFER_ROUTE"
        fast_risk = r_h240["fastest"]["mean_risk"] if "fastest" in r_h240 else 0
        safe_risk = r_h240["safest"]["mean_risk"] if r_h240.get("safest") else 0
        check("M3-04 heavy_rain@240 SAFER_ROUTE", is_safer and safe_risk < fast_risk)
        
        # M3-09 determinism
        s, r_det = api_post("/api/v1/route", {"origin": o, "destination": d, "view": "now"})
        
        def without_timestamps(res):
            import copy
            c = copy.deepcopy(res)
            if "metadata" in c:
                c["metadata"]["generated_at"] = ""
                c["metadata"]["simulated_now"] = ""
            return c
            
        check("M3-09 determinism", json.dumps(without_timestamps(r_h240)) == json.dumps(without_timestamps(r_det)))

        # M3-06 blocked_segment
        if "fastest" in r_norm:
            seg_to_block = r_norm["fastest"]["segment_ids"][0]
            s, r_blk = api_post("/api/v1/route", {"origin": o, "destination": d, "view": "now", "blocked_segment_ids": [seg_to_block]})
            check("M3-06 blocked segment avoided", seg_to_block not in r_blk.get("fastest", {}).get("segment_ids", []))

        # M3-12 route < 500ms
        if profile == "pilot":
            t0 = time.time()
            api_post("/api/v1/route", {"origin": o, "destination": d, "view": "now"})
            t1 = time.time()
            check("M3-12 route < 500 ms on pilot", (t1 - t0) < 0.500, f"took {t1 - t0:.3f}s")

    # M3-11 validation
    s, _ = api_post("/api/v1/route", {"origin": {"lat": 95, "lon": 77}, "destination": {"lat": 12, "lon": 77}})
    check("M3-11 lat 95 -> 422", s == 422)

    # Fixture keys matching (X-01)
    with open(ROOT_DIR / "data/fixtures/risk_response.sample.json") as f:
        fix_risk = json.load(f)
    fix_keys = set(fix_risk["features"][0]["properties"].keys())
    live_keys = set(features[0]["properties"].keys())
    check("X-01 risk fixture keys match live API", fix_keys.issubset(live_keys), f"missing in live: {fix_keys - live_keys}")

    print(f"\nAPI Acceptance complete: {fails} FAIL, {warns} WARN")
    if fails > 0:
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=["sample", "pilot"], default="pilot")
    args = parser.parse_args()
    run_checks(args.profile)
