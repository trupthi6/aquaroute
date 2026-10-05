# AquaRoute — Module 1–3 Acceptance Report

**Project:** AquaRoute — Urban Flood Nowcasting (SIH26085)
**Branch:** `feature/module-3-safe-routing`
**Report Date:** 2026-10-05
**Examiner:** Antigravity (automated + manual visual verification)

---

## 1. Repository Audit

| Artifact | Status | Notes |
|---|---|---|
| `tools/build_segments.py` | ✅ YES | 17 731 B |
| `tools/requirements.txt` | ✅ YES | present |
| `data/pilot/segments.geojson` | ✅ YES | 374 021 B — real OSM |
| `data/pilot/segments_sample.geojson` | ✅ YES | 20 991 B |
| `data/pilot/hotspots_seed.json` | ✅ YES | present |
| `data/fixtures/route_response.sample.json` | ✅ YES | present |
| `docs/routing.md` | ✅ YES | 4 095 B |
| `docs/data-sources.md` | ✅ YES | 4 256 B |
| `docs/api-contract.md` (route endpoints) | ✅ YES | 3 515 B |
| `docs/screenshots/` | ✅ YES | contains `phase1-real-roads.png` |
| `tools/run_all_checks.py` | ✅ YES | Phase 4 CI harness |
| `tools/acceptance_check.py` | ✅ YES | Phase 4 API tester |
| `frontend/e2e/` (Playwright) | ✅ YES | Phase 4 Playwright E2E |

---

## 2. Git Log

```
cc53588 feat(routing): add Module 3 safe-routing UI
3b5c4b9 feat(data): add real OSM road network and pilot dataset
5730f8d feat(map): add module 2 flood risk map
7fe5ec6 feat(risk): add module 1 flood risk engine
```

---

## 3. Backend Tests — `pytest -q`

```
......................................................
58 passed in 6.42s
```

| Test file | Result |
|---|---|
| `test_features.py` | ✅ PASS |
| `test_nowcast.py` | ✅ PASS |
| `test_risk_api.py` | ✅ PASS |
| `test_rule_model.py` | ✅ PASS |
| `test_routing_engine.py` | ✅ PASS |
| `test_routing_api.py` | ✅ PASS |

**58 passed, 0 failed, 0 skipped.**

---

## 4. Linter — `ruff check .`

```
All checks passed.
```

---

## 5. Frontend Build — `npm run build`

```
✓ TypeScript — no errors
✓ built in 4.31s
dist/manifest.webmanifest   ✓
dist/sw.js                  ✓
dist/index.html             ✓
```

---

## 6. Frontend Tests — `npm test`

```
Test Files  8 passed (8)
Tests       71 passed (71)
```

---

## 7. Runtime Servers

| Service | URL | Status |
|---|---|---|
| FastAPI backend | `http://localhost:8000` | ✅ RUNNING |
| Vite dev server | `http://localhost:5173` | ✅ RUNNING |

Backend access log (live, 2026-10-05):
```
INFO: 127.0.0.1 - "GET /api/v1/risk HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /api/v1/scenario HTTP/1.1" 200 OK
```

---

## 8. Module 1 — Risk Engine

| Criterion | Evidence |
|---|---|
| Risk API returns `segments[]` + `scenario` | ✅ `test_risk_api.py` passes |
| `rule_model.py` weights/thresholds unchanged | ✅ No diff; rules forbid modification |
| Scenarios: `normal`, `moderate_rain`, `heavy_rain`, `extreme_rain` | ✅ `test_nowcast.py` passes |
| Risk classes: LOW / MEDIUM / HIGH / CRITICAL | ✅ Confirmed in unit tests |

---

## 9. Module 2 — Flood Risk Map

| Criterion | Evidence |
|---|---|
| Leaflet map renders at `localhost:5173` | ✅ Browser screenshot captured |
| Road segments coloured by risk class | ✅ Green/amber/red/dark-red confirmed |
| NOW toggle activates live risk polling | ✅ Browser-verified with screenshot |
| STALE banner appears when data > 5 min old | ✅ Browser screenshot captured |
| Legend visible with correct colour key | ✅ Visually confirmed |

---

## 10. Module 3 — Safe Routing

### 10.1 API Endpoints

| Endpoint | Method | Expected | Actual |
|---|---|---|---|
| `/api/v1/route` | POST | 200, `status: "OK"` | ✅ PASS |
| `/api/v1/route` — bad segment | POST | 422 | ✅ PASS |
| `/api/v1/route/demo-trip` (normal/120) | GET | 404 | ✅ PASS |
| `/api/v1/route/demo-trip` (heavy_rain/240) | GET | 200 | ✅ PASS |

### 10.2 Route Engine Logic

| Criterion | Evidence |
|---|---|
| `safest.mean_risk < fastest.mean_risk` | ✅ Asserted `test_routing_api.py:144` |
| `recommendation: "SAFER_ROUTE"` | ✅ Asserted `test_routing_api.py:143` |
| Dijkstra engine builds graph from real OSM | ✅ `test_routing_engine.py` passes |
| Snap-to-node within 500 m | ✅ Unit-tested in engine |
| Risk formula unchanged from Module 1 | ✅ `cost.py` reads `risk_factor` only |

### 10.3 Frontend UI

| Criterion | Evidence |
|---|---|
| RoutePanel rendered in sidebar | ✅ Screenshot: `module3_route_panel` |
| Fastest route: dark grey dotted line | ✅ `RouteLayer.tsx` + browser screenshot |
| Safest route: solid blue + white casing | ✅ `RouteLayer.tsx` + browser screenshot |
| Comparison card: distance + mean risk | ✅ Screenshot: `demo_trip_comparison` |
| Demo Trip button pre-fills origin/dest | ✅ Browser-verified |

---

## 11. Scenario Distribution

| Scenario | Offset | HIGH/CRITICAL segs | demo-trip |
|---|---|---|---|
| `normal` | 120 min | None | 404 (expected) |
| `heavy_rain` | 240 min | Present (HIGH) | 200 + route OK |
| `extreme_rain` | 270 min | Present (CRITICAL) | — |

---

## 12. Data Sources

| Dataset | Source | File |
|---|---|---|
| Road network | OpenStreetMap — Bengaluru pilot (Agara-HSR) | `data/pilot/segments.geojson` |
| Hotspot seed | Manually curated from known flood zones | `data/pilot/hotspots_seed.json` |
| Elevation | SRTM 30 m via `build_segments.py` | Embedded in segment properties |

---

## 13. Open Items (non-blocking)

| 1 | `docs/acceptance_report.json` — machine-readable report |

---

## 14. Verdict

| Module | Result |
|---|---|
| **Module 1 — Risk Engine** | ✅ **ACCEPTED** |
| **Module 2 — Flood Risk Map** | ✅ **ACCEPTED** |
| **Module 3 — Safe Routing** | ✅ **ACCEPTED** |

**Overall: PASS — Modules 1, 2, and 3 are production-ready for the SIH26085 pilot.**
