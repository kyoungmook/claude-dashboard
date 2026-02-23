from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from app.config import PROJECTS_DIR, utc_to_kst
from app.models.schemas import PixelAgentState
from app.services.cache import ttl_cache

ACTIVE_THRESHOLD_SECONDS = 300

_TAIL_BYTES = 4096

TOOL_STATE_MAP: dict[str, tuple[str, str]] = {
    "Read": ("reading", "파일 읽는 중..."),
    "Grep": ("reading", "코드 검색 중..."),
    "Glob": ("reading", "파일 탐색 중..."),
    "WebFetch": ("reading", "웹 페이지 읽는 중..."),
    "WebSearch": ("reading", "웹 검색 중..."),
    "Edit": ("typing", "코드 수정 중..."),
    "Write": ("typing", "파일 작성 중..."),
    "Bash": ("typing", "명령 실행 중..."),
    "AskUserQuestion": ("waiting", "사용자 입력 대기 중..."),
    "Task": ("typing", "서브에이전트 실행 중..."),
    "TaskCreate": ("typing", "태스크 생성 중..."),
    "SendMessage": ("typing", "메시지 전송 중..."),
    "EnterPlanMode": ("typing", "계획 수립 중..."),
    "NotebookEdit": ("typing", "노트북 수정 중..."),
}

_DEFAULT_STATE = ("typing", "도구 사용 중...")


def _project_name_from_dir(dir_name: str) -> str:
    name = dir_name.lstrip("-")
    home_encoded = str(Path.home()).strip("/").replace("/", "-")
    if name == home_encoded:
        return "~"
    if name.startswith(home_encoded + "-"):
        name = name[len(home_encoded) + 1 :]
    for prefix in ("Documents-work-", "Documents-"):
        if name.startswith(prefix):
            name = name[len(prefix) :]
            break
    return name or dir_name.lstrip("-")


def _find_active_jsonl_files(
    projects_dir: Path,
) -> list[tuple[Path, str, float]]:
    now = time.time()
    active: list[tuple[Path, str, float]] = []
    if not projects_dir.exists():
        return active
    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        project_name = _project_name_from_dir(project_dir.name)
        for jsonl_file in project_dir.glob("*.jsonl"):
            try:
                stat = jsonl_file.stat()
                if now - stat.st_mtime < ACTIVE_THRESHOLD_SECONDS:
                    active.append((jsonl_file, project_name, stat.st_mtime))
            except OSError:
                continue
    return active


def _detect_state_from_tail(
    file_path: Path,
) -> tuple[str, str, str]:
    try:
        file_size = file_path.stat().st_size
    except OSError:
        return ("idle", "", "")

    if file_size == 0:
        return ("idle", "", "")

    read_size = min(file_size, _TAIL_BYTES)
    offset = file_size - read_size

    try:
        with open(file_path, "rb") as f:
            f.seek(offset)
            data = f.read(read_size)
    except OSError:
        return ("idle", "", "")

    text = data.decode("utf-8", errors="replace")
    lines = text.strip().split("\n")

    if offset > 0 and lines:
        lines = lines[1:]

    last_record: dict[str, Any] | None = None
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
            if isinstance(record, dict) and "type" in record:
                last_record = record
                break
        except (json.JSONDecodeError, ValueError):
            continue

    if last_record is None:
        return ("idle", "", "")

    record_type = last_record.get("type", "")

    if record_type == "system":
        return ("idle", "", "")

    if record_type == "user":
        return ("typing", "", "응답 생성 중...")

    if record_type == "assistant":
        message = last_record.get("message", {})
        content = message.get("content", [])
        model = message.get("model", "")

        if isinstance(content, list):
            last_tool_name = ""
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    last_tool_name = block.get("name", "")

            if last_tool_name:
                state, status = TOOL_STATE_MAP.get(last_tool_name, _DEFAULT_STATE)
                return (state, last_tool_name, status)

        return ("typing", "", "생각 중...")

    return ("idle", "", "")


def _get_active_agents_impl(
    projects_dir: Path,
) -> tuple[PixelAgentState, ...]:
    active_files = _find_active_jsonl_files(projects_dir)
    active_files.sort(key=lambda x: x[0].stem)
    agents: list[PixelAgentState] = []

    for desk_index, (file_path, project_name, mtime) in enumerate(active_files):
        state, tool_name, tool_status = _detect_state_from_tail(file_path)
        session_id = file_path.stem
        last_activity = utc_to_kst(
            time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(mtime))
        )

        agents.append(
            PixelAgentState(
                agent_id=session_id,
                project_name=project_name,
                state=state,
                tool_name=tool_name,
                tool_status=tool_status,
                desk_index=desk_index,
                last_activity_ts=last_activity,
                session_id=session_id,
            )
        )

    return tuple(agents)


@ttl_cache(ttl_seconds=5)
def get_active_agents() -> tuple[PixelAgentState, ...]:
    return _get_active_agents_impl(PROJECTS_DIR)
