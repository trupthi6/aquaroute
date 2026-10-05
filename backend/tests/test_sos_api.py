"""Tests for Module 4: Smart SOS API & AI Severity Agent."""
from __future__ import annotations


def test_ai_severity_minor_anomaly(client):
    """Minor sensor fluctuation should yield severity 0-30 and not trigger auto SOS."""
    payload = {
        "impact_force_g": 1.5,
        "max_rotation_deg_s": 25.0,
        "tilt_angle_deg": 5.0,
        "pre_impact_speed_kmh": 25.0,
        "inactivity_seconds": 0.0,
        "location": {"lat": 12.928, "lon": 77.655},
    }
    res = client.post("/api/v1/sos/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["severity_level"] == "Minor"
    assert 0.0 <= data["severity_score"] <= 30.0
    assert data["trigger_sos"] is False
    assert len(data["nearby_hospitals"]) > 0
    assert data["breakdown"]["impact_score"] < 40.0


def test_ai_severity_moderate_collision(client):
    """Moderate collision (e.g. 4.5g impact, 40 km/h) should yield 31-70."""
    payload = {
        "impact_force_g": 4.5,
        "max_rotation_deg_s": 120.0,
        "tilt_angle_deg": 25.0,
        "pre_impact_speed_kmh": 45.0,
        "inactivity_seconds": 3.0,
        "location": {"lat": 12.928, "lon": 77.655},
    }
    res = client.post("/api/v1/sos/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["severity_level"] == "Moderate"
    assert 31.0 <= data["severity_score"] <= 70.0
    assert data["trigger_sos"] is False  # Moderate prompts driver before dispatch


def test_ai_severity_critical_rollover_crash(client):
    """Critical collision with high g-force, rollover tilt, and inactivity triggers SOS."""
    payload = {
        "impact_force_g": 8.5,
        "max_rotation_deg_s": 380.0,
        "tilt_angle_deg": 75.0,
        "pre_impact_speed_kmh": 70.0,
        "inactivity_seconds": 12.0,
        "location": {"lat": 12.928, "lon": 77.655},
    }
    res = client.post("/api/v1/sos/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["severity_level"] == "Critical"
    assert data["severity_score"] >= 71.0
    assert data["trigger_sos"] is True
    assert "CRITICAL COLLISION CONFIRMED" in data["recommended_action"]


def test_get_nearby_hospitals(client):
    """Returns pilot hospitals with distance and ETA calculated."""
    res = client.get("/api/v1/sos/hospitals?lat=12.928&lon=77.655&limit=3")
    assert res.status_code == 200
    hospitals = res.json()
    assert len(hospitals) == 3
    assert hospitals[0]["name"] != ""
    assert hospitals[0]["distance_km"] > 0
    assert hospitals[0]["emergency_phone"].startswith("+91")


def test_trigger_sos_dispatch(client):
    """POST /api/v1/sos/trigger simulates SMS alerts, hospital dispatch, and emergency logs."""
    payload = {
        "location": {"lat": 12.928, "lon": 77.655},
        "severity_score": 85.0,
        "severity_level": "Critical",
        "auto_detected": True,
        "incident_type": "Severe Rollover Collision",
    }
    res = client.post("/api/v1/sos/trigger", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DISPATCHED"
    assert data["sos_id"].startswith("SOS-")
    assert len(data["simulated_sms_sent"]) >= 3
    assert data["hospital_alert_sent"]["dispatch_status"] == "AMBULANCE_DISPATCHED"
    assert len(data["logs"]) >= 4
