from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..models.risk import RiskCollection, RiskDetailFeature
from ..services.risk.service import SegmentNotFound

router = APIRouter(prefix="/api/v1", tags=["risk"])


@router.get("/risk", response_model=RiskCollection, summary="Flood risk for every road segment (GeoJSON)")
def get_risk(request: Request):
    return request.app.state.risk_service.collection()


@router.get("/risk/{segment_id}", response_model=RiskDetailFeature,
            summary="One segment: 0-3 h forecast curve and factor breakdown")
def get_risk_detail(segment_id: str, request: Request):
    try:
        return request.app.state.risk_service.detail(segment_id)
    except SegmentNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown segment_id '{segment_id}'") from None
