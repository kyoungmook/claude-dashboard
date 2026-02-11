from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import now_kst
from app.services.task_service import get_active_teams, get_all_task_lists

router = APIRouter(prefix="/tasks")
templates = Jinja2Templates(directory="app/templates")


@router.get("")
async def tasks_view(request: Request):
    task_lists = get_all_task_lists()
    active_teams = get_active_teams()

    context = {
        "request": request,
        "page_title": "태스크",
        "task_lists": task_lists,
        "active_teams": active_teams,
        "updated_at": now_kst(),
    }

    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/tasks_content.html", context)
    return templates.TemplateResponse("tasks.html", context)
