"""Plain-language explanations: 'why is this road red?'."""
from __future__ import annotations

from .base import RiskBreakdown

MIN_CONTRIBUTION = 0.02

LABELS = {
    "lowness": "Low elevation within the catchment",
    "depression": "Underpass / local low point collects water",
    "history": "Historical waterlogging hotspot",
    "drain_deficit": "Weak or distant drainage",
    "water_proximity": "Close to a lake or water body",
    "drain_stress": "Rainfall exceeds drain capacity",
    "reports": "Citizen reports nearby",
    "verified_block": "Responder-verified road blockage",
}


def _rain_label(rain_score: float) -> str:
    if rain_score >= 0.6:
        return "Intense recent / forecast rainfall"
    if rain_score >= 0.3:
        return "Moderate rainfall"
    return "Light rainfall"


def factor_contributions(b: RiskBreakdown) -> list[dict]:
    """All additive terms, largest first, with their share of the total."""
    total = sum(b.contributions.values()) or 1.0
    rows = []
    for key, val in b.contributions.items():
        label = _rain_label(b.rain_score) if key == "rain_load" else LABELS.get(key, key)
        rows.append({"factor": label, "key": key, "contribution": round(val, 3),
                     "share": round(val / total, 3)})
    return sorted(rows, key=lambda r: r["contribution"], reverse=True)


def top_factors(b: RiskBreakdown, n: int = 3) -> list[str]:
    rows = [r for r in factor_contributions(b) if r["contribution"] >= MIN_CONTRIBUTION]
    return [r["factor"] for r in rows[:n]] or ["No significant risk drivers"]
