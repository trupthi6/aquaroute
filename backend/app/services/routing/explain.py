"""Plain-language explanation and warning generation for routing decisions."""
from __future__ import annotations


def generate_reasons(
    fastest_at_risk: list[dict],
    safest_at_risk: list[dict] | None,
    recommendation: str,
) -> list[str]:
    """Generate user-facing reasons explaining why a safer route was suggested or why fastest is safe."""
    reasons: list[str] = []

    if recommendation == "SAFER_ROUTE":
        safest_ids = {s["segment_id"] for s in (safest_at_risk or [])}
        avoided = [s for s in fastest_at_risk if s["segment_id"] not in safest_ids]

        for s in avoided[:3]:
            pct = round(s["risk_probability"] * 100)
            reasons.append(f"Fastest route crosses {s['name']} ({s['risk_class']}, {pct}%)")

        if not reasons and fastest_at_risk:
            s = fastest_at_risk[0]
            pct = round(s["risk_probability"] * 100)
            reasons.append(f"Fastest route crosses {s['name']} ({s['risk_class']}, {pct}%)")

    elif recommendation == "FASTEST_IS_SAFE":
        reasons.append("Fastest route is safe with minimal flood risk.")

    elif recommendation == "NO_SAFE_ROUTE":
        if fastest_at_risk:
            s = fastest_at_risk[0]
            pct = round(s["risk_probability"] * 100)
            reasons.append(
                f"Fastest route crosses {s['name']} ({s['risk_class']}, {pct}%), but no safe alternative was found."
            )
        else:
            reasons.append("No safe route available avoiding flooded or blocked roads.")

    return reasons


def generate_warnings(
    status: str,
    data_freshness_state: str,
    fastest_duration_s: float,
    safest_duration_s: float | None,
) -> list[str]:
    """Compile situational alerts and routing warnings."""
    warnings: list[str] = []

    if data_freshness_state == "stale":
        warnings.append("Rain data is stale; flood risk estimates may be outdated.")
    elif data_freshness_state == "aging":
        warnings.append("Rain data is aging; approaching staleness threshold.")

    if status == "NO_SAFE_ROUTE":
        warnings.append("No safe route avoiding flood risks could be found; fastest route returned with warnings.")
    elif safest_duration_s is not None and fastest_duration_s > 0:
        if safest_duration_s > 2.0 * fastest_duration_s:
            warnings.append("Safer route requires a detour of more than 2x travel time.")

    return warnings
