import dataclasses

import pytest

from app.services.risk.base import RainFeatures, ReportSignal, SegmentStatic, classify
from app.services.risk.rule_model import RuleBasedModel

model = RuleBasedModel()


def seg(**kw):
    base = dict(segment_id="x", name="x", kind="road", lowness=0.5, depression=0.0, history=0.3,
                drain_deficit=0.4, water_proximity=0.0, drain_capacity_mm_hr=30.0)
    base.update(kw)
    return SegmentStatic(**base)


def rain(scale=1.0):
    return RainFeatures(intensity_mm_hr=50 * scale, rain_15_mm=12 * scale, rain_60_mm=40 * scale,
                        forecast_60_mm=40 * scale, cum_3h_mm=80 * scale)


UNDERPASS = seg(lowness=0.95, depression=1.0, history=0.9, drain_deficit=0.5, drain_capacity_mm_hr=22)
HIGH_ROAD = seg(lowness=0.0, depression=0.0, history=0.0, drain_deficit=0.0, drain_capacity_mm_hr=50)


def test_no_rain_means_no_risk():
    zero = RainFeatures(0, 0, 0, 0, 0)
    assert model.predict(UNDERPASS, zero).risk == 0.0


def test_underpass_riskier_than_high_road_under_same_rain():
    assert model.predict(UNDERPASS, rain()).risk > model.predict(HIGH_ROAD, rain()).risk + 0.2


def test_risk_is_monotonic_in_rainfall():
    for st in (UNDERPASS, HIGH_ROAD, seg()):
        risks = [model.predict(st, rain(s / 10)).risk for s in range(0, 25)]
        assert all(b >= a for a, b in zip(risks, risks[1:], strict=False))


def test_risk_always_between_0_and_1():
    for s in (0, 0.5, 1, 5, 50):
        r = model.predict(UNDERPASS, rain(s), ReportSignal(report_count=99)).risk
        assert 0.0 <= r <= 1.0


def test_drain_stress_only_when_rain_exceeds_capacity():
    st = seg(drain_capacity_mm_hr=40)
    below = RainFeatures(30, 0, 0, 0, 0)
    above = RainFeatures(80, 0, 0, 0, 0)
    assert model.predict(st, below).drain_stress == 0.0
    assert model.predict(st, above).drain_stress == 1.0


def test_stronger_drain_capacity_lowers_risk():
    weak, strong = seg(drain_capacity_mm_hr=20), seg(drain_capacity_mm_hr=50)
    assert model.predict(weak, rain()).risk > model.predict(strong, rain()).risk


def test_report_boost_is_capped():
    st = seg()
    r0 = model.predict(st, rain()).risk
    r2 = model.predict(st, rain(), ReportSignal(report_count=2)).risk
    r9 = model.predict(st, rain(), ReportSignal(report_count=9)).risk
    assert r0 < r2 < r9
    assert model.predict(st, rain(), ReportSignal(report_count=9)).report_boost == pytest.approx(0.15)


def test_classification_thresholds():
    assert [classify(x).value for x in (0.0, 0.249, 0.25, 0.499, 0.5, 0.749, 0.75, 1.0)] == \
        ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL", "CRITICAL"]


def test_contributions_sum_matches_unclamped_risk():
    b = model.predict(seg(), rain(0.5))
    assert sum(b.contributions.values()) == pytest.approx(b.risk)  # no clamping at this intensity


def test_dataclasses_frozen():
    with pytest.raises(dataclasses.FrozenInstanceError):
        UNDERPASS.lowness = 0.0  # type: ignore[misc]
