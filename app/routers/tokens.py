from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.stats_service import get_overview_stats
from app.services.token_service import (
    get_cache_efficiency,
    get_daily_token_breakdown,
    get_model_cost_breakdown,
)

router = APIRouter(prefix="/tokens")
templates = Jinja2Templates(directory="app/templates")


@router.get("")
async def tokens_view(request: Request):
    overview_stats = get_overview_stats()
    daily_breakdown = get_daily_token_breakdown()
    model_costs = get_model_cost_breakdown()
    cache_efficiency = get_cache_efficiency()

    context = {
        "request": request,
        "page_title": "토큰 & 비용",
        "overview": overview_stats,
        "daily_breakdown": daily_breakdown,
        "model_costs": model_costs,
        "cache_efficiency": cache_efficiency,
        "updated_at": now_kst(),
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/tokens_content.html", context)
    return templates.TemplateResponse("tokens.html", context)
