"""Routing API endpoints for Module 3."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, Request

from ..models.route import DemoTripResponse, RouteRequest, RouteResponse

router = APIRouter(prefix="/api/v1/route", tags=["routing"])


@router.post("", response_model=RouteResponse)
def compute_route(req: RouteRequest, request: Request) -> RouteResponse:
    """Compute the fastest and flood-safe routes between origin and destination."""
    engine = request.app.state.route_engine
    return engine.route(req)


@router.get("/demo-trip", response_model=DemoTripResponse)
def get_demo_trip(
    request: Request,
    view: Literal["peak", "now"] = Query(default="peak", description="Scenario view: peak or now"),
) -> DemoTripResponse:
    """Return a deterministic origin/destination pair demonstrating safe flood detour."""
    engine = request.app.state.route_engine
    return engine.find_demo_trip(view=view)
