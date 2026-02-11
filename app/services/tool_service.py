from __future__ import annotations

from collections import Counter

from app.config import utc_to_kst
from app.services.cache import ttl_cache
from app.services.session_service import get_all_sessions


@ttl_cache(ttl_seconds=30)
def get_tool_usage_stats() -> list[dict]:
    sessions = get_all_sessions()
    tool_counter: Counter[str] = Counter()
    tool_sessions: dict[str, set[str]] = {}

    for s in sessions:
        session_tools: set[str] = set()
        for name in s.tool_names:
            tool_counter[name] += 1
            session_tools.add(name)
        for tool_name in session_tools:
            if tool_name not in tool_sessions:
                tool_sessions[tool_name] = set()
            tool_sessions[tool_name].add(s.session_id)

    results = []
    for tool_name, count in tool_counter.most_common():
        session_set = tool_sessions.get(tool_name, set())
        results.append({
            "name": tool_name,
            "call_count": count,
            "session_count": len(session_set),
            "avg_per_session": round(count / len(session_set), 1)
            if session_set
            else 0,
        })

    return results


@ttl_cache(ttl_seconds=30)
def get_tool_usage_by_session() -> list[dict]:
    sessions = get_all_sessions()
    results = []

    for s in sessions:
        if s.tool_calls_count > 0:
            results.append({
                "session_id": s.session_id,
                "project_name": s.project_name,
                "tool_calls_count": s.tool_calls_count,
                "date": utc_to_kst(s.first_timestamp, fmt="%Y-%m-%d") if s.first_timestamp else "",
            })

    results.sort(key=lambda x: x.get("date", ""), reverse=True)
    return results[:50]
