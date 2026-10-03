"""Feature engineering: raw GeoJSON properties + rain series -> model inputs."""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from .base import RainFeatures, SegmentStatic


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


# ---------------------------------------------------------------- rainfall --
@dataclass(frozen=True)
class RainSeries:
    """Piecewise-constant rainfall intensity. Index i covers [i*step, (i+1)*step)
    minutes after `start`. Outside the series the rain is taken as zero."""
    start: datetime
    step_minutes: int
    intensity_mm_hr: tuple[float, ...]

    @property
    def duration_min(self) -> int:
        return self.step_minutes * len(self.intensity_mm_hr)

    def mm_between(self, t0: float, t1: float) -> float:
        """Rain depth (mm) accumulated between minute t0 and t1 (exact overlap)."""
        if t1 <= t0:
            return 0.0
        s, n = self.step_minutes, len(self.intensity_mm_hr)
        first = max(0, int(t0 // s))
        last = min(n - 1, int(math.ceil(t1 / s)) - 1)
        total = 0.0
        for i in range(first, last + 1):
            overlap = min(t1, (i + 1) * s) - max(t0, i * s)
            if overlap > 0:
                total += self.intensity_mm_hr[i] * overlap / 60.0
        return total


def compute_rain_features(series: RainSeries, t_min: float, data_age_min: float = 0.0) -> RainFeatures:
    """Evaluate rainfall features as if 'now' were minute `t_min` of the series.

    Past windows use observed rain; the forward window uses forecast rain.
    (In the simulator the forecast is the true future series; a real adapter
    would plug IMD/radar nowcasts in here.)
    """
    s = series.step_minutes
    return RainFeatures(
        intensity_mm_hr=series.mm_between(t_min - s, t_min) * 60.0 / s,
        rain_15_mm=series.mm_between(t_min - 15, t_min),
        rain_60_mm=series.mm_between(t_min - 60, t_min),
        forecast_60_mm=series.mm_between(t_min, t_min + 60),
        cum_3h_mm=series.mm_between(t_min - 180, t_min),
        data_age_min=data_age_min,
    )


# --------------------------------------------------------- static features --
DEFAULTS = {
    "elevation_m": None,           # handled separately (needs catchment min/max)
    "is_low_point": False,
    "history_score": 0.3,
    "drain_distance_m": 150.0,
    "drain_capacity_mm_hr": 30.0,
    "water_distance_m": 2000.0,
}


def _get(props: dict, key: str) -> float:
    """Property value, or the documented default when absent/null."""
    v = props.get(key)
    return DEFAULTS[key] if v is None else v


def build_static_features(features: list[dict]) -> dict[str, SegmentStatic]:
    """Normalise raw segment properties to 0..1 model features.

    `lowness` is *relative to this catchment* (min/max of loaded segments), so
    it needs the whole list. Missing properties fall back to defaults and are
    recorded in `missing_fields`, which lowers confidence downstream.
    """
    elevs = [f["properties"]["elevation_m"] for f in features
             if f["properties"].get("elevation_m") is not None]
    e_min, e_max = (min(elevs), max(elevs)) if elevs else (0.0, 0.0)

    out: dict[str, SegmentStatic] = {}
    for f in features:
        p = f["properties"]
        missing = [k for k in DEFAULTS if p.get(k) is None]

        elev = p.get("elevation_m")
        lowness = 0.5 if (elev is None or e_max == e_min) else (e_max - elev) / (e_max - e_min)

        d_dist = _get(p, "drain_distance_m")
        cap = _get(p, "drain_capacity_mm_hr")
        w_dist = _get(p, "water_distance_m")
        hist = _get(p, "history_score")

        sid = p["segment_id"]
        out[sid] = SegmentStatic(
            segment_id=sid,
            name=p.get("name", sid),
            kind=p.get("kind", "road"),
            lowness=clamp(lowness),
            depression=1.0 if p.get("is_low_point") else 0.0,
            history=clamp(hist),
            drain_deficit=clamp(0.5 * clamp(d_dist / 300.0) + 0.5 * (1.0 - clamp(cap / 50.0))),
            water_proximity=1.0 - clamp(w_dist / 500.0),
            drain_capacity_mm_hr=float(cap),
            missing_fields=tuple(missing),
            raw=dict(p),
        )
    return out
