"""Domain types shared by every part of the risk engine.

Keeping these in one dependency-free file means a future XGBoost model only has
to implement `RiskModel.predict` - nothing else in the system changes.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

# ---- Class thresholds (risk index 0..1) -----------------------------------
THRESH_MEDIUM = 0.25
THRESH_HIGH = 0.50
THRESH_CRITICAL = 0.75


class RiskClass(str, Enum):
    """4-tier class (frozen architecture). Routing removes CRITICAL segments."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskLevel(str, Enum):
    """3-tier level for simple display: CRITICAL is folded into HIGH."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


def classify(risk: float) -> RiskClass:
    if risk < THRESH_MEDIUM:
        return RiskClass.LOW
    if risk < THRESH_HIGH:
        return RiskClass.MEDIUM
    if risk < THRESH_CRITICAL:
        return RiskClass.HIGH
    return RiskClass.CRITICAL


def to_level(risk_class: RiskClass) -> RiskLevel:
    return RiskLevel.HIGH if risk_class is RiskClass.CRITICAL else RiskLevel(risk_class.value)


# ---- Inputs ---------------------------------------------------------------
@dataclass(frozen=True)
class SegmentStatic:
    """Time-invariant features of a road segment, all normalised to 0..1."""
    segment_id: str
    name: str
    kind: str
    lowness: float          # 1 = lowest point in the catchment, 0 = highest
    depression: float       # 1.0 if a known local low point / underpass
    history: float          # historical waterlogging score
    drain_deficit: float    # 1 = far from drains and/or low drain capacity
    water_proximity: float  # 1 = right next to a lake/canal
    drain_capacity_mm_hr: float
    missing_fields: tuple[str, ...] = ()
    raw: dict = field(default_factory=dict, compare=False)


@dataclass(frozen=True)
class RainFeatures:
    """Rainfall features evaluated at one moment (real 'now' or a future step)."""
    intensity_mm_hr: float
    rain_15_mm: float
    rain_60_mm: float
    forecast_60_mm: float
    cum_3h_mm: float
    data_age_min: float = 0.0


@dataclass(frozen=True)
class ReportSignal:
    """Citizen/responder signal for a segment. Filled by Module 5; empty for now."""
    report_count: int = 0
    verified_block: bool = False


# ---- Output of a single model evaluation ----------------------------------
@dataclass(frozen=True)
class RiskBreakdown:
    risk: float
    rain_score: float
    susceptibility: float
    drain_stress: float
    report_boost: float
    contributions: dict[str, float]  # additive terms used for explanations


class RiskModel(ABC):
    name: str = "base"

    @abstractmethod
    def predict(self, static: SegmentStatic, rain: RainFeatures,
                signal: ReportSignal | None = None) -> RiskBreakdown:
        """Return the risk index (0..1) for one segment at one moment."""
