from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from app.services.cache import clear_all_caches
from app.services.project_service import get_project_detail, get_project_stats
from app.services.session_service import _file_cache


def _write_jsonl(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _make_session(session_id: str, project_dir: Path, tools: list[str] | None = None) -> None:
    content_blocks = [{"type": "text", "text": "reply"}]
    if tools:
        for t in tools:
            content_blocks.append({"type": "tool_use", "id": f"t_{t}", "name": t, "input": {}})

    entries = [
        {
            "type": "user",
            "sessionId": session_id,
            "message": {"role": "user", "content": "hello"},
            "uuid": "u1",
            "timestamp": "2026-01-10T10:00:01.000Z",
        },
        {
            "type": "assistant",
            "sessionId": session_id,
            "message": {
                "model": "claude-opus-4-5-20251101",
                "role": "assistant",
                "content": content_blocks,
                "usage": {"input_tokens": 100, "output_tokens": 50},
            },
            "uuid": "a1",
            "timestamp": "2026-01-10T10:00:05.000Z",
        },
    ]
    _write_jsonl(project_dir / f"{session_id}.jsonl", entries)


class TestGetProjectDetail:
    def setup_method(self):
        _file_cache.clear()
        clear_all_caches()

    def test_returns_stats_and_sessions(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        _make_session("sess-001", project_dir, tools=["Read", "Edit"])
        _make_session("sess-002", project_dir, tools=["Read"])

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            stats, sessions, tool_freq, daily_counts = get_project_detail("test-project")

        assert stats is not None
        assert stats.session_count == 2
        assert len(sessions) == 2
        assert len(tool_freq) > 0
        assert tool_freq[0][0] == "Read"
        assert tool_freq[0][1] == 2

    def test_returns_none_for_unknown_project(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        _make_session("sess-001", project_dir)

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            stats, sessions, tool_freq, daily_counts = get_project_detail("nonexistent")

        assert stats is None
        assert sessions == []

    def test_daily_counts(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        _make_session("sess-001", project_dir)

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            stats, sessions, tool_freq, daily_counts = get_project_detail("test-project")

        assert len(daily_counts) == 1
        assert daily_counts[0][0] == "2026-01-10"


class TestGroupSessionsByProject:
    def setup_method(self):
        _file_cache.clear()
        clear_all_caches()

    def test_groups_by_project(self, tmp_path: Path):
        from app.services.session_service import group_sessions_by_project

        projects_dir = tmp_path / "projects"
        _make_session("sess-001", projects_dir / "-project-a")
        _make_session("sess-002", projects_dir / "-project-a")
        _make_session("sess-003", projects_dir / "-project-b")

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            from app.services.session_service import get_all_sessions
            all_sessions = get_all_sessions()
            grouped = group_sessions_by_project(all_sessions)

        assert len(grouped) == 2
        project_names = {name for name, _ in grouped}
        assert "project-a" in project_names
        assert "project-b" in project_names

    def test_empty_list(self):
        from app.services.session_service import group_sessions_by_project
        assert group_sessions_by_project([]) == []
