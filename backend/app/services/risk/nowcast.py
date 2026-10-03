"""Nowcasting: turn a single-moment model into a 0-3 hour forecast per segment.

For each 15-minute step across the next 180 minutes we re-evaluate rainfall
features and run the model. From that curve we derive: current risk, peak risk,
the HIGH-risk window, and a confidence score. Safety rules are applied here.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from .base import THRESH_HIGH, RainFeatures, ReportSignal, RiskBreakdown, RiskClass, RiskModel, SegmentStatic, classify
from .features import RainSeries, clamp, compute_rain_features

HORIZON_MIN = 180
STEP_MIN = 15
STEPS = tuple(range(0, HORIZON_MIN + 1, STEP_MIN))  # 0, 15, ..., 180

# Data-freshness thresholds (minutes of rainfall-data age)
AGING_MIN, STALE_MIN = 15.0, 60.0
STALE_CONFIDENCE_CAP = 0.4


@dataclass(frozen=True)
class Assessment:
    segment_id: str
    risk: float                        # at t+0
    risk_class: RiskClass
    peak_risk: float
    peak_class: RiskClass
    peak_in_min: int
    window: tuple[int, int] | None     # (start_min, end_min) of HIGH-or-worse risk
    confidence: float
    freshness_state: str               # fresh | aging | stale
    curve: tuple[tuple[int, float], ...]
    breakdown_now: RiskBreakdown
    breakdown_peak: RiskBreakdown
    verified_block: bool


def freshness_state(age_min: float) -> str:
    if age_min > STALE_MIN:
        return "stale"
    if age_min > AGING_MIN:
        return "aging"
    return "fresh"


def rain_steps(series: RainSeries, now_min: float, data_age_min: float) -> list[RainFeatures]:
    """Rain features for every nowcast step. Computed once, shared by all segments."""
    return [compute_rain_features(series, now_min + k, data_age_min if k == 0 else 0.0) for k in STEPS]


def find_window(curve: list[tuple[int, float]], threshold: float = THRESH_HIGH) -> tuple[int, int] | None:
    """First contiguous stretch where risk >= threshold. None if it never happens."""
    start = None
    for t, r in curve:
        if start is None and r >= threshold:
            start = t
        elif start is not None and r < threshold:
            return (start, t)
    return (start, HORIZON_MIN) if start is not None else None


def compute_confidence(static: SegmentStatic, data_age_min: float, signal: ReportSignal | None,
                       risk_now: float, window: tuple[int, int] | None) -> float:
    c = 0.85
    if data_age_min > AGING_MIN:
        c -= 0.15
    c -= 0.05 * len(static.missing_fields)
    if window is not None:
        c -= 0.15 * window[0] / HORIZON_MIN          # further-out forecasts are less certain
    if signal and signal.report_count > 0:
        if risk_now >= THRESH_HIGH:
            c += 0.08                                 # ground truth agrees with the model
        elif risk_now < 0.25:
            c -= 0.12                                 # reports contradict the model
    c = clamp(c, 0.05, 0.95)
    if data_age_min > STALE_MIN:
        c = min(c, STALE_CONFIDENCE_CAP)
    return c


def assess_segment(model: RiskModel, static: SegmentStatic, steps: list[RainFeatures],
                   signal: ReportSignal | None, data_age_min: float) -> Assessment:
    breakdowns: list[RiskBreakdown] = []
    for rf in steps:
        b = model.predict(static, rf, signal)
        # SAFETY RULE: a responder-verified blockage forces at least HIGH.
        if signal and signal.verified_block and b.risk < THRESH_HIGH:
            b = replace(b, risk=THRESH_HIGH,
                        contributions={**b.contributions, "verified_block": THRESH_HIGH - b.risk})
        breakdowns.append(b)

    curve = [(t, b.risk) for t, b in zip(STEPS, breakdowns, strict=True)]
    peak_idx = max(range(len(curve)), key=lambda i: (curve[i][1], -i))  # earliest max
    window = find_window(curve)
    risk_now = curve[0][1]

    return Assessment(
        segment_id=static.segment_id,
        risk=risk_now, risk_class=classify(risk_now),
        peak_risk=curve[peak_idx][1], peak_class=classify(curve[peak_idx][1]),
        peak_in_min=curve[peak_idx][0],
        window=window,
        confidence=compute_confidence(static, data_age_min, signal, risk_now, window),
        freshness_state=freshness_state(data_age_min),
        curve=tuple(curve),
        breakdown_now=breakdowns[0], breakdown_peak=breakdowns[peak_idx],
        verified_block=bool(signal and signal.verified_block),
    )
