from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import get_model_display_name, now_kst
from app.services.project_service import get_project_stats

router = APIRouter(prefix="/projects")
templates = Jinja2Templates(directory="app/templates")


@router.get("")
async def projects_view(request: Request):
    projects = get_project_stats()
    chart_data = [
        {"project_name": p.project_name, "session_count": p.session_count}
        for p in projects
    ]

    context = {
        "request": request,
        "page_title": "프로젝트",
        "projects": projects,
        "chart_data": chart_data,
        "updated_at": now_kst(),
        "get_model_display_name": get_model_display_name,
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/projects_content.html", context)
    return templates.TemplateResponse("projects.html", context)
