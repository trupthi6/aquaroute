# API contract - Module 1 (Flood Risk Engine)

Base URL `http://localhost:8000`. Interactive docs at `/docs`. All JSON. Frontend mocks: `data/fixtures/`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/api/v1/risk` | GeoJSON FeatureCollection, one LineString per road segment |
| GET | `/api/v1/risk/{segment_id}` | One segment + 0-3 h forecast curve + factor breakdown + raw static features |
| GET | `/api/v1/scenario` | Active scenario, simulated clock, current rain intensity |
| POST | `/api/v1/scenario` | Body: `{scenario?, now_offset_min?, rain_data_age_min?}` |

## Feature properties (`/api/v1/risk`)

| Field | Meaning |
|---|---|
| `risk_probability` | 0-1 risk **index** at simulated now (uncalibrated) |
| `risk_level` | `LOW` / `MEDIUM` / `HIGH` (display tier; CRITICAL is folded into HIGH) |
| `risk_class` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` (routing removes CRITICAL in Module 3) |
| `confidence` | 0-1; lowered by stale data, missing features, distant forecast, contradicting reports |
| `peak_risk_probability`, `peak_risk_class`, `peak_risk_level`, `peak_in_min` | Worst case within the next 180 min |
| `expected_window` | `{start_min, end_min}` of HIGH-or-worse risk, or `null` if it never happens |
| `top_factors` | Up to 3 plain-language reasons (they explain the *peak*) |
| `verified_block` | True if a responder-verified blockage forced the class up (Module 5 sets this) |
| `data_freshness` | `{as_of, age_seconds, state: fresh|aging|stale}` - show it in the UI, always |

Thresholds on the index: `<0.25 LOW`, `<0.50 MEDIUM`, `<0.75 HIGH`, `>=0.75 CRITICAL`.

## Errors
`404` unknown segment. `422` unknown scenario or offset outside `0..duration_min` (offsets snap down to 5 min).
