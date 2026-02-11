from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.tool_service import get_tool_usage_by_session, get_tool_usage_stats

router = APIRouter(prefix="/tools")
templates = Jinja2Templates(directory="app/templates")


@router.get("")
async def tools_view(request: Request):
    tool_stats = get_tool_usage_stats()
    tool_by_session = get_tool_usage_by_session()

    context = {
        "request": request,
        "page_title": "도구 사용",
        "tool_stats": tool_stats,
        "tool_by_session": tool_by_session,
        "updated_at": now_kst(),
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/tools_content.html", context)
    return templates.TemplateResponse("tools.html", context)
