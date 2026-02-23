from __future__ import annotations

import asyncio
import json
from dataclasses import asdict

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.pixel_agents_service import get_active_agents

router = APIRouter(prefix="/pixel-office")
templates = Jinja2Templates(directory="app/templates")

POLL_INTERVAL_SECONDS = 3


@router.get("/stream")
async def pixel_office_stream() -> StreamingResponse:
    """SSE stream of active agent states for the pixel office."""

    async def event_generator():
        loop = asyncio.get_running_loop()
        previous_payload: str | None = None
        try:
            while True:
                agents = await loop.run_in_executor(None, get_active_agents)
                payload = json.dumps(
                    [asdict(a) for a in agents], ensure_ascii=False
                )
                if payload != previous_payload:
                    yield f"data: {payload}\n\n"
                    previous_payload = payload
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


@router.get("")
async def pixel_office_page(request: Request):
    agents = get_active_agents()
    context = {
        "request": request,
        "page_title": "오피스",
        "agents": [asdict(a) for a in agents],
        "updated_at": now_kst(),
    }
    # SSE 기반 실시간 업데이트 — HTMX 폴링 미사용
    return templates.TemplateResponse("pixel_office.html", context)
