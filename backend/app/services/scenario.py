"""Scenario player: the controllable 'simulated now' that makes the demo deterministic.

Holds which rain scenario is active, the simulated clock offset (minutes from
scenario start) and the age of the rainfall data (to demo stale-data handling).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from threading import Lock

from .risk.features import RainSeries


@dataclass(frozen=True)
class ScenarioDef:
    name: str
    description: str
    series: RainSeries
    default_now_offset_min: int
    default_data_age_min: float


class ScenarioError(ValueError):
    pass


class ScenarioPlayer:
    def __init__(self, scenarios: dict[str, ScenarioDef], initial: str = "normal"):
        if initial not in scenarios:
            initial = next(iter(scenarios))
        self.scenarios = scenarios
        self._lock = Lock()
        self._name = initial
        self._offset = scenarios[initial].default_now_offset_min
        self._age = scenarios[initial].default_data_age_min

    # -- read ---------------------------------------------------------------
    @property
    def current(self) -> ScenarioDef:
        return self.scenarios[self._name]

    @property
    def now_offset_min(self) -> int:
        return self._offset

    @property
    def data_age_min(self) -> float:
        return self._age

    @property
    def simulated_now(self) -> datetime:
        return self.current.series.start + timedelta(minutes=self._offset)

    def cache_key(self) -> tuple:
        return (self._name, self._offset, self._age)

    # -- write --------------------------------------------------------------
    def set(self, scenario: str | None = None, now_offset_min: int | None = None,
            rain_data_age_min: float | None = None) -> None:
        with self._lock:
            name = scenario or self._name
            if name not in self.scenarios:
                raise ScenarioError(f"Unknown scenario '{name}'. Available: {sorted(self.scenarios)}")
            sc = self.scenarios[name]
            switching = name != self._name

            if now_offset_min is None:
                offset = sc.default_now_offset_min if switching else self._offset
            else:
                offset = now_offset_min
            step = sc.series.step_minutes
            offset = (offset // step) * step  # snap to the data resolution
            if not 0 <= offset <= sc.series.duration_min:
                raise ScenarioError(f"now_offset_min must be within 0..{sc.series.duration_min}")

            if rain_data_age_min is None:
                age = sc.default_data_age_min if switching else self._age
            else:
                age = rain_data_age_min

            self._name, self._offset, self._age = name, offset, float(age)
