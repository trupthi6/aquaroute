"""Runtime settings, read from environment variables (see backend/.env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]  # .../aquaroute


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    cors_origins: list[str]
    initial_scenario: str
    segments_file: str


def get_settings() -> Settings:
    return Settings(
        data_dir=Path(os.environ.get("AQUAROUTE_DATA_DIR", REPO_ROOT / "data")),
        cors_origins=[o.strip() for o in os.environ.get(
            "AQUAROUTE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()],
        initial_scenario=os.environ.get("AQUAROUTE_INITIAL_SCENARIO", "normal"),
        segments_file=os.environ.get("AQUAROUTE_SEGMENTS_FILE", "pilot/segments.geojson"),
    )
