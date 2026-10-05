"""Pydantic models for Module 5: Offline Resilience & Offline Package Caching."""
from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class OfflinePackageMetadata(BaseModel):
    version: str = "1.0.0"
    generated_at: str
    catchment: str = "Bengaluru (Agara-HSR-Bellandur)"
    bbox: List[float] = Field(..., description="[min_lon, min_lat, max_lon, max_lat]")
    total_segments: int
    package_size_kb: float
    description: str = "Offline navigation cache: OSM roads, flood-risk layers, evacuation routes & hospital POIs."


class OfflinePackageResponse(BaseModel):
    metadata: OfflinePackageMetadata
    segments_geojson: Dict[str, Any]
    current_risk: Dict[str, Any]
    key_safe_routes: List[Dict[str, Any]]
    emergency_hospitals: List[Dict[str, Any]]
