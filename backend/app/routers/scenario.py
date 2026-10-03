from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..models.risk import ScenarioState, ScenarioUpdate
from ..services.risk.features import compute_rain_features
from ..services.scenario import ScenarioError

router = APIRouter(prefix="/api/v1", tags=["scenario"])


def _state(request: Request) -> dict:
    p = request.app.state.player
    sc = p.current
    rf = compute_rain_features(sc.series, p.now_offset_min)
    return {
        "scenario": sc.name, "description": sc.description,
        "now_offset_min": p.now_offset_min, "duration_min": sc.series.duration_min,
        "step_minutes": sc.series.step_minutes, "simulated_now": p.simulated_now.isoformat(),
        "rain_data_age_min": p.data_age_min, "current_intensity_mm_hr": round(rf.intensity_mm_hr, 1),
        "available_scenarios": sorted(p.scenarios),
    }


@router.get("/scenario", response_model=ScenarioState, summary="Current simulated scenario and clock")
def get_scenario(request: Request):
    return _state(request)


@router.post("/scenario", response_model=ScenarioState,
             summary="Switch scenario / move the simulated clock (demo control panel)")
def set_scenario(body: ScenarioUpdate, request: Request):
    try:
        request.app.state.player.set(body.scenario, body.now_offset_min, body.rain_data_age_min)
    except ScenarioError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return _state(request)
