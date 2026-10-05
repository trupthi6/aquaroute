"""Tests for Module 5: Offline Package & Status API."""
from __future__ import annotations


def test_offline_status(client):
    """GET /api/v1/offline/status returns ready status and version."""
    res = client.get("/api/v1/offline/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["offline_routing_supported"] is True
    assert "Bengaluru" in data["catchment"]


def test_offline_package_download(client):
    """GET /api/v1/offline/package delivers segments, current risk, routes and hospital POIs."""
    res = client.get("/api/v1/offline/package")
    assert res.status_code == 200
    data = res.json()
    assert "metadata" in data
    assert data["metadata"]["total_segments"] > 0
    assert data["metadata"]["package_size_kb"] > 0
    assert "features" in data["segments_geojson"]
    assert "features" in data["current_risk"]
    assert len(data["emergency_hospitals"]) > 0
