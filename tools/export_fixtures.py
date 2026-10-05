"""Regenerate data/fixtures/*.sample.json from the live engine (run after changing the contract).

Run from the repo root:  python tools/export_fixtures.py
"""
import json
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["AQUAROUTE_SEGMENTS_FILE"] = "pilot/segments_sample.geojson"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

out = ROOT / "data" / "fixtures"
out.mkdir(parents=True, exist_ok=True)
with TestClient(create_app()) as c:
    c.post("/api/v1/scenario", json={"scenario": "heavy_rain", "now_offset_min": 210})
    (out / "risk_response.sample.json").write_text(json.dumps(c.get("/api/v1/risk").json(), indent=1))
    (out / "risk_detail.sample.json").write_text(json.dumps(c.get("/api/v1/risk/R-008").json(), indent=1))

    c.post("/api/v1/scenario", json={"scenario": "heavy_rain", "now_offset_min": 240})
    demo = c.get("/api/v1/route/demo-trip").json()
    route_res = c.post("/api/v1/route", json={"origin": demo["origin"], "destination": demo["destination"], "view": "peak"}).json()
    (out / "route_response.sample.json").write_text(json.dumps(route_res, indent=1))
print("fixtures written to", out)
