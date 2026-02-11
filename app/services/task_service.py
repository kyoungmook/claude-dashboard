from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.config import CLAUDE_DIR, KST
from app.models.schemas import TaskItem, TaskList, Team, TeamMember
from app.services.cache import ttl_cache

TASKS_DIR = CLAUDE_DIR / "tasks"
TEAMS_DIR = CLAUDE_DIR / "teams"


def _parse_task_file(path: Path) -> TaskItem | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return TaskItem(
            id=str(data["id"]),
            subject=data.get("subject", ""),
            status=data.get("status", "pending"),
            description=data.get("description", ""),
            active_form=data.get("activeForm", ""),
            blocks=tuple(str(b) for b in data.get("blocks", [])),
            blocked_by=tuple(str(b) for b in data.get("blockedBy", [])),
        )
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


def _dir_mtime_kst(path: Path) -> str:
    try:
        ts = path.stat().st_mtime
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(KST)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except OSError:
        return ""


def _load_task_list(list_dir: Path) -> TaskList | None:
    task_files = sorted(list_dir.glob("*.json"), key=lambda p: p.stem)
    tasks = []
    for tf in task_files:
        item = _parse_task_file(tf)
        if item is not None:
            tasks.append(item)

    if not tasks:
        return None

    return TaskList(
        list_id=list_dir.name,
        tasks=tuple(tasks),
        last_modified=_dir_mtime_kst(list_dir),
    )


@ttl_cache(ttl_seconds=30)
def get_all_task_lists(tasks_dir: str | None = None) -> list[TaskList]:
    base = Path(tasks_dir) if tasks_dir else TASKS_DIR
    if not base.is_dir():
        return []

    results: list[TaskList] = []
    for child in base.iterdir():
        if not child.is_dir():
            continue
        tl = _load_task_list(child)
        if tl is not None:
            results.append(tl)

    results.sort(key=lambda t: t.last_modified, reverse=True)
    return results


@ttl_cache(ttl_seconds=30)
def get_active_teams(teams_dir: str | None = None) -> list[Team]:
    base = Path(teams_dir) if teams_dir else TEAMS_DIR
    if not base.is_dir():
        return []

    results: list[Team] = []
    for child in base.iterdir():
        if not child.is_dir():
            continue
        config_path = child / "config.json"
        if not config_path.is_file():
            continue
        try:
            data = json.loads(config_path.read_text(encoding="utf-8"))
            raw_members = data.get("members", [])
            members = tuple(
                TeamMember(
                    name=m.get("name", ""),
                    agent_id=m.get("agentId", ""),
                    agent_type=m.get("agentType", ""),
                )
                for m in raw_members
                if isinstance(m, dict)
            )
            results.append(Team(team_name=child.name, members=members))
        except (json.JSONDecodeError, OSError):
            continue

    return results
