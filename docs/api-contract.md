# API contract - Module 1 (Flood Risk Engine)

Base URL `http://localhost:8000`. Interactive docs at `/docs`. All JSON. Frontend mocks: `data/fixtures/`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/api/v1/risk` | GeoJSON FeatureCollection, one LineString per road segment |
| GET | `/api/v1/risk/{segment_id}` | One segment + 0-3 h forecast curve + factor breakdown + raw static features |
| GET | `/api/v1/scenario` | Active scenario, simulated clock, current rain intensity |
| POST | `/api/v1/scenario` | Body: `{scenario?, now_offset_min?, rain_data_age_min?}` |
| POST | `/api/v1/route` | Safe vs fastest route comparison with risk avoidance penalties |
| GET | `/api/v1/route/demo-trip` | Returns deterministic origin/destination pair demonstrating safe flood detour |

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

Collection metadata includes an additive `dataset` block: `{name, synthetic, source, notes}`.

## Routing (`/api/v1/route`)

### Request (`POST /api/v1/route`)
```json
{
  "origin": {"lat": 12.9215, "lon": 77.6400},
  "destination": {"lat": 12.9215, "lon": 77.6725},
  "view": "peak",
  "blocked_segment_ids": []
}
```

### Response (`RouteResponse`)
```json
{
  "status": "OK",
  "recommendation": "SAFER_ROUTE",
  "view": "peak",
  "origin": {"lat": 12.9215, "lon": 77.64, "snapped_lat": 12.9215, "snapped_lon": 77.64, "snap_distance_m": 0.0},
  "destination": {"lat": 12.9215, "lon": 77.6725, "snapped_lat": 12.9215, "snapped_lon": 77.6725, "snap_distance_m": 0.0},
  "fastest": {
    "segment_ids": ["R-006", "R-007", "R-008", "R-009", "R-010"],
    "geometry": {"type": "LineString", "coordinates": [[77.64, 12.9215], ...]},
    "distance_m": 3520,
    "duration_s": 422.4,
    "mean_risk": 0.45,
    "max_risk_class": "HIGH",
    "segments_at_risk": [{"segment_id": "R-008", "name": "Agara Underpass", "risk_class": "HIGH", "risk_probability": 0.70}],
    "cost": 422.4
  },
  "safest": { ... },
  "comparison": {
    "extra_time_s": 120.0,
    "extra_distance_m": 500,
    "high_risk_roads_avoided": 1,
    "critical_roads_avoided": 0,
    "mean_risk_reduction": 0.25
  },
  "reasons": ["Fastest route crosses Agara Underpass (HIGH, 70%)"],
  "warnings": [],
  "metadata": { ... }
}
```

## Errors
`404` unknown segment, or demo-trip when current scenario has no high-risk segments.
`422` invalid coordinates, origin/destination outside pilot catchment (>500m snap), origin and destination snap to the same node, unknown segment in blocked list, or unknown scenario.

