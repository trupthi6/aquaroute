"""Pydantic schemas = the public API contract for Module 1 (see docs/api-contract.md)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from ..services.risk.base import RiskClass, RiskLevel


class Window(BaseModel):
    start_min: int = Field(description="Minutes from simulated now when risk first reaches HIGH")
    end_min: int = Field(description="Minutes from now when it falls back below HIGH (180 = beyond horizon)")


class Freshness(BaseModel):
    as_of: str
    age_seconds: int
    state: Literal["fresh", "aging", "stale"]


class RiskProperties(BaseModel):
    segment_id: str
    name: str
    kind: str
    # --- risk right now ---
    risk_probability: float = Field(ge=0, le=1, description="0..1 risk INDEX (uncalibrated)")
    risk_class: RiskClass
    risk_level: RiskLevel
    confidence: float = Field(ge=0, le=1)
    # --- worst case within the next 3 hours ---
    peak_risk_probability: float = Field(ge=0, le=1)
    peak_risk_class: RiskClass
    peak_risk_level: RiskLevel
    peak_in_min: int
    expected_window: Window | None
    top_factors: list[str]
    verified_block: bool
    data_freshness: Freshness


class CurvePoint(BaseModel):
    t_min: int
    risk_probability: float
    risk_class: RiskClass
    risk_level: RiskLevel


class FactorContribution(BaseModel):
    factor: str
    key: str
    contribution: float
    share: float


class RiskDetailProperties(RiskProperties):
    forecast_curve: list[CurvePoint]
    factor_contributions: list[FactorContribution]
    static_features: dict[str, Any]


class LineStringGeometry(BaseModel):
    type: Literal["LineString"]
    coordinates: list[list[float]]


class RiskFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: LineStringGeometry
    properties: RiskProperties


class RiskDetailFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: LineStringGeometry
    properties: RiskDetailProperties


class RiskCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    metadata: dict[str, Any]
    features: list[RiskFeature]


# ----------------------------------------------------------------- scenario --
class ScenarioState(BaseModel):
    scenario: str
    description: str
    now_offset_min: int
    duration_min: int
    step_minutes: int
    simulated_now: str
    rain_data_age_min: float
    current_intensity_mm_hr: float
    available_scenarios: list[str]


class ScenarioUpdate(BaseModel):
    scenario: str | None = Field(default=None, examples=["heavy_rain"])
    now_offset_min: int | None = Field(default=None, ge=0, examples=[180])
    rain_data_age_min: float | None = Field(default=None, ge=0, examples=[1])
