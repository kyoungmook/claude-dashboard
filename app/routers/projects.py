from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import get_model_display_name, now_kst
from app.services.project_service import get_project_detail, get_project_stats
from app.services.session_service import get_model_display_names

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


@router.get("/{project_name}")
async def project_detail_view(request: Request, project_name: str):
    stats, sessions, tool_freq, daily_counts = get_project_detail(project_name)

    context = {
        "request": request,
        "page_title": f"프로젝트: {project_name}",
        "stats": stats,
        "sessions": sessions,
        "tool_freq": tool_freq,
        "daily_counts": daily_counts,
        "get_model_display_name": get_model_display_name,
        "get_model_display_names": get_model_display_names,
        "updated_at": now_kst(),
    }
    return templates.TemplateResponse("project_detail.html", context)
