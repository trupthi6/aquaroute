"""Router for Module 4: Smart SOS System & Accident Detection."""
from __future__ import annotations

import datetime
import uuid
from typing import List

from fastapi import APIRouter, Query

from ..models.sos import (
    AccidentEvaluationRequest,
    AccidentEvaluationResponse,
    Coordinates,
    EmergencyContact,
    HospitalInfo,
    SOSTriggerRequest,
    SOSTriggerResponse,
)
from ..services.sos.severity_agent import AISeverityAgent, get_nearby_hospitals

router = APIRouter(prefix="/api/v1/sos", tags=["smart-sos"])

# Default emergency contacts for prototype simulation
DEFAULT_CONTACTS = [
    EmergencyContact(name="National Emergency Support (ERSS)", phone="112", relation="Emergency Police/Rescue"),
    EmergencyContact(name="Karnataka Ambulance Service", phone="108", relation="Trauma Care Dispatch"),
    EmergencyContact(name="Saved Emergency Contact (Asha Sharma)", phone="+91 98450 12345", relation="Next of Kin"),
]


@router.post("/evaluate", response_model=AccidentEvaluationResponse)
def evaluate_accident(req: AccidentEvaluationRequest) -> AccidentEvaluationResponse:
    """
    Evaluates smartphone sensor telemetry using the AI Severity Agent.
    Calculates an Accident Severity Score (0-100%) and triggers automatic SOS if critical.
    """
    return AISeverityAgent.evaluate(req)


@router.get("/hospitals", response_model=List[HospitalInfo])
def list_nearby_hospitals(
    lat: float = Query(12.928, ge=-90.0, le=90.0),
    lon: float = Query(77.655, ge=-180.0, le=180.0),
    limit: int = Query(4, ge=1, le=10),
) -> List[HospitalInfo]:
    """Returns nearest hospitals and trauma care centers in the pilot region."""
    return get_nearby_hospitals(Coordinates(lat=lat, lon=lon), limit=limit)


@router.post("/trigger", response_model=SOSTriggerResponse)
def trigger_sos(req: SOSTriggerRequest) -> SOSTriggerResponse:
    """
    Triggers simulated SOS alert dispatch to emergency services, hospitals, and saved contacts.
    """
    sos_id = f"SOS-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    contacts = req.contacts or DEFAULT_CONTACTS
    hospitals = get_nearby_hospitals(req.location, limit=2)
    nearest_hospital = hospitals[0] if hospitals else None

    # Construct simulated SMS alerts
    simulated_sms_sent = []
    google_maps_link = f"https://maps.google.com/?q={req.location.lat:.5f},{req.location.lon:.5f}"
    
    for c in contacts:
        msg = (
            f"EMERGENCY SOS ALERT [AquaRoute SafeNav]: "
            f"Severe incident ({req.severity_level}, score {req.severity_score:.0f}%) detected near "
            f"Bengaluru catchment. Location: {google_maps_link}. "
            f"Nearest hospital ({nearest_hospital.name if nearest_hospital else 'Sakra World Hospital'}) alerted."
        )
        simulated_sms_sent.append({
            "recipient_name": c.name,
            "recipient_phone": c.phone,
            "relation": c.relation,
            "status": "DELIVERED (SIMULATED)",
            "message": req.message_override or msg,
        })

    hospital_alert = {
        "hospital_id": nearest_hospital.id if nearest_hospital else "HOSP-01",
        "hospital_name": nearest_hospital.name if nearest_hospital else "Sakra World Hospital",
        "emergency_phone": nearest_hospital.emergency_phone if nearest_hospital else "+91 80 4969 4969",
        "distance_km": nearest_hospital.distance_km if nearest_hospital else 1.8,
        "eta_min": nearest_hospital.estimated_arrival_min if nearest_hospital else 6,
        "trauma_team_alerted": True,
        "dispatch_status": "AMBULANCE_DISPATCHED",
    }

    logs = [
        f"[{now_str}] SOS Event {sos_id} initiated ({'AUTO-DETECTED' if req.auto_detected else 'MANUAL TRIGGER'})",
        (
            f"[{now_str}] Coordinates: ({req.location.lat:.5f}, {req.location.lon:.5f}) | "
            f"Severity: {req.severity_score:.1f}% ({req.severity_level})"
        ),
        f"[{now_str}] Sent emergency dispatch payload to {len(simulated_sms_sent)} contacts via SMS gateway",
        f"[{now_str}] Trauma center {hospital_alert['hospital_name']} received automatic patient telemetry",
    ]

    return SOSTriggerResponse(
        sos_id=sos_id,
        status="DISPATCHED",
        timestamp=now_str,
        severity_level=req.severity_level,
        severity_score=req.severity_score,
        location=req.location,
        simulated_sms_sent=simulated_sms_sent,
        hospital_alert_sent=hospital_alert,
        logs=logs,
    )
