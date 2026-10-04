from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.data_loader import load_scenarios, load_segments
from app.main import create_app
from app.services.risk.service import RiskService
from app.services.scenario import ScenarioPlayer

DATA = Path(__file__).resolve().parents[2] / "data"
os.environ["AQUAROUTE_SEGMENTS_FILE"] = "pilot/segments_sample.geojson"


@pytest.fixture
def segments():
    return load_segments(DATA / "pilot" / "segments_sample.geojson")


@pytest.fixture
def scenarios():
    return load_scenarios(DATA / "scenarios" / "rain_scenarios.json")


@pytest.fixture
def service(segments, scenarios):
    return RiskService(segments, ScenarioPlayer(scenarios, initial="normal"))


@pytest.fixture
def client():
    with TestClient(create_app()) as c:  # `with` runs the lifespan (loads data)
        yield c
