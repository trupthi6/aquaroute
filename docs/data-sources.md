# AquaRoute Data Sources & Methodology

This document outlines the data sources, licensing, methodology, limitations, and regeneration procedures for AquaRoute (Smart India Hackathon, SIH26085).

---

## 1. Road Network Data

- **Source:** OpenStreetMap (OSM) contributors.
- **Licence:** Open Database Licence (ODbL) 1.0 (https://opendatacommons.org/licenses/odbl/).
- **Attribution:** "© OpenStreetMap contributors".
- **Acquisition Tool:** `osmnx` (version >= 2.0).
- **Corridor & Filter:**
  - Pilot Centre: 12.928° N, 77.655° E (Agara - HSR Layout - Bellandur corridor, Bengaluru, Karnataka).
  - Search Radius: 1300 m (selected dynamically to target 150–600 physical road segments).
  - Included Road Classes: `motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential`, `unclassified`, and associated link types.
  - Excluded Classes: service roads, tracks, footways, cycleways.
- **Topology Processing:**
  - Largest connected component extracted to guarantee reachability.
  - Bidirectional road pairs (`u->v` and `v->u`) merged into single physical road segments.
  - Attributes captured: `segment_id`, `name`, `highway`, `oneway`, `from_node`, `to_node`, `length_m`, and coordinate LineString geometry in WGS84 (`EPSG:4326`).

---

## 2. Elevation Data (DEM)

- **Source:** NASA Shuttle Radar Topography Mission (SRTM) 30m Global Elevation Model.
- **Service API:** OpenTopoData free REST API (`https://api.opentopodata.org/v1/srtm30m`) with fallback to Open-Elevation.
- **Methodology:** Node endpoint elevations are queried in rate-limited batches (100 points/call, >= 1.1s spacing) and cached locally in `.cache/elevation_cache.json`. Segment elevation is the arithmetic mean of its two terminal node elevations.
- **Known Limitations:**
  - SRTM is a digital surface model (DSM) with vertical accuracy of ~5–10 m.
  - Canopy, high-rise buildings, and bridge decks can artificially elevate radar return values.
  - Fine-grained street depression nuances below 30 m resolution are smoothed out.

---

## 3. Water Features & Proximity

- **Source:** OpenStreetMap (`natural=water`, `natural=wetland`, major waterways) around Agara Lake and Bellandur Lake.
- **Methodology:** Water polygon and line geometries are projected into UTM Zone 43N (`EPSG:32643`). The Euclidean distance from each segment midpoint to the nearest water boundary is computed in metres (`water_distance_m`).
- **Classification:** Segments within 150 m of open water bodies that are not flyovers or underpasses are categorized as `lakeside`.

---

## 4. Drainage Capacity & Waterlogging History (Documented Proxies)

> **Real-Data Honesty Notice:** No open, standardized municipal drainage GIS or sensor telemetry currently exists for Bengaluru storm drains. The values below are **reproducible, seeded (seed 42) engineering proxies**, not measured survey data.

- **Drainage Capacity (`drain_capacity_mm_hr`) & Distance (`drain_distance_m`):**
  - **Flyovers:** High deck drainage capacity (50–60 mm/hr), short drain runoffs (25–45 m).
  - **Arterial Roads:** Higher designed capacity (38–48 mm/hr), moderate runoff distances (70–140 m).
  - **Residential Streets:** Lower capacity (24–36 mm/hr), variable drain distance (90–200 m).
  - **Underpasses:** Constricted drainage (20–25 mm/hr), vulnerable catchments (160–220 m).
  - **Lakeside Roads:** Low hydraulic head differential (22–28 mm/hr), longer runoffs (200–300 m).
- **Historical Waterlogging Score (`history_score`):**
  - Calibrated between 0.0 (immune, e.g., elevated flyover decks) and 1.0 (chronic waterlogging hotspot).
  - When municipal hotspot ground truth is available, entries in `data/pilot/hotspots_seed.json` override the proxy.
  - Default proxy computes relative topographic lowness within the catchment and proximity to lake basins, adjusted for local depressions.

---

## 5. How to Regenerate Datasets

To regenerate the real pilot dataset:
```bash
python tools/build_segments.py --lat 12.928 --lon 77.655 --dist 1500 --out data/pilot/segments.geojson
```

To regenerate the deterministic sample test dataset:
```bash
python tools/generate_sample_data.py
```

To export fixtures and verify API contract parity:
```bash
python tools/export_fixtures.py
```
