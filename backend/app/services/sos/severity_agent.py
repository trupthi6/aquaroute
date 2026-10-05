"""AI Severity Agent for accident severity scoring and emergency coordination."""
from __future__ import annotations

import math
from typing import List

from ...models.sos import (
    AccidentEvaluationRequest,
    AccidentEvaluationResponse,
    Coordinates,
    HospitalInfo,
    SeverityBreakdown,
)

# Reference emergency hospitals in Bengaluru pilot catchment (Agara/HSR/Bellandur)
PILOT_HOSPITALS = [
    HospitalInfo(
        id="HOSP-01",
        name="Sakra World Hospital",
        distance_km=1.8,
        address="SY NO 52/2 & 52/3, Devarabeesanahalli, Bellandur, Bengaluru",
        emergency_phone="+91 80 4969 4969",
        coordinates=Coordinates(lat=12.9279, lon=77.6836),
        trauma_care_level="Level 1",
        available_ambulances=3,
        estimated_arrival_min=6,
    ),
    HospitalInfo(
        id="HOSP-02",
        name="Manipal Hospital Sarjapur Road",
        distance_km=2.4,
        address="Sarjapur Main Road, Someshwara Nagar, Bengaluru",
        emergency_phone="+91 80 2502 4444",
        coordinates=Coordinates(lat=12.9165, lon=77.6712),
        trauma_care_level="Level 1",
        available_ambulances=4,
        estimated_arrival_min=8,
    ),
    HospitalInfo(
        id="HOSP-03",
        name="Apollo Clinic & Trauma Care HSR",
        distance_km=1.2,
        address="14th Main Rd, Sector 7, HSR Layout, Bengaluru",
        emergency_phone="+91 80 4666 4666",
        coordinates=Coordinates(lat=12.9115, lon=77.6385),
        trauma_care_level="Level 2",
        available_ambulances=2,
        estimated_arrival_min=5,
    ),
    HospitalInfo(
        id="HOSP-04",
        name="Narayana Multispeciality Hospital",
        distance_km=2.9,
        address="Near HSR Club, Sector 3, HSR Layout, Bengaluru",
        emergency_phone="+91 80 6750 6750",
        coordinates=Coordinates(lat=12.9082, lon=77.6492),
        trauma_care_level="Level 2",
        available_ambulances=2,
        estimated_arrival_min=9,
    ),
]


def calculate_distance_km(p1: Coordinates, p2: Coordinates) -> float:
    """Haversine distance calculation."""
    r = 6371.0
    lat1, lon1 = math.radians(p1.lat), math.radians(p1.lon)
    lat2, lon2 = math.radians(p2.lat), math.radians(p2.lon)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def get_nearby_hospitals(loc: Coordinates, limit: int = 4) -> List[HospitalInfo]:
    """Return hospitals sorted by distance to incident location."""
    result: List[HospitalInfo] = []
    for h in PILOT_HOSPITALS:
        dist = calculate_distance_km(loc, h.coordinates)
        # clone with updated relative distance
        updated = h.model_copy(update={
            "distance_km": dist,
            "estimated_arrival_min": max(3, int(dist * 3.5)),
        })
        result.append(updated)
    result.sort(key=lambda x: x.distance_km)
    return result[:limit]


