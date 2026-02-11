import re

from fastapi import APIRouter, HTTPException, Request
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.agent_service import get_replay_events, get_team_sessions
from app.services.task_service import get_active_teams

router = APIRouter(prefix="/teams")
templates = Jinja2Templates(directory="app/templates")

_SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")


@router.get("")
async def teams_view(request: Request):
    active_teams = get_active_teams()
    team_sessions = get_team_sessions()

    context = {
        "request": request,
        "page_title": "팀 모니터",
        "active_teams": active_teams,
        "team_sessions": team_sessions[:30],
        "total_sessions": len(team_sessions),
        "updated_at": now_kst(),
    }

    if request.headers.get("HX-Request") and not request.query_params.get("full"):
        return templates.TemplateResponse("partials/teams_content.html", context)
    return templates.TemplateResponse("teams.html", context)


@router.get("/replay/{session_id}")
async def replay_view(request: Request, session_id: str):
    if not _SESSION_ID_PATTERN.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    events = get_replay_events(session_id)
    team_sessions = get_team_sessions()

    session_info = None
    for ts in team_sessions:
        if ts.session_id == session_id:
            session_info = ts
            break

    events_data = [
        {
            "timestamp": e.timestamp,
            "agent_id": e.agent_id,
            "agent_label": e.agent_label,
            "event_type": e.event_type,
            "content": e.content,
            "tool_name": e.tool_name,
            "model": e.model,
        }
        for e in events
    ]

    agent_ids = sorted(set(e.agent_id for e in events))
    agent_labels = {e.agent_id: e.agent_label for e in events}

    context = {
        "request": request,
        "page_title": "에이전트 리플레이",
        "session_id": session_id,
        "session_info": session_info,
        "events": events_data,
        "agent_ids": agent_ids,
        "agent_labels": agent_labels,
        "event_count": len(events),
        "updated_at": now_kst(),
    }

    return templates.TemplateResponse("replay.html", context)
