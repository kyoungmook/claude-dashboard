from __future__ import annotations

import re
from pathlib import Path

from app.config import PROJECTS_DIR, get_model_display_name
from app.models.schemas import Message, SessionInfo, TokenUsage
from app.services.cache import ttl_cache
from app.services.log_parser import parse_session_full

_HOME_DIR_ENCODED = str(Path.home()).strip("/").replace("/", "-")

_file_cache: dict[str, tuple[float, SessionInfo]] = {}


def _project_name_from_path(project_dir_name: str) -> str:
    name = project_dir_name.lstrip("-")
    if name == _HOME_DIR_ENCODED:
        return "~"
    if name.startswith(_HOME_DIR_ENCODED + "-"):
        name = name[len(_HOME_DIR_ENCODED) + 1:]
    for prefix in ("Documents-work-", "Documents-"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name or project_dir_name.lstrip("-")


def _project_display_path(project_dir_name: str) -> str:
    name = project_dir_name.lstrip("-")
    if name == _HOME_DIR_ENCODED:
        return "~"
    if name.startswith(_HOME_DIR_ENCODED + "-"):
        return "~/" + name[len(_HOME_DIR_ENCODED) + 1:]
    return name


def _aggregate_usage(messages: list[Message]) -> TokenUsage:
    total_input = sum(m.usage.input_tokens for m in messages)
    total_output = sum(m.usage.output_tokens for m in messages)
    total_cache_read = sum(m.usage.cache_read_input_tokens for m in messages)
    total_cache_creation = sum(m.usage.cache_creation_input_tokens for m in messages)
    return TokenUsage(
        input_tokens=total_input,
        output_tokens=total_output,
        cache_read_input_tokens=total_cache_read,
        cache_creation_input_tokens=total_cache_creation,
    )


def _collect_models(messages: list[Message]) -> tuple[str, ...]:
    models = set()
    for m in messages:
        if m.model:
            models.add(m.model)
    return tuple(sorted(models))


def _count_tool_calls(messages: list[Message]) -> int:
    return sum(len(m.tool_calls) for m in messages)


def _collect_tool_names(messages: list[Message]) -> tuple[str, ...]:
    names: list[str] = []
    for m in messages:
        for tc in m.tool_calls:
            names.append(tc.name)
    return tuple(names)


def _build_session_info(
    jsonl_path: Path,
    project_dir_name: str,
    messages: list[Message],
    metadata: dict,
) -> SessionInfo:
    timestamps = [m.timestamp for m in messages if m.timestamp]
    first_ts = min(timestamps) if timestamps else ""
    last_ts = max(timestamps) if timestamps else ""

    return SessionInfo(
        session_id=metadata.get("session_id", jsonl_path.stem),
        project_path=_project_display_path(project_dir_name),
        project_name=_project_name_from_path(project_dir_name),
        file_path=str(jsonl_path),
        first_timestamp=first_ts,
        last_timestamp=last_ts,
        message_count=len([m for m in messages if not m.is_meta]),
        total_usage=_aggregate_usage(messages),
        models_used=_collect_models(messages),
        tool_calls_count=_count_tool_calls(messages),
        tool_names=_collect_tool_names(messages),
        git_branch=metadata.get("git_branch", ""),
        version=metadata.get("version", ""),
    )


@ttl_cache(ttl_seconds=30)
def get_all_sessions() -> list[SessionInfo]:
    sessions: list[SessionInfo] = []
    if not PROJECTS_DIR.exists():
        return sessions

    seen_keys: set[str] = set()

    for project_dir in sorted(PROJECTS_DIR.iterdir()):
        if not project_dir.is_dir():
            continue
        project_dir_name = project_dir.name

        for jsonl_file in sorted(project_dir.glob("*.jsonl")):
            try:
                stat = jsonl_file.stat()
                if stat.st_size < 100:
                    continue

                key = str(jsonl_file)
                seen_keys.add(key)
                cached = _file_cache.get(key)
                if cached and cached[0] == stat.st_mtime:
                    sessions.append(cached[1])
                    continue

                metadata, messages = parse_session_full(jsonl_file)
                if not messages:
                    continue
                session = _build_session_info(
                    jsonl_file, project_dir_name, messages, metadata
                )
                _file_cache[key] = (stat.st_mtime, session)
                sessions.append(session)
            except Exception:
                continue

    for stale_key in set(_file_cache.keys()) - seen_keys:
        del _file_cache[stale_key]

    sessions.sort(key=lambda s: s.last_timestamp, reverse=True)
    return sessions


def get_session_detail(session_id: str) -> tuple[SessionInfo | None, list[Message]]:
    if not session_id or not _SESSION_ID_RE.match(session_id):
        return None, []
    if not PROJECTS_DIR.exists():
        return None, []

    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        for jsonl_file in project_dir.glob("*.jsonl"):
            if session_id in jsonl_file.stem:
                metadata, messages = parse_session_full(jsonl_file)
                if not messages:
                    continue
                session = _build_session_info(
                    jsonl_file, project_dir.name, messages, metadata
                )
                visible_messages = [m for m in messages if not m.is_meta]
                return session, visible_messages

    return None, []


_SESSION_ID_RE = re.compile(r"^[a-f0-9\-]{8,}$")


def find_session_file(session_id: str) -> Path | None:
    """Return the JSONL file path for a given session_id, or None."""
    if not session_id or not _SESSION_ID_RE.match(session_id):
        return None
    if not PROJECTS_DIR.exists():
        return None
    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        for jsonl_file in project_dir.glob("*.jsonl"):
            if session_id in jsonl_file.stem:
                return jsonl_file
    return None


def get_sessions_by_project(project_name: str) -> list[SessionInfo]:
    all_sessions = get_all_sessions()
    return [s for s in all_sessions if s.project_name == project_name]


def group_sessions_by_project(
    sessions: list[SessionInfo],
) -> list[tuple[str, list[SessionInfo]]]:
    groups: dict[str, list[SessionInfo]] = {}
    for s in sessions:
        groups.setdefault(s.project_name, []).append(s)
    return list(groups.items())


def search_sessions(query: str) -> list[SessionInfo]:
    all_sessions = get_all_sessions()
    query_lower = query.lower()
    return [
        s
        for s in all_sessions
        if query_lower in s.project_name.lower()
        or query_lower in s.project_path.lower()
        or query_lower in s.git_branch.lower()
        or query_lower in s.session_id.lower()
    ]


def get_model_display_names(models: tuple[str, ...]) -> list[str]:
    return [get_model_display_name(m) for m in models]
