from __future__ import annotations

from app.config import get_model_display_name, get_model_pricing, utc_to_kst
from app.models.schemas import TokenUsage
from app.services.cache import ttl_cache
from app.services.session_service import get_all_sessions


@ttl_cache(ttl_seconds=300)
def get_daily_token_breakdown() -> list[dict]:
    sessions = get_all_sessions()
    daily: dict[str, dict[str, int]] = {}

    for s in sessions:
        date = utc_to_kst(s.first_timestamp, fmt="%Y-%m-%d") if s.first_timestamp else ""
        if not date:
            continue
        if date not in daily:
            daily[date] = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
        daily[date]["input"] += s.total_usage.input_tokens
        daily[date]["output"] += s.total_usage.output_tokens
        daily[date]["cache_read"] += s.total_usage.cache_read_input_tokens
        daily[date]["cache_creation"] += s.total_usage.cache_creation_input_tokens

    return [
        {"date": date, **tokens}
        for date, tokens in sorted(daily.items())
    ]


@ttl_cache(ttl_seconds=300)
def get_model_cost_breakdown() -> list[dict]:
    sessions = get_all_sessions()
    model_totals: dict[str, dict[str, int]] = {}

    for s in sessions:
        for model in s.models_used:
            if model not in model_totals:
                model_totals[model] = {
                    "input": 0, "output": 0,
                    "cache_read": 0, "cache_creation": 0,
                }
            model_totals[model]["input"] += s.total_usage.input_tokens
            model_totals[model]["output"] += s.total_usage.output_tokens
            model_totals[model]["cache_read"] += s.total_usage.cache_read_input_tokens
            model_totals[model]["cache_creation"] += s.total_usage.cache_creation_input_tokens

    results = []
    for model_id, totals in sorted(model_totals.items()):
        pricing = get_model_pricing(model_id)
        cost = (
            totals["input"] / 1_000_000 * pricing["input"]
            + totals["output"] / 1_000_000 * pricing["output"]
            + totals["cache_read"] / 1_000_000 * pricing["cache_read"]
            + totals["cache_creation"] / 1_000_000 * pricing["cache_creation"]
        )
        results.append({
            "model_id": model_id,
            "display_name": get_model_display_name(model_id),
            "input_tokens": totals["input"],
            "output_tokens": totals["output"],
            "cache_read_tokens": totals["cache_read"],
            "cache_creation_tokens": totals["cache_creation"],
            "cost_usd": round(cost, 2),
        })

    return results


@ttl_cache(ttl_seconds=300)
def get_cache_efficiency() -> dict:
    sessions = get_all_sessions()
    total_cache_read = sum(s.total_usage.cache_read_input_tokens for s in sessions)
    total_cache_creation = sum(s.total_usage.cache_creation_input_tokens for s in sessions)
    total_input = sum(s.total_usage.input_tokens for s in sessions)
    total_all_input = total_input + total_cache_read + total_cache_creation

    efficiency_pct = (
        round(total_cache_read / total_all_input * 100, 1)
        if total_all_input > 0
        else 0.0
    )

    return {
        "cache_read_tokens": total_cache_read,
        "cache_creation_tokens": total_cache_creation,
        "direct_input_tokens": total_input,
        "total_input_tokens": total_all_input,
        "efficiency_pct": efficiency_pct,
    }


def calc_cost_for_usage(usage: TokenUsage, model_id: str) -> float:
    pricing = get_model_pricing(model_id)
    return round(
        usage.input_tokens / 1_000_000 * pricing["input"]
        + usage.output_tokens / 1_000_000 * pricing["output"]
        + usage.cache_read_input_tokens / 1_000_000 * pricing["cache_read"]
        + usage.cache_creation_input_tokens / 1_000_000 * pricing["cache_creation"],
        4,
    )
