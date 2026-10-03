# AquaRoute

AI-powered urban flood nowcasting, offline safe navigation and SOS coordination (SIH26085).

**Status:** Module 1 (Flood Risk Engine) complete. Modules 2-6 are not started.

## Run Module 1 (clean clone)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q                                             # expect: 38 passed
uvicorn app.main:app --reload                         # http://localhost:8000/docs
```

## 60-second demo of the risk engine

```bash
curl -X POST localhost:8000/api/v1/scenario -H "content-type: application/json" \
     -d '{"scenario":"heavy_rain","now_offset_min":180}'    # rain not here yet
curl localhost:8000/api/v1/risk/R-008                       # underpass: LOW now, HIGH expected in ~45 min
curl -X POST localhost:8000/api/v1/scenario -H "content-type: application/json" \
     -d '{"now_offset_min":240}'                            # fast-forward to the rain peak
curl localhost:8000/api/v1/risk                             # GeoJSON, underpass + approaches HIGH
```

Scenarios: `normal`, `moderate_rain`, `heavy_rain`, `extreme_rain` (stress test, yields CRITICAL).

## Known limitations (say these to judges before they ask)

- Sample data is **synthetic** (38 segments, 6x4 grid near Agara-HSR-Bellandur). Not survey data.
- Rainfall is **simulated**; the forecast equals the simulated future. A real IMD/radar adapter is future work.
- v1 is a transparent **rule-based index** with expert-set weights, not a trained model. `risk_probability` is an
  uncalibrated 0-1 index, not a statistical probability. Calibration needs recorded waterlogging events.
- Output is a **risk estimate for decision support**, not a guarantee.

## Layout

See `docs/api-contract.md` for the API. Regenerate sample data with `python tools/generate_sample_data.py` and
fixtures with `python tools/export_fixtures.py`.
