"""Regenerate data/fixtures/*.sample.json from the live engine (run after changing the contract).

Run from the repo root:  python tools/export_fixtures.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

out = ROOT / "data" / "fixtures"
out.mkdir(parents=True, exist_ok=True)
with TestClient(create_app()) as c:
    c.post("/api/v1/scenario", json={"scenario": "heavy_rain", "now_offset_min": 210})
    (out / "risk_response.sample.json").write_text(json.dumps(c.get("/api/v1/risk").json(), indent=1))
    (out / "risk_detail.sample.json").write_text(json.dumps(c.get("/api/v1/risk/R-008").json(), indent=1))
print("fixtures written to", out)
