"""RiskService: orchestrates features -> model -> nowcast -> explanation -> GeoJSON.

Results are cached for the current (scenario, offset, data-age, reports-version)
and recomputed only when one of those changes.
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from ..scenario import ScenarioPlayer
from .base import ReportSignal, RiskModel, classify, to_level
from .explain import factor_contributions, top_factors
from .features import build_static_features
from .nowcast import Assessment, assess_segment, rain_steps
from .rule_model import RuleBasedModel

ReportsProvider = Callable[[], dict[str, ReportSignal]]


class SegmentNotFound(KeyError):
    pass


class RiskService:
    def __init__(self, segment_features: list[dict], player: ScenarioPlayer,
                 model: RiskModel | None = None, reports_provider: ReportsProvider | None = None,
                 dataset_meta: dict | None = None):
        self._geo = {f["properties"]["segment_id"]: f for f in segment_features}
        self._static = build_static_features(segment_features)
        self.player = player
        self.model = model or RuleBasedModel()
        self.reports_provider: ReportsProvider = reports_provider or (lambda: {})
        self.reports_version = 0  # Module 5 bumps this when reports change
        self.dataset_meta = dataset_meta or {
            "name": "sample",
            "synthetic": True,
            "source": "Synthetic sample catchment for AquaRoute Module 1. Not real survey data.",
            "notes": "Synthetic sample catchment for AquaRoute Module 1. Not real survey data.",
        }
        self._cache_key: tuple | None = None
        self._cache: dict[str, Assessment] = {}

    def static_features(self) -> dict:
        return self._static

    # ---------------------------------------------------------------- core --
    def assess_all(self) -> dict[str, Assessment]:
        key = (*self.player.cache_key(), self.reports_version)
        if key == self._cache_key:
            return self._cache
        p = self.player
        steps = rain_steps(p.current.series, p.now_offset_min, p.data_age_min)
        signals = self.reports_provider()
        self._cache = {
            sid: assess_segment(self.model, st, steps, signals.get(sid), p.data_age_min)
            for sid, st in self._static.items()
        }
        self._cache_key = key
        return self._cache

    # ------------------------------------------------------------ builders --
    def _freshness(self, a: Assessment) -> dict:
        age = self.player.data_age_min
        as_of = self.player.simulated_now - timedelta(minutes=age)
        return {"as_of": as_of.isoformat(), "age_seconds": int(age * 60), "state": a.freshness_state}

    def _properties(self, a: Assessment) -> dict:
        st = self._static[a.segment_id]
        return {
            "segment_id": a.segment_id, "name": st.name, "kind": st.kind,
            "risk_probability": round(a.risk, 3),
            "risk_class": a.risk_class.value,
            "risk_level": to_level(a.risk_class).value,
            "confidence": round(a.confidence, 2),
            "peak_risk_probability": round(a.peak_risk, 3),
            "peak_risk_class": a.peak_class.value,
            "peak_risk_level": to_level(a.peak_class).value,
            "peak_in_min": a.peak_in_min,
            "expected_window": ({"start_min": a.window[0], "end_min": a.window[1]} if a.window else None),
            "top_factors": top_factors(a.breakdown_peak),
            "verified_block": a.verified_block,
            "data_freshness": self._freshness(a),
        }

    def collection(self) -> dict:
        results = self.assess_all()
        feats = [{"type": "Feature", "id": sid, "geometry": self._geo[sid]["geometry"],
                  "properties": self._properties(results[sid])} for sid in sorted(results)]
        now_levels = Counter(to_level(a.risk_class).value for a in results.values())
        peak_levels = Counter(to_level(a.peak_class).value for a in results.values())
        p = self.player
        return {
            "type": "FeatureCollection",
            "metadata": {
                "model": self.model.name,
                "scenario": p._name, "scenario_description": p.current.description,
                "simulated_now": p.simulated_now.isoformat(),
                "now_offset_min": p.now_offset_min,
                "horizon_min": 180,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "segment_count": len(feats),
                "summary_now": {k: now_levels.get(k, 0) for k in ("LOW", "MEDIUM", "HIGH")},
                "summary_peak": {k: peak_levels.get(k, 0) for k in ("LOW", "MEDIUM", "HIGH")},
                "disclaimer": "Risk estimate for decision support; an uncalibrated index, not a guarantee.",
                "dataset": self.dataset_meta,
            },
            "features": feats,
        }

    def detail(self, segment_id: str) -> dict:
        if segment_id not in self._static:
            raise SegmentNotFound(segment_id)
        a = self.assess_all()[segment_id]
        props = self._properties(a)
        props["forecast_curve"] = [
            {"t_min": t, "risk_probability": round(r, 3), "risk_class": classify(r).value,
             "risk_level": to_level(classify(r)).value} for t, r in a.curve]
        props["factor_contributions"] = factor_contributions(a.breakdown_peak)
        props["static_features"] = self._static[segment_id].raw
        return {"type": "Feature", "id": segment_id, "geometry": self._geo[segment_id]["geometry"],
                "properties": props}
