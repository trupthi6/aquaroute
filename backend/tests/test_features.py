from datetime import datetime

import pytest

from app.services.risk.features import RainSeries, build_static_features, compute_rain_features


def series(values, step=5):
    return RainSeries(start=datetime(2026, 1, 1), step_minutes=step, intensity_mm_hr=tuple(values))


def test_mm_between_constant_rain():
    s = series([60.0] * 12)  # 60 mm/hr for 60 min
    assert s.mm_between(0, 60) == pytest.approx(60.0)
    assert s.mm_between(0, 30) == pytest.approx(30.0)
    assert s.mm_between(2.5, 7.5) == pytest.approx(5.0)  # 5 min x 1 mm/min, spanning two cells


def test_mm_between_outside_series_is_zero():
    s = series([60.0] * 12)
    assert s.mm_between(-100, -10) == 0.0
    assert s.mm_between(100, 200) == 0.0
    assert s.mm_between(30, 30) == 0.0


def test_rain_features_split_past_and_forecast():
    s = series([0.0] * 12 + [30.0] * 12)  # dry first hour, 30 mm/hr second hour
    at_60 = compute_rain_features(s, 60)
    assert at_60.rain_60_mm == 0.0
    assert at_60.forecast_60_mm == pytest.approx(30.0)
    at_120 = compute_rain_features(s, 120)
    assert at_120.rain_60_mm == pytest.approx(30.0)
    assert at_120.forecast_60_mm == 0.0
    assert at_120.intensity_mm_hr == pytest.approx(30.0)


def feat(sid, **props):
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
            "properties": {"segment_id": sid, **props}}


def test_lowness_is_relative_to_catchment():
    out = build_static_features([feat("a", elevation_m=100), feat("b", elevation_m=105), feat("c", elevation_m=110)])
    assert out["a"].lowness == 1.0 and out["b"].lowness == 0.5 and out["c"].lowness == 0.0


def test_missing_fields_use_defaults_and_are_recorded():
    out = build_static_features([feat("a", elevation_m=100), feat("b", elevation_m=110)])
    a = out["a"]
    assert "history_score" in a.missing_fields and "drain_capacity_mm_hr" in a.missing_fields
    assert 0.0 <= a.history <= 1.0 and a.drain_capacity_mm_hr == 30.0


def test_all_normalised_features_in_unit_range(segments):
    for st in build_static_features(segments).values():
        for v in (st.lowness, st.depression, st.history, st.drain_deficit, st.water_proximity):
            assert 0.0 <= v <= 1.0
