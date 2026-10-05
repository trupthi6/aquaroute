"""Pydantic models for Module 4: Smart SOS System."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)


class SensorReading(BaseModel):
    timestamp_ms: int = Field(default_factory=lambda: int(__import__("time").time() * 1000))
    accel_x: float = 0.0  # m/s^2
    accel_y: float = 0.0  # m/s^2
    accel_z: float = 9.8  # m/s^2 (includes gravity)
    total_g: float = 1.0  # g-force
    gyro_alpha: float = 0.0  # deg/s yaw
    gyro_beta: float = 0.0   # deg/s pitch
    gyro_gamma: float = 0.0  # deg/s roll
    rotation_rate_deg_s: float = 0.0
    pitch_deg: float = 0.0
    roll_deg: float = 0.0
    speed_kmh: float = 0.0
    inactivity_seconds: float = 0.0


class SeverityBreakdown(BaseModel):
    impact_score: float = Field(..., ge=0.0, le=100.0, description="Score based on peak g-force")
    rotation_score: float = Field(..., ge=0.0, le=100.0, description="Score based on angular velocity & rollover tilt")
    jerk_score: float = Field(..., ge=0.0, le=100.0, description="Score based on rate of change of acceleration")
    speed_score: float = Field(..., ge=0.0, le=100.0, description="Score based on pre-impact vehicle speed")
    inactivity_score: float = Field(..., ge=0.0, le=100.0, description="Score based on post-impact driver immobility")


class HospitalInfo(BaseModel):
    id: str
    name: str
    distance_km: float
    address: str
    emergency_phone: str
    coordinates: Coordinates
    trauma_care_level: Literal["Level 1", "Level 2", "Level 3"]
    available_ambulances: int = 2
    estimated_arrival_min: int = 8


class AccidentEvaluationRequest(BaseModel):
    reading: Optional[SensorReading] = None
    impact_force_g: float = Field(1.0, description="Peak impact force in Gs")
    max_rotation_deg_s: float = Field(0.0, description="Peak angular velocity in deg/s")
    tilt_angle_deg: float = Field(0.0, description="Tilt from normal upright orientation")
    pre_impact_speed_kmh: float = Field(0.0, description="Vehicle velocity before impact in km/h")
    inactivity_seconds: float = Field(0.0, description="Post-impact stationary inactivity in seconds")
    location: Coordinates = Field(default_factory=lambda: Coordinates(lat=12.928, lon=77.655))


class AccidentEvaluationResponse(BaseModel):
    severity_score: float = Field(..., ge=0.0, le=100.0)
    severity_level: Literal["Minor", "Moderate", "Critical"]
    trigger_sos: bool
    breakdown: SeverityBreakdown
    nearby_hospitals: List[HospitalInfo]
    recommended_action: str
    dispatch_log: List[str]


class EmergencyContact(BaseModel):
    name: str
    phone: str
    relation: str = "Emergency Contact"


class SOSTriggerRequest(BaseModel):
    location: Coordinates
    severity_score: float
    severity_level: Literal["Minor", "Moderate", "Critical"]
    contacts: Optional[List[EmergencyContact]] = None
    auto_detected: bool = True
    incident_type: str = "Vehicle Collision"
    message_override: Optional[str] = None


class SOSTriggerResponse(BaseModel):
    sos_id: str
    status: Literal["DISPATCHED", "PENDING", "CANCELLED"]
    timestamp: str
    severity_level: str
    severity_score: float
    location: Coordinates
    simulated_sms_sent: List[dict]
    hospital_alert_sent: dict
    logs: List[str]
