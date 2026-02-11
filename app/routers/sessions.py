from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.models.schemas import Message
from app.services.file_watcher import SingleFileWatcher
from app.services.session_service import (
    find_session_file,
    get_all_sessions,
    get_model_display_names,
    get_session_detail,
    search_sessions,
)

router = APIRouter(prefix="/sessions")
templates = Jinja2Templates(directory="app/templates")

PAGE_SIZE = 20
POLL_INTERVAL_SECONDS = 2


@router.get("")
async def session_list(
    request: Request,
    q: str = Query("", description="Search query"),
    page: int = Query(1, ge=1),
):
    sessions = search_sessions(q) if q else get_all_sessions()
    total = len(sessions)
    start = (page - 1) * PAGE_SIZE
    end = start + PAGE_SIZE
    page_sessions = sessions[start:end]
    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)

    context = {
        "request": request,
        "sessions": page_sessions,
        "page_title": "세션",
        "query": q,
        "page": page,
        "total_pages": total_pages,
        "total": total,
        "updated_at": now_kst(),
        "get_model_display_names": get_model_display_names,
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/sessions_content.html", context)
    return templates.TemplateResponse("sessions.html", context)


def _message_to_dict(msg: Message) -> dict[str, Any]:
    """Convert a Message to a JSON-serializable dict."""
    d = asdict(msg)
    return {**d, "tool_calls": [tc["name"] for tc in d.get("tool_calls", ())]}


@router.get("/{session_id}/stream")
async def session_stream(session_id: str) -> StreamingResponse:
    """SSE stream for a single session's new messages."""

    async def event_generator():
        file_path = find_session_file(session_id)
        if file_path is None:
            yield "data: {\"error\": \"session not found\"}\n\n"
            return

        watcher = SingleFileWatcher(file_path)
        watcher.init_at_end()
        loop = asyncio.get_running_loop()

        try:
            while True:
                messages = await loop.run_in_executor(
                    None, watcher.read_new_messages
                )
                if messages:
                    for msg in messages:
                        payload = json.dumps(
                            _message_to_dict(msg), ensure_ascii=False
                        )
                        yield f"data: {payload}\n\n"
                else:
                    yield ": heartbeat\n\n"
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{session_id}")
async def session_detail_view(request: Request, session_id: str):
    session, messages = get_session_detail(session_id)

    return templates.TemplateResponse(
        "session_detail.html",
        {
            "request": request,
            "session": session,
            "messages": messages,
            "page_title": f"세션: {session_id[:8]}..." if session else "찾을 수 없음",
            "get_model_display_names": get_model_display_names,
        },
    )
