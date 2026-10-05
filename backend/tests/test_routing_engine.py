import pytest

from app.services.routing.config import ALPHA, BETA, GAMMA, HIGH_MULT
from app.services.routing.cost import compute_edge_factor, compute_fastest_cost, compute_safe_cost, travel_time_seconds
from app.services.routing.graph import RouteGraph
from app.services.routing.snap import haversine_m


def test_haversine_accuracy():
    # Bengaluru coordinates: (12.928, 77.655) to (12.935, 77.665)
    d = haversine_m(12.928, 77.655, 12.935, 77.665)
        # Roughly ~1.3 km
    assert 1200 < d < 1400


def test_travel_time_calculation():
    # 1000m at 30 km/h: 30 km/h = 8.333 m/s -> 120 s
    t = travel_time_seconds(1000.0, 30.0)
    assert round(t, 1) == 120.0


@pytest.mark.parametrize("r,cls,lowness,deficit,expected_mult", [
    (0.0, "LOW", 0.0, 0.0, 1.0),
    (0.5, "MEDIUM", 0.0, 0.0, 1.0 + 0.5 * ALPHA),
    (0.5, "MEDIUM", 1.0, 0.0, 1.0 + 0.5 * (ALPHA + BETA)),
    (0.5, "MEDIUM", 0.0, 1.0, 1.0 + 0.5 * (ALPHA + GAMMA)),
    (0.5, "HIGH", 0.0, 0.0, (1.0 + 0.5 * ALPHA) * HIGH_MULT),
])
def test_edge_factor_parameterized(r, cls, lowness, deficit, expected_mult):
    f = compute_edge_factor(r, cls, lowness, deficit)
    assert abs(f - expected_mult) < 1e-5


def test_critical_and_blocked_edges_removed():
    tt = 100.0
    # CRITICAL removed from safe route
    assert compute_safe_cost(tt, 0.8, "CRITICAL", 0.5, 0.5, is_blocked=False) is None
    # Blocked removed from safe route
    assert compute_safe_cost(tt, 0.1, "LOW", 0.0, 0.0, is_blocked=True) is None
    # Blocked removed from fastest route
    assert compute_fastest_cost(tt, is_blocked=True) is None

    # CRITICAL still allowed in fastest route
    assert compute_fastest_cost(tt, is_blocked=False) == tt
    # LOW allowed in safe route
    cost = compute_safe_cost(tt, 0.1, "LOW", 0.0, 0.0, is_blocked=False)
    assert cost is not None and cost > tt


def test_graph_build(segments):
    graph = RouteGraph(segments)
    assert len(graph.nodes) > 0
    assert len(graph.G.edges) > 0
    # Snapping finds nearest node
    nid, slat, slon, dist = graph.snap(12.9215, 77.6400)
    assert nid == "N01"
    assert dist < 1.0
