from dataclasses import asdict

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.stats_service import get_overview_stats

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
async def overview(request: Request):
    stats = get_overview_stats()
    daily_chart = [asdict(d) for d in stats.daily_activity]
    model_chart = [asdict(m) for m in stats.model_usage]

    context = {
        "request": request,
        "stats": stats,
        "daily_chart": daily_chart,
        "model_chart": model_chart,
        "updated_at": now_kst(),
        "page_title": "개요",
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/overview_content.html", context)
    return templates.TemplateResponse("overview.html", context)
