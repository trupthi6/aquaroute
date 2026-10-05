"""Edge travel time and flood risk cost evaluation."""
from __future__ import annotations

from .config import ALPHA, BETA, GAMMA, HIGH_MULT, SPEEDS_KMH


def get_speed_kmh(highway: str, kind: str) -> float:
    """Determine speed in km/h based on road kind and highway tag."""
    if kind == "flyover":
        return SPEEDS_KMH["flyover"]
    if kind == "underpass":
        return SPEEDS_KMH["underpass"]
    if kind == "arterial" or highway in (
        "motorway", "trunk", "primary", "secondary",
        "motorway_link", "trunk_link", "primary_link", "secondary_link",
    ):
        return SPEEDS_KMH["arterial"]
    if highway in ("tertiary", "tertiary_link"):
        return SPEEDS_KMH["tertiary"]
    if kind == "residential" or highway in ("residential", "unclassified"):
        return SPEEDS_KMH["residential"]
    return SPEEDS_KMH.get(highway, SPEEDS_KMH["default"])


def travel_time_seconds(length_m: float, speed_kmh: float) -> float:
    """Calculate base traversal time in seconds."""
    speed_ms = speed_kmh / 3.6
    if speed_ms <= 0:
        return 0.0
    return length_m / speed_ms


def compute_edge_factor(
    risk_probability: float,
    risk_class: str,
    lowness: float,
    drain_deficit: float,
) -> float:
    """Compute the cost penalty multiplier from flood risk and road vulnerability."""
    factor = 1.0 + risk_probability * (ALPHA + BETA * lowness + GAMMA * drain_deficit)
    if risk_class == "HIGH":
        factor *= HIGH_MULT
    return factor


def compute_safe_cost(
    travel_time_s: float,
    risk_probability: float,
    risk_class: str,
    lowness: float,
    drain_deficit: float,
    is_blocked: bool,
) -> float | None:
    """Return routing cost for the safe route, or None if the edge is not traversable."""
    if is_blocked or risk_class == "CRITICAL":
        return None
    factor = compute_edge_factor(risk_probability, risk_class, lowness, drain_deficit)
    return travel_time_s * factor


def compute_fastest_cost(travel_time_s: float, is_blocked: bool) -> float | None:
    """Return routing cost for the fastest route, or None if blocked."""
    if is_blocked:
        return None
    return travel_time_s
