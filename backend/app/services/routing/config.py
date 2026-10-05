"""Routing engine configuration and cost model constants.

Documented in docs/routing.md so Module 4 (offline router) can replicate identically.
"""
from __future__ import annotations

# Speeds in km/h by road category / kind
SPEEDS_KMH: dict[str, float] = {
    "motorway": 30.0,
    "trunk": 30.0,
    "primary": 30.0,
    "secondary": 30.0,
    "motorway_link": 30.0,
    "trunk_link": 30.0,
    "primary_link": 30.0,
    "secondary_link": 30.0,
    "arterial": 30.0,
    "tertiary": 25.0,
    "tertiary_link": 25.0,
    "underpass": 25.0,
    "flyover": 35.0,
    "residential": 20.0,
    "unclassified": 20.0,
    "lakeside": 20.0,
    "default": 20.0,
}

# Cost model parameters
ALPHA: float = 6.0
BETA: float = 0.5
GAMMA: float = 0.3
HIGH_MULT: float = 4.0

# Snapping threshold
MAX_SNAP_DISTANCE_M: float = 500.0

# Recommendation threshold
RISK_DIFF_THRESHOLD: float = 0.10

# Risk class ranking
CLASS_ORDER: list[str] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
