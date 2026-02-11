from __future__ import annotations

import json
from pathlib import Path

from app.services.file_watcher import FileWatcher


def _write_jsonl(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _append_jsonl(path: Path, entries: list[dict]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _make_user_msg(content: str, ts: str = "2026-01-10T10:00:01.000Z") -> dict:
    return {
        "type": "user",
        "sessionId": "test-session",
        "message": {"role": "user", "content": content},
        "uuid": "u1",
        "timestamp": ts,
    }


def _make_assistant_msg(
    content: str,
    ts: str = "2026-01-10T10:00:05.000Z",
    tool_names: list[str] | None = None,
) -> dict:
    content_blocks: list[dict] = [{"type": "text", "text": content}]
    if tool_names:
        for name in tool_names:
            content_blocks.append({
                "type": "tool_use",
                "id": f"toolu_{name}",
                "name": name,
                "input": {},
            })
    return {
        "type": "assistant",
        "sessionId": "test-session",
        "message": {
            "model": "claude-opus-4-5-20251101",
            "role": "assistant",
            "content": content_blocks,
            "usage": {"input_tokens": 100, "output_tokens": 50},
        },
        "uuid": "a1",
        "timestamp": ts,
    }


class TestFileWatcherNewFile:
    def test_detects_new_file(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [_make_user_msg("hello")])

        watcher = FileWatcher(projects_dir)
        events = watcher.scan_new_lines()

        assert len(events) == 1
        assert events[0].msg_type == "user"
        assert events[0].content_preview == "hello"
        assert events[0].project_name == "test-project"

    def test_no_events_when_no_change(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [_make_user_msg("hello")])

        watcher = FileWatcher(projects_dir)
        watcher.scan_new_lines()

        events = watcher.scan_new_lines()
        assert len(events) == 0


class TestFileWatcherIncremental:
    def test_reads_only_new_lines(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = FileWatcher(projects_dir)
        first_events = watcher.scan_new_lines()
        assert len(first_events) == 1

        _append_jsonl(jsonl_file, [_make_assistant_msg("second", tool_names=["Read"])])

        second_events = watcher.scan_new_lines()
        assert len(second_events) == 1
        assert second_events[0].msg_type == "assistant"
        assert second_events[0].tool_calls == ("Read",)

    def test_handles_multiple_appends(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = FileWatcher(projects_dir)
        watcher.scan_new_lines()

        _append_jsonl(jsonl_file, [
            _make_assistant_msg("reply1"),
            _make_user_msg("second"),
        ])

        events = watcher.scan_new_lines()
        assert len(events) == 2


class TestFileWatcherInitAtEnd:
    def test_init_at_end_skips_existing_files(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [
            _make_user_msg("existing1"),
            _make_assistant_msg("existing2"),
        ])

        watcher = FileWatcher(projects_dir)
        watcher.init_at_end()

        events = watcher.scan_new_lines()
        assert events == []

    def test_init_at_end_then_detects_new_messages(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [_make_user_msg("existing")])

        watcher = FileWatcher(projects_dir)
        watcher.init_at_end()

        _append_jsonl(jsonl_file, [_make_assistant_msg("new reply")])

        events = watcher.scan_new_lines()
        assert len(events) == 1
        assert events[0].msg_type == "assistant"
        assert events[0].content_preview == "new reply"

    def test_init_at_end_detects_new_files(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [_make_user_msg("existing")])

        watcher = FileWatcher(projects_dir)
        watcher.init_at_end()

        # New file created after init_at_end
        new_file = project_dir / "session2.jsonl"
        _write_jsonl(new_file, [_make_user_msg("brand new")])

        events = watcher.scan_new_lines()
        assert len(events) == 1
        assert events[0].content_preview == "brand new"

    def test_init_at_end_multiple_projects(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        for name in ("-project-a", "-project-b"):
            f = projects_dir / name / "s.jsonl"
            _write_jsonl(f, [_make_user_msg(f"existing in {name}")])

        watcher = FileWatcher(projects_dir)
        watcher.init_at_end()

        events = watcher.scan_new_lines()
        assert events == []


class TestFileWatcherEdgeCases:
    def test_empty_projects_dir(self, tmp_path: Path):
        projects_dir = tmp_path / "nonexistent"
        watcher = FileWatcher(projects_dir)
        events = watcher.scan_new_lines()
        assert events == []

    def test_skips_non_message_types(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(jsonl_file, [
            {"type": "file-history-snapshot", "messageId": "x", "snapshot": {}},
            _make_user_msg("hello"),
        ])

        watcher = FileWatcher(projects_dir)
        events = watcher.scan_new_lines()
        assert len(events) == 1
        assert events[0].msg_type == "user"

    def test_content_preview_truncated(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        long_content = "x" * 200
        _write_jsonl(jsonl_file, [_make_user_msg(long_content)])

        watcher = FileWatcher(projects_dir)
        events = watcher.scan_new_lines()
        assert len(events[0].content_preview) == 100

    def test_tool_calls_captured(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        project_dir = projects_dir / "-test-project"
        jsonl_file = project_dir / "session1.jsonl"

        _write_jsonl(
            jsonl_file,
            [_make_assistant_msg("reply", tool_names=["Read", "Edit", "Bash"])],
        )

        watcher = FileWatcher(projects_dir)
        events = watcher.scan_new_lines()
        assert events[0].tool_calls == ("Read", "Edit", "Bash")

    def test_multiple_project_dirs(self, tmp_path: Path):
        projects_dir = tmp_path / "projects"
        for name in ("-project-a", "-project-b"):
            f = projects_dir / name / "s.jsonl"
            _write_jsonl(f, [_make_user_msg(f"hi from {name}")])

        watcher = FileWatcher(projects_dir)
        events = watcher.scan_new_lines()
        assert len(events) == 2
        project_names = {e.project_name for e in events}
        assert "project-a" in project_names
        assert "project-b" in project_names


# ── SingleFileWatcher Tests ──────────────────────────────────────────

from app.services.file_watcher import SingleFileWatcher


class TestSingleFileWatcherInitAtEnd:
    def test_init_at_end_skips_existing_messages(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [
            _make_user_msg("existing1"),
            _make_assistant_msg("existing2"),
        ])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        messages = watcher.read_new_messages()
        assert messages == []

    def test_init_at_end_then_detects_new_messages(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("existing")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        _append_jsonl(jsonl_file, [_make_assistant_msg("new reply")])

        messages = watcher.read_new_messages()
        assert len(messages) == 1
        assert messages[0].msg_type == "assistant"
        assert messages[0].content_text == "new reply"


class TestSingleFileWatcherNewMessages:
    def test_detects_appended_user_message(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        _append_jsonl(jsonl_file, [_make_user_msg("second")])

        messages = watcher.read_new_messages()
        assert len(messages) == 1
        assert messages[0].content_text == "second"

    def test_detects_multiple_new_messages(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        _append_jsonl(jsonl_file, [
            _make_assistant_msg("reply", tool_names=["Read"]),
            _make_user_msg("followup"),
        ])

        messages = watcher.read_new_messages()
        assert len(messages) == 2
        assert messages[0].msg_type == "assistant"
        assert len(messages[0].tool_calls) == 1
        assert messages[0].tool_calls[0].name == "Read"
        assert messages[1].msg_type == "user"

    def test_returns_empty_when_no_change(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("hello")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        messages = watcher.read_new_messages()
        assert messages == []


class TestSingleFileWatcherFiltering:
    def test_filters_meta_messages(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        meta_msg = _make_user_msg("meta content")
        meta_msg["isMeta"] = True
        _append_jsonl(jsonl_file, [
            meta_msg,
            _make_assistant_msg("visible reply"),
        ])

        messages = watcher.read_new_messages()
        assert len(messages) == 1
        assert messages[0].content_text == "visible reply"

    def test_skips_non_message_types(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        _append_jsonl(jsonl_file, [
            {"type": "file-history-snapshot", "messageId": "x", "snapshot": {}},
            _make_user_msg("real message"),
        ])

        messages = watcher.read_new_messages()
        assert len(messages) == 1
        assert messages[0].content_text == "real message"


class TestSingleFileWatcherEdgeCases:
    def test_nonexistent_file(self, tmp_path: Path):
        jsonl_file = tmp_path / "nonexistent.jsonl"
        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        messages = watcher.read_new_messages()
        assert messages == []

    def test_consecutive_reads(self, tmp_path: Path):
        jsonl_file = tmp_path / "session.jsonl"
        _write_jsonl(jsonl_file, [_make_user_msg("first")])

        watcher = SingleFileWatcher(jsonl_file)
        watcher.init_at_end()

        _append_jsonl(jsonl_file, [_make_assistant_msg("batch1")])
        messages1 = watcher.read_new_messages()
        assert len(messages1) == 1

        _append_jsonl(jsonl_file, [_make_user_msg("batch2")])
        messages2 = watcher.read_new_messages()
        assert len(messages2) == 1
        assert messages2[0].content_text == "batch2"
