import json
import os
import time
from pathlib import Path
from unittest.mock import patch

from app.services.cache import clear_all_caches
from app.services.session_service import (
    _file_cache,
    _project_display_path,
    _project_name_from_path,
    find_session_file,
    get_all_sessions,
)


@patch(
    "app.services.session_service._HOME_DIR_ENCODED",
    "Users-testuser",
)
class TestProjectNameFromPath:
    def test_strips_home_and_documents_work(self):
        assert (
            _project_name_from_path("-Users-testuser-Documents-work-my-project")
            == "my-project"
        )

    def test_preserves_hyphens_in_project_name(self):
        assert (
            _project_name_from_path(
                "-Users-testuser-Documents-work-some-app-feature-branch"
            )
            == "some-app-feature-branch"
        )

    def test_home_dir_only(self):
        assert _project_name_from_path("-Users-testuser") == "~"

    def test_strips_documents_without_work(self):
        assert (
            _project_name_from_path("-Users-testuser-Documents-my-project")
            == "my-project"
        )

    def test_unknown_prefix(self):
        assert _project_name_from_path("-tmp-some-project") == "tmp-some-project"


@patch(
    "app.services.session_service._HOME_DIR_ENCODED",
    "Users-testuser",
)
class TestProjectDisplayPath:
    def test_replaces_home_with_tilde(self):
        assert (
            _project_display_path("-Users-testuser-Documents-work-my-project")
            == "~/Documents-work-my-project"
        )

    def test_home_dir_only(self):
        assert _project_display_path("-Users-testuser") == "~"

    def test_unknown_prefix(self):
        assert _project_display_path("-tmp-some-project") == "tmp-some-project"


def _write_jsonl(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _sample_entries() -> list[dict]:
    return [
        {
            "type": "user",
            "sessionId": "sess-001",
            "gitBranch": "main",
            "version": "2.1.11",
            "cwd": "/test",
            "message": {"role": "user", "content": "hello"},
            "uuid": "u1",
            "timestamp": "2026-01-10T10:00:01.000Z",
            "isMeta": False,
        },
        {
            "type": "assistant",
            "sessionId": "sess-001",
            "message": {
                "model": "claude-opus-4-5-20251101",
                "role": "assistant",
                "content": [{"type": "text", "text": "hi"}],
                "usage": {"input_tokens": 100, "output_tokens": 50},
            },
            "uuid": "a1",
            "timestamp": "2026-01-10T10:00:05.000Z",
        },
    ]


class TestMtimeCache:
    def setup_method(self):
        _file_cache.clear()
        clear_all_caches()

    def test_cache_hit_when_mtime_unchanged(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"
        _write_jsonl(jsonl_file, _sample_entries())

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            sessions1 = get_all_sessions()
            assert len(sessions1) == 1

            key = str(jsonl_file)
            assert key in _file_cache

            clear_all_caches()
            sessions2 = get_all_sessions()
            assert len(sessions2) == 1
            assert sessions2[0].session_id == sessions1[0].session_id

    def test_reparse_when_mtime_changes(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"
        _write_jsonl(jsonl_file, _sample_entries())

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            sessions1 = get_all_sessions()
            assert len(sessions1) == 1
            original_count = sessions1[0].message_count

            clear_all_caches()

            time.sleep(0.05)
            with open(jsonl_file, "a") as f:
                extra = {
                    "type": "user",
                    "sessionId": "sess-001",
                    "message": {"role": "user", "content": "another"},
                    "uuid": "u2",
                    "timestamp": "2026-01-10T10:01:00.000Z",
                    "isMeta": False,
                }
                f.write(json.dumps(extra) + "\n")

            os.utime(jsonl_file, (time.time() + 1, time.time() + 1))

            sessions2 = get_all_sessions()
            assert len(sessions2) == 1
            assert sessions2[0].message_count == original_count + 1

    def test_tool_names_populated(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        entries = [
            {
                "type": "user",
                "sessionId": "sess-001",
                "gitBranch": "main",
                "version": "2.1.11",
                "cwd": "/test",
                "message": {"role": "user", "content": "hello"},
                "uuid": "u1",
                "timestamp": "2026-01-10T10:00:01.000Z",
                "isMeta": False,
            },
            {
                "type": "assistant",
                "sessionId": "sess-001",
                "message": {
                    "model": "claude-opus-4-5-20251101",
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": "ok"},
                        {"type": "tool_use", "id": "t1", "name": "Read", "input": {}},
                        {"type": "tool_use", "id": "t2", "name": "Edit", "input": {}},
                    ],
                    "usage": {"input_tokens": 100, "output_tokens": 50},
                },
                "uuid": "a1",
                "timestamp": "2026-01-10T10:00:05.000Z",
            },
        ]
        _write_jsonl(jsonl_file, entries)

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            sessions = get_all_sessions()
            assert sessions[0].tool_names == ("Read", "Edit")


class TestFindSessionFile:
    def test_finds_existing_session(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "abc123de-f456-7890-abcd-ef1234567890.jsonl"
        _write_jsonl(jsonl_file, _sample_entries())

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            result = find_session_file("abc123de-f456-7890-abcd-ef1234567890")
            assert result == jsonl_file

    def test_returns_none_for_missing_session(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        (projects_dir / "-test-project").mkdir(parents=True)

        with patch("app.services.session_service.PROJECTS_DIR", projects_dir):
            result = find_session_file("abcdef12-3456-7890-abcd-ef1234567890")
            assert result is None

    def test_returns_none_when_no_projects_dir(self, tmp_path: Path):
        with patch(
            "app.services.session_service.PROJECTS_DIR",
            tmp_path / "nonexistent",
        ):
            result = find_session_file("abcdef12-3456-7890-abcd-ef1234567890")
            assert result is None

    def test_rejects_invalid_session_id(self):
        assert find_session_file("") is None
        assert find_session_file("../etc/passwd") is None
        assert find_session_file('"; alert(1); "') is None
        assert find_session_file("a") is None
