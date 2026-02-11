from dataclasses import asdict

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.agent_service import (
    get_agent_analytics,
    get_agent_definitions,
    get_all_subagent_activities,
)

router = APIRouter(prefix="/agents")
templates = Jinja2Templates(directory="app/templates")


@router.get("")
async def agents_view(request: Request):
    definitions = get_agent_definitions()
    analytics = get_agent_analytics()
    activities = get_all_subagent_activities()

    total_invocations = sum(a.invocation_count for a in analytics)
    total_tokens = sum(a.total_input_tokens + a.total_output_tokens for a in analytics)

    chart_data = [
        {"name": a.agent_name, "count": a.invocation_count}
        for a in analytics
    ]

    tool_chart_data: dict[str, int] = {}
    for a in analytics:
        for tool_name, count in a.tool_counts:
            tool_chart_data[tool_name] = tool_chart_data.get(tool_name, 0) + count
    tool_chart_sorted = sorted(tool_chart_data.items(), key=lambda x: x[1], reverse=True)[:15]

    context = {
        "request": request,
        "page_title": "에이전트 분석",
        "definitions": definitions,
        "analytics": analytics,
        "recent_activities": activities[:20],
        "total_invocations": total_invocations,
        "total_tokens": total_tokens,
        "chart_data": chart_data,
        "tool_chart_data": [{"name": n, "count": c} for n, c in tool_chart_sorted],
        "updated_at": now_kst(),
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/agents_content.html", context)
    return templates.TemplateResponse("agents.html", context)