class AISeverityAgent:
    """
    AI Severity Agent that computes the Accident Severity Score (0-100%).
    
    Evaluates:
    1. Sudden impact force (peak g-force)
    2. Device rotation & rollover (angular rate, tilt)
    3. Abnormal acceleration / jerk
    4. Vehicle speed before impact
    5. Post-impact inactivity duration (driver consciousness/incapacitation)
    """

    @classmethod
    def evaluate(cls, req: AccidentEvaluationRequest) -> AccidentEvaluationResponse:
        # Extract core features
        impact_g = req.impact_force_g
        rotation_deg_s = req.max_rotation_deg_s
        tilt_deg = req.tilt_angle_deg
        speed_kmh = req.pre_impact_speed_kmh
        inactivity_s = req.inactivity_seconds

        # If sensor reading was attached, incorporate its metrics if higher
        if req.reading:
            impact_g = max(impact_g, req.reading.total_g)
            rotation_deg_s = max(rotation_deg_s, req.reading.rotation_rate_deg_s)
            tilt_deg = max(tilt_deg, abs(req.reading.pitch_deg), abs(req.reading.roll_deg))
            speed_kmh = max(speed_kmh, req.reading.speed_kmh)
            inactivity_s = max(inactivity_s, req.reading.inactivity_seconds)

        # 1. Impact Force Score (0-100):
        # 1g = baseline (0)
        # 3g = minor (~30)
        # 5g = moderate (~65)
        # 8g+ = critical collision (90-100)
        if impact_g <= 1.2:
            impact_score = 0.0
        elif impact_g <= 3.0:
            impact_score = ((impact_g - 1.2) / 1.8) * 35.0
        elif impact_g <= 6.0:
            impact_score = 35.0 + ((impact_g - 3.0) / 3.0) * 35.0
        else:
            impact_score = min(100.0, 70.0 + ((impact_g - 6.0) / 4.0) * 30.0)

        # 2. Rotation & Rollover Score (0-100):
        # High angular rates (> 200 deg/s) or sustained tilt (> 60 deg) indicate rollover or violent spin
        spin_factor = min(100.0, (rotation_deg_s / 400.0) * 100.0)
        tilt_factor = min(100.0, (tilt_deg / 90.0) * 100.0)
        rotation_score = round(max(spin_factor * 0.7 + tilt_factor * 0.3, tilt_factor), 1)

        # 3. Abnormal Acceleration / Jerk Score (0-100):
        # Derived from rapid change relative to standard braking
        jerk_score = min(100.0, max(0.0, (impact_g / 7.0) * 100.0))

        # 4. Pre-impact Speed Score (0-100):
        # < 20 km/h: low kinetic energy
        # 20 - 50 km/h: moderate kinetic energy
        # 50 - 100+ km/h: severe collision potential
        if speed_kmh <= 10.0:
            speed_score = min(15.0, (speed_kmh / 10.0) * 15.0)
        elif speed_kmh <= 45.0:
            speed_score = 15.0 + ((speed_kmh - 10.0) / 35.0) * 40.0
        else:
            speed_score = min(100.0, 55.0 + ((speed_kmh - 45.0) / 45.0) * 45.0)

        # 5. Post-Impact Inactivity Score (0-100):
        # Prolonged stillness (> 5s) following a high impact suggests unconsciousness
        if inactivity_s <= 2.0:
            inactivity_score = 0.0
        elif inactivity_s <= 10.0:
            inactivity_score = ((inactivity_s - 2.0) / 8.0) * 60.0
        else:
            inactivity_score = min(100.0, 60.0 + ((inactivity_s - 10.0) / 15.0) * 40.0)

        # Weighted Ensemble:
        # Impact Force: 35%
        # Speed: 20%
        # Rotation: 15%
        # Jerk: 15%
        # Inactivity: 15%
        raw_score = (
            impact_score * 0.35 +
            speed_score * 0.20 +
            rotation_score * 0.15 +
            jerk_score * 0.15 +
            inactivity_score * 0.15
        )

        # Severe rollover multiplier: If rollover is detected with moderate impact, escalate score
        if tilt_deg > 65.0 and impact_g > 3.0:
            raw_score = max(raw_score, 72.0)

        severity_score = round(max(0.0, min(100.0, raw_score)), 1)

        # Classification based on spec:
        # 0-30 = Minor
        # 31-70 = Moderate
        # 71-100 = Critical
        if severity_score <= 30.0:
            severity_level = "Minor"
            trigger_sos = False
            rec_action = "Minor anomaly detected (hard braking or pothole). No emergency action required."
        elif severity_score <= 70.0:
            severity_level = "Moderate"
            trigger_sos = False  # Driver prompted with cancel timer before dispatch
            rec_action = "Moderate impact detected. Initiating 30s safety check timer with driver."
        else:
            severity_level = "Critical"
            trigger_sos = True  # Automatic SOS dispatch
            rec_action = "CRITICAL COLLISION CONFIRMED. Automatic SOS dispatch triggered immediately."

        breakdown = SeverityBreakdown(
            impact_score=round(impact_score, 1),
            rotation_score=round(rotation_score, 1),
            jerk_score=round(jerk_score, 1),
            speed_score=round(speed_score, 1),
            inactivity_score=round(inactivity_score, 1),
        )

        hospitals = get_nearby_hospitals(req.location)

        dispatch_log = [
            (
                f"Sensor telemetry evaluated: impact={impact_g:.1f}g, "
                f"rotation={rotation_deg_s:.1f}°/s, speed={speed_kmh:.1f}km/h"
            ),
            f"Severity score calculated: {severity_score:.1f}% -> Level: {severity_level.upper()}",
        ]
        if trigger_sos:
            dispatch_log.append(
                f"AUTOMATIC SOS TRIGGERED: Target coordinates ({req.location.lat:.4f}, {req.location.lon:.4f})"
            )
            if hospitals:
                dispatch_log.append(
                    f"Nearest trauma center notified: {hospitals[0].name} ({hospitals[0].distance_km} km)"
                )

        return AccidentEvaluationResponse(
            severity_score=severity_score,
            severity_level=severity_level,
            trigger_sos=trigger_sos,
            breakdown=breakdown,
            nearby_hospitals=hospitals,
            recommended_action=rec_action,
            dispatch_log=dispatch_log,
        )
