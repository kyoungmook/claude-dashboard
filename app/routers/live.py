from __future__ import annotations

import asyncio
import json
from dataclasses import asdict

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates

from app.config import PROJECTS_DIR, now_kst
from app.services.file_watcher import FileWatcher

router = APIRouter(prefix="/live")
templates = Jinja2Templates(directory="app/templates")

POLL_INTERVAL_SECONDS = 3


@router.get("/stream")
async def live_stream() -> StreamingResponse:
    """SSE stream — tail -f style incremental read."""

    async def event_generator():
        watcher = FileWatcher(PROJECTS_DIR)
        watcher.init_at_end()
        loop = asyncio.get_running_loop()
        try:
            while True:
                events = await loop.run_in_executor(
                    None, watcher.scan_new_lines
                )
                if events:
                    for event in events:
                        payload = json.dumps(asdict(event), ensure_ascii=False)
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


@router.get("")
async def live_page(request: Request):
    context = {
        "request": request,
        "page_title": "라이브",
        "updated_at": now_kst(),
    }
    return templates.TemplateResponse("live.html", context)
