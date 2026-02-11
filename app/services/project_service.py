from __future__ import annotations

from app.config import get_model_display_name, get_model_pricing
from app.models.schemas import ProjectStats, TokenUsage
from app.services.cache import ttl_cache
from app.services.session_service import get_all_sessions


@ttl_cache(ttl_seconds=300)
def get_project_stats() -> list[ProjectStats]:
    sessions = get_all_sessions()
    project_data: dict[str, dict] = {}

    for s in sessions:
        key = s.project_name
        if key not in project_data:
            project_data[key] = {
                "project_path": s.project_path,
                "project_name": s.project_name,
                "session_count": 0,
                "total_messages": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read": 0,
                "cache_creation": 0,
                "tool_calls_count": 0,
                "models": set(),
                "last_activity": "",
            }

        pd = project_data[key]
        pd["session_count"] += 1
        pd["total_messages"] += s.message_count
        pd["input_tokens"] += s.total_usage.input_tokens
        pd["output_tokens"] += s.total_usage.output_tokens
        pd["cache_read"] += s.total_usage.cache_read_input_tokens
        pd["cache_creation"] += s.total_usage.cache_creation_input_tokens
        pd["tool_calls_count"] += s.tool_calls_count
        pd["models"].update(s.models_used)
        if s.last_timestamp > pd["last_activity"]:
            pd["last_activity"] = s.last_timestamp

    results = []
    for _key, pd in project_data.items():
        usage = TokenUsage(
            input_tokens=pd["input_tokens"],
            output_tokens=pd["output_tokens"],
            cache_read_input_tokens=pd["cache_read"],
            cache_creation_input_tokens=pd["cache_creation"],
        )

        total_cost = 0.0
        for model_id in pd["models"]:
            pricing = get_model_pricing(model_id)
            total_cost += pd["input_tokens"] / 1_000_000 * pricing["input"]
            total_cost += pd["output_tokens"] / 1_000_000 * pricing["output"]
            total_cost += pd["cache_read"] / 1_000_000 * pricing["cache_read"]
            total_cost += pd["cache_creation"] / 1_000_000 * pricing["cache_creation"]
        if len(pd["models"]) > 1:
            total_cost /= len(pd["models"])

        results.append(
            ProjectStats(
                project_path=pd["project_path"],
                project_name=pd["project_name"],
                session_count=pd["session_count"],
                total_messages=pd["total_messages"],
                total_usage=usage,
                total_cost_usd=round(total_cost, 2),
                tool_calls_count=pd["tool_calls_count"],
                models_used=tuple(sorted(pd["models"])),
                last_activity=pd["last_activity"],
            )
        )

    results.sort(key=lambda p: p.last_activity, reverse=True)
    return results
