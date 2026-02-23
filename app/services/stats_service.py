from __future__ import annotations

import json
from collections import Counter
from typing import Any

from app.config import STATS_CACHE_PATH, get_model_display_name, get_model_pricing
from app.models.schemas import DailyActivity, LongestSession, ModelUsageStats, OverviewStats
from app.services.cache import ttl_cache


def _load_stats_cache() -> dict[str, Any]:
    try:
        with open(STATS_CACHE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _supplement_daily_from_sessions(
    cache_daily: tuple[DailyActivity, ...],
) -> tuple[DailyActivity, ...]:
    """Add daily activity for dates not covered by stats-cache.json."""
    from app.services.session_service import get_all_sessions

    cache_dates = {d.date for d in cache_daily}
    last_cache_date = max(cache_dates) if cache_dates else ""

    sessions = get_all_sessions()
    daily_msgs: Counter[str] = Counter()
    daily_sessions: Counter[str] = Counter()
    daily_tools: Counter[str] = Counter()

    for s in sessions:
        date = s.first_timestamp[:10] if s.first_timestamp else ""
        if not date or date <= last_cache_date:
            continue
        daily_msgs[date] += s.message_count
        daily_sessions[date] += 1
        daily_tools[date] += s.tool_calls_count

    if not daily_msgs:
        return cache_daily

    extra = tuple(
        DailyActivity(
            date=date,
            message_count=daily_msgs[date],
            session_count=daily_sessions[date],
            tool_call_count=daily_tools[date],
        )
        for date in sorted(daily_msgs)
    )

    return cache_daily + extra


def _calc_model_cost(model_id: str, stats: dict[str, Any]) -> float:
    pricing = get_model_pricing(model_id)
    cost = 0.0
    cost += stats.get("inputTokens", 0) / 1_000_000 * pricing["input"]
    cost += stats.get("outputTokens", 0) / 1_000_000 * pricing["output"]
    cost += stats.get("cacheReadInputTokens", 0) / 1_000_000 * pricing["cache_read"]
    cost += stats.get("cacheCreationInputTokens", 0) / 1_000_000 * pricing["cache_creation"]
    return round(cost, 2)



@ttl_cache(ttl_seconds=300)
def get_overview_stats() -> OverviewStats:
    data = _load_stats_cache()
    if not data:
        return OverviewStats()

    cache_daily = tuple(
        DailyActivity(
            date=d["date"],
            message_count=d.get("messageCount", 0),
            session_count=d.get("sessionCount", 0),
            tool_call_count=d.get("toolCallCount", 0),
        )
        for d in data.get("dailyActivity", [])
    )
    daily_activity = _supplement_daily_from_sessions(cache_daily)

    model_usage_list = []
    total_cost = 0.0
    for model_id, stats in data.get("modelUsage", {}).items():
        cost = _calc_model_cost(model_id, stats)
        total_cost += cost
        model_usage_list.append(
            ModelUsageStats(
                model_id=model_id,
                display_name=get_model_display_name(model_id),
                input_tokens=stats.get("inputTokens", 0),
                output_tokens=stats.get("outputTokens", 0),
                cache_read_input_tokens=stats.get("cacheReadInputTokens", 0),
                cache_creation_input_tokens=stats.get("cacheCreationInputTokens", 0),
                cost_usd=cost,
            )
        )

    total_tool_calls = sum(d.tool_call_count for d in daily_activity)
    total_sessions = max(
        data.get("totalSessions", 0),
        sum(d.session_count for d in daily_activity),
    )
    total_messages = max(
        data.get("totalMessages", 0),
        sum(d.message_count for d in daily_activity),
    )

    longest_raw = data.get("longestSession", {})
    longest = LongestSession(
        session_id=longest_raw.get("sessionId", ""),
        duration_hours=round(longest_raw.get("duration", 0) / 3_600_000, 1),
        message_count=longest_raw.get("messageCount", 0),
    )

    return OverviewStats(
        total_sessions=total_sessions,
        total_messages=total_messages,
        total_tool_calls=total_tool_calls,
        first_session_date=data.get("firstSessionDate", ""),
        daily_activity=daily_activity,
        model_usage=tuple(model_usage_list),
        hour_counts=data.get("hourCounts", {}),
        total_cost_usd=round(total_cost, 2),
        longest_session=longest,
        avg_messages_per_session=round(total_messages / total_sessions, 1) if total_sessions else 0.0,
        active_days=len(daily_activity),
    )
