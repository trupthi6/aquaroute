"""Load and validate static data files at startup. Fails fast with clear messages."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from ..services.risk.features import RainSeries
from ..services.scenario import ScenarioDef


class DataError(RuntimeError):
    pass


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise DataError(f"Missing data file: {path}. Run `python tools/generate_sample_data.py`.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise DataError(f"{path} is not valid JSON: {e}") from e


def load_segments(path: Path) -> list[dict]:
    data = _read_json(path)
    if data.get("type") != "FeatureCollection" or not data.get("features"):
        raise DataError(f"{path.name}: expected a non-empty GeoJSON FeatureCollection")
    seen: set[str] = set()
    for i, f in enumerate(data["features"]):
        sid = (f.get("properties") or {}).get("segment_id")
        if not sid:
            raise DataError(f"{path.name}: feature #{i} has no properties.segment_id")
        if sid in seen:
            raise DataError(f"{path.name}: duplicate segment_id {sid}")
        seen.add(sid)
        if (f.get("geometry") or {}).get("type") != "LineString":
            raise DataError(f"{path.name}: segment {sid} must be a LineString")
    return data["features"]


def load_scenarios(path: Path) -> dict[str, ScenarioDef]:
    data = _read_json(path)
    try:
        start = datetime.fromisoformat(data["start"])
        step = int(data["step_minutes"])
        out = {}
        for name, sc in data["scenarios"].items():
            out[name] = ScenarioDef(
                name=name,
                description=sc.get("description", ""),
                series=RainSeries(start=start, step_minutes=step,
                                  intensity_mm_hr=tuple(float(x) for x in sc["intensity_mm_hr"])),
                default_now_offset_min=int(sc.get("default_now_offset_min", 0)),
                default_data_age_min=float(sc.get("rain_data_age_min", 1)),
            )
    except (KeyError, ValueError, TypeError) as e:
        raise DataError(f"{path.name}: malformed scenario file ({e!r})") from e
    if not out:
        raise DataError(f"{path.name}: no scenarios defined")
    return out
