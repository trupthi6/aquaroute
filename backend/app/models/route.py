"""Pydantic schemas for the routing API (Module 3 contract)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .risk import Freshness, LineStringGeometry


class LatLng(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0, description="Latitude")
    lon: float = Field(ge=-180.0, le=180.0, description="Longitude")


class SnappedPoint(LatLng):
    snapped_lat: float
    snapped_lon: float
    snap_distance_m: float


class RouteRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    view: Literal["peak", "now"] = "peak"
    blocked_segment_ids: list[str] = Field(default_factory=list)


class SegmentAtRisk(BaseModel):
    segment_id: str
    name: str
    risk_class: str
    risk_probability: float


class Route(BaseModel):
    segment_ids: list[str]
    geometry: LineStringGeometry
    distance_m: int
    duration_s: float
    mean_risk: float
    max_risk_class: str
    segments_at_risk: list[SegmentAtRisk]
    cost: float


class RouteComparison(BaseModel):
    extra_time_s: float
    extra_distance_m: int
    high_risk_roads_avoided: int
    critical_roads_avoided: int
    mean_risk_reduction: float


class RouteMetadata(BaseModel):
    scenario: str
    simulated_now: str
    now_offset_min: int
    generated_at: str
    data_freshness: Freshness
    cost_model: dict[str, Any]


class RouteResponse(BaseModel):
    status: Literal["OK", "NO_SAFE_ROUTE"]
    recommendation: Literal["SAFER_ROUTE", "FASTEST_IS_SAFE", "NO_SAFE_ROUTE"]
    view: Literal["peak", "now"]
    origin: SnappedPoint
    destination: SnappedPoint
    fastest: Route
    safest: Route | None
    comparison: RouteComparison | None
    reasons: list[str]
    warnings: list[str]
    metadata: RouteMetadata


class DemoTripResponse(BaseModel):
    origin: LatLng
    destination: LatLng
    note: str
