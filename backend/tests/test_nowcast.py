"""Scenario-level behaviour on the real sample dataset (the blueprint's test scenarios)."""
from collections import Counter

from app.services.risk.base import ReportSignal, RiskClass

UNDERPASS, FLYOVER = "R-008", "R-012"


def test_normal_scenario_is_all_low(service):
    service.player.set("normal", 120)
    res = service.assess_all()
    assert Counter(a.risk_class for a in res.values()) == {RiskClass.LOW: len(res)}
    assert all(a.window is None for a in res.values())


def test_heavy_rain_underpass_beats_high_road(service):
    service.player.set("heavy_rain", 240)
    res = service.assess_all()
    assert res[UNDERPASS].risk > res[FLYOVER].risk + 0.3
    assert res[UNDERPASS].risk_class in (RiskClass.HIGH, RiskClass.CRITICAL)
    assert res[FLYOVER].risk_class in (RiskClass.LOW, RiskClass.MEDIUM)


def test_heavy_rain_does_not_flag_everything_high(service):
    service.player.set("heavy_rain", 240)
    levels = Counter(a.risk_class for a in service.assess_all().values())
    assert 0 < levels[RiskClass.HIGH] < len(service.assess_all()) / 2


def test_early_warning_before_rain_arrives(service):
    """At +180 min nothing is flooding yet, but the nowcast already predicts the underpass."""
    service.player.set("heavy_rain", 180)
    a = service.assess_all()[UNDERPASS]
    assert a.risk_class is RiskClass.LOW
    assert a.peak_class in (RiskClass.HIGH, RiskClass.CRITICAL)
    assert a.window is not None and a.window[0] > 0


def test_window_populated_for_risky_and_null_for_safe(service):
    service.player.set("heavy_rain", 180)
    res = service.assess_all()
    assert res[UNDERPASS].window is not None
    assert res[FLYOVER].window is None
    s, e = res[UNDERPASS].window
    assert 0 <= s <= e <= 180


def test_extreme_rain_produces_critical(service):
    service.player.set("extreme_rain", 240)
    assert service.assess_all()[UNDERPASS].risk_class is RiskClass.CRITICAL


def test_more_rain_never_lowers_risk_anywhere(service):
    service.player.set("moderate_rain", 240)
    moderate = {k: a.risk for k, a in service.assess_all().items()}
    service.player.set("heavy_rain", 240)
    heavy = {k: a.risk for k, a in service.assess_all().items()}
    assert all(heavy[k] >= moderate[k] for k in moderate)


def test_stale_data_lowers_confidence_and_flags(service):
    service.player.set("heavy_rain", 240, 1)
    fresh = service.assess_all()[UNDERPASS]
    service.player.set("heavy_rain", 240, 90)
    stale = service.assess_all()[UNDERPASS]
    assert fresh.freshness_state == "fresh" and stale.freshness_state == "stale"
    assert stale.confidence <= 0.4 < fresh.confidence
    assert stale.risk == fresh.risk  # staleness lowers trust, it does not change the estimate


def test_aging_data_state(service):
    service.player.set("heavy_rain", 240, 30)
    a = service.assess_all()[UNDERPASS]
    assert a.freshness_state == "aging" and 0.4 < a.confidence < 0.85


def test_verified_block_forces_at_least_high(service):
    service.player.set("normal", 120)
    service.reports_provider = lambda: {FLYOVER: ReportSignal(report_count=1, verified_block=True)}
    service.reports_version += 1
    a = service.assess_all()[FLYOVER]
    assert a.risk_class in (RiskClass.HIGH, RiskClass.CRITICAL) and a.verified_block
    assert a.window is not None and a.window[0] == 0
    assert "Responder-verified road blockage" in service.detail(FLYOVER)["properties"]["top_factors"]


def test_agreeing_reports_raise_and_contradicting_reports_lower_confidence(service):
    service.player.set("heavy_rain", 240)
    base = service.assess_all()[UNDERPASS].confidence
    service.reports_provider = lambda: {UNDERPASS: ReportSignal(report_count=2)}
    service.reports_version += 1
    assert service.assess_all()[UNDERPASS].confidence > base

    service.player.set("normal", 120)
    service.reports_provider = lambda: {FLYOVER: ReportSignal(report_count=2)}
    service.reports_version += 1
    low_base = 0.85
    assert service.assess_all()[FLYOVER].confidence < low_base
