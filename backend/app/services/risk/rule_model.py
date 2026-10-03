"""Rule-based flood risk index (v1).

risk = clamp( rain_score * (0.35 + 0.65 * susceptibility)
              + 0.20 * drain_stress + report_boost )

* rain_score      - how much water is arriving (past hour, next hour, last 3 h)
* susceptibility  - how much THIS street collects water (terrain, history, drains)
* drain_stress    - rainfall intensity above drain capacity (rain-drainage coupling)

The weights are expert-set priors, NOT learned. The output is a 0..1 risk
INDEX, not a calibrated probability. Both facts are surfaced in the docs.
"""
from __future__ import annotations

from .base import RainFeatures, ReportSignal, RiskBreakdown, RiskModel, SegmentStatic
from .features import clamp

# Rain score blend and normalisation caps
W_RAIN_60, W_FORECAST_60, W_CUM_3H = 0.40, 0.30, 0.30
CAP_60_MM, CAP_3H_MM = 60.0, 120.0

# Susceptibility blend (sums to 1.0)
W_SUSCEPT = {"lowness": 0.30, "depression": 0.20, "history": 0.25,
             "drain_deficit": 0.15, "water_proximity": 0.10}

# Final combine
GATE_BASE, GATE_SUSCEPT = 0.35, 0.65
W_DRAIN_STRESS = 0.20
REPORT_STEP, REPORT_CAP = 0.05, 0.15


class RuleBasedModel(RiskModel):
    name = "rule_based_v1"

    def predict(self, static: SegmentStatic, rain: RainFeatures,
                signal: ReportSignal | None = None) -> RiskBreakdown:
        rain_score = clamp(
            W_RAIN_60 * clamp(rain.rain_60_mm / CAP_60_MM)
            + W_FORECAST_60 * clamp(rain.forecast_60_mm / CAP_60_MM)
            + W_CUM_3H * clamp(rain.cum_3h_mm / CAP_3H_MM)
        )

        parts = {k: w * getattr(static, k) for k, w in W_SUSCEPT.items()}
        susceptibility = sum(parts.values())

        drain_stress = clamp(rain.intensity_mm_hr / max(static.drain_capacity_mm_hr, 1.0) - 1.0)
        report_boost = min(REPORT_CAP, REPORT_STEP * signal.report_count) if signal else 0.0

        risk = clamp(rain_score * (GATE_BASE + GATE_SUSCEPT * susceptibility)
                     + W_DRAIN_STRESS * drain_stress + report_boost)

        # Additive attribution used by explain.py (before final clamping).
        contributions = {"rain_load": rain_score * GATE_BASE}
        contributions.update({k: rain_score * GATE_SUSCEPT * v for k, v in parts.items()})
        contributions["drain_stress"] = W_DRAIN_STRESS * drain_stress
        contributions["reports"] = report_boost

        return RiskBreakdown(risk=risk, rain_score=rain_score, susceptibility=susceptibility,
                             drain_stress=drain_stress, report_boost=report_boost,
                             contributions=contributions)
