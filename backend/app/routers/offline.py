"""Router for Module 5: Offline Resilience & Offline Package Download."""
from __future__ import annotations

import datetime
import json

from fastapi import APIRouter, Request

from ..models.offline import OfflinePackageMetadata, OfflinePackageResponse
from ..services.sos.severity_agent import PILOT_HOSPITALS

router = APIRouter(prefix="/api/v1/offline", tags=["offline-resilience"])


@router.get("/status")
def offline_status():
    """Returns availability and version info for offline map and flood packages."""
    return {
        "status": "ready",
        "catchment": "Bengaluru (Agara-HSR-Bellandur)",
        "package_version": "1.0.0",
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "offline_routing_supported": True,
    }


@router.get("/package", response_model=OfflinePackageResponse)
def get_offline_package(request: Request) -> OfflinePackageResponse:
    """
    Simulates / delivers the complete offline download bundle:
    - Local OSM road network
    - Current flood risk layers
    - Safe route presets & Dijkstra graph data
    - Emergency hospital directory
    """
    risk_service = request.app.state.risk_service
    route_engine = request.app.state.route_engine

    # Get current risk collection
    risk_collection = risk_service.collection()

    # Pre-calculated evacuation / safe routes in pilot region
    key_routes = []
    try:
        # Sample demo trip route included in package
        from ..models.route import LatLng, RouteRequest
        sample_req = RouteRequest(
            origin=LatLng(lat=12.915, lon=77.6725),
            destination=LatLng(lat=12.9215, lon=77.6465),
            view="peak",
        )
        sample_res = route_engine.compute_route(sample_req)
        key_routes.append(sample_res.model_dump())
    except Exception:
        pass

    hospitals_data = [h.model_dump() for h in PILOT_HOSPITALS]

    # Package GeoJSON structure
    segments_geojson = {
        "type": "FeatureCollection",
        "features": list(risk_service._geo.values()),
    }

    raw_bytes = len(json.dumps(segments_geojson).encode("utf-8")) + len(json.dumps(risk_collection).encode("utf-8"))
    size_kb = round(raw_bytes / 1024.0, 1)

    meta = OfflinePackageMetadata(
        version="1.0.0",
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        catchment="Bengaluru (Agara-HSR-Bellandur)",
        bbox=[77.635, 12.905, 77.695, 12.945],
        total_segments=len(risk_service._geo),
        package_size_kb=size_kb,
        description="Offline navigation cache: OSM roads, flood-risk layers, evacuation routes & hospital POIs.",
    )

    return OfflinePackageResponse(
        metadata=meta,
        segments_geojson=segments_geojson,
        current_risk=risk_collection,
        key_safe_routes=key_routes,
        emergency_hospitals=hospitals_data,
    )
