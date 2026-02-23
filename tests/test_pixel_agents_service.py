from __future__ import annotations

import json
import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from app.models.schemas import PixelAgentState


def _write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        for rec in records:
            f.write(json.dumps(rec) + "\n")


def _make_assistant_with_tool(tool_name: str, tool_input: dict | None = None) -> dict:
    return {
        "type": "assistant",
        "message": {
            "content": [
                {
                    "type": "tool_use",
                    "id": "tool_123",
                    "name": tool_name,
                    "input": tool_input or {},
                }
            ],
            "model": "claude-sonnet-4-5-20250929",
            "usage": {"input_tokens": 100, "output_tokens": 50},
        },
        "timestamp": "2026-02-23T10:00:00Z",
    }


def _make_user_message(content: str = "hello") -> dict:
    return {
        "type": "user",
        "message": {"content": content},
        "timestamp": "2026-02-23T10:00:01Z",
    }


def _make_system_turn_duration() -> dict:
    return {
        "type": "system",
        "subtype": "turn_duration",
        "timestamp": "2026-02-23T10:00:02Z",
    }


class TestToolStateMapping:
    def test_reading_tools(self):
        from app.services.pixel_agents_service import TOOL_STATE_MAP

        for tool in ("Read", "Grep", "Glob", "WebFetch", "WebSearch"):
            state, _ = TOOL_STATE_MAP[tool]
            assert state == "reading", f"{tool} should map to reading"

    def test_typing_tools(self):
        from app.services.pixel_agents_service import TOOL_STATE_MAP

        for tool in ("Edit", "Write", "Bash"):
            state, _ = TOOL_STATE_MAP[tool]
            assert state == "typing", f"{tool} should map to typing"

    def test_waiting_tools(self):
        from app.services.pixel_agents_service import TOOL_STATE_MAP

        state, _ = TOOL_STATE_MAP["AskUserQuestion"]
        assert state == "waiting"

    def test_task_tool(self):
        from app.services.pixel_agents_service import TOOL_STATE_MAP

        state, _ = TOOL_STATE_MAP["Task"]
        assert state == "typing"


class TestDetectState:
    def test_edit_tool_returns_typing(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit", {"file_path": "/a.py"})])
        state, tool_name, tool_status, model, is_sub = _detect_state_from_tail(jsonl)
        assert state == "typing"
        assert tool_name == "Edit"

    def test_read_tool_returns_reading(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Read", {"file_path": "/b.py"})])
        state, tool_name, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "reading"
        assert tool_name == "Read"

    def test_grep_tool_returns_reading(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Grep")])
        state, tool_name, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "reading"
        assert tool_name == "Grep"

    def test_ask_user_returns_waiting(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("AskUserQuestion")])
        state, tool_name, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "waiting"
        assert tool_name == "AskUserQuestion"

    def test_user_message_last_returns_typing(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [
            _make_assistant_with_tool("Edit"),
            _make_user_message("fix the bug"),
        ])
        state, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "typing"

    def test_turn_duration_last_returns_idle(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [
            _make_assistant_with_tool("Edit"),
            _make_system_turn_duration(),
        ])
        state, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "idle"

    def test_empty_file_returns_idle(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        jsonl.write_text("")
        state, tool_name, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "idle"
        assert tool_name == ""
        assert model == ""

    def test_corrupt_json_returns_idle(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        jsonl.write_text("not valid json\n{broken\n")
        state, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "idle"

    def test_unknown_tool_defaults_to_typing(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("SomeNewTool")])
        state, tool_name, tool_status, model, _ = _detect_state_from_tail(jsonl)
        assert state == "typing"
        assert tool_name == "SomeNewTool"

    def test_assistant_text_only_returns_typing(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [{
            "type": "assistant",
            "message": {
                "content": [{"type": "text", "text": "Hello!"}],
                "model": "claude-sonnet-4-5-20250929",
            },
            "timestamp": "2026-02-23T10:00:00Z",
        }])
        state, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "typing"

    def test_multiple_tools_uses_last(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [{
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "tool_use", "id": "t1", "name": "Read", "input": {}},
                    {"type": "tool_use", "id": "t2", "name": "Edit", "input": {}},
                ],
                "model": "claude-sonnet-4-5-20250929",
            },
            "timestamp": "2026-02-23T10:00:00Z",
        }])
        state, tool_name, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "typing"
        assert tool_name == "Edit"

    def test_large_file_reads_last_record(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        padding = [_make_user_message("x" * 200) for _ in range(30)]
        padding.append(_make_assistant_with_tool("Edit"))
        _write_jsonl(jsonl, padding)

        state, tool_name, _, model, _ = _detect_state_from_tail(jsonl)
        assert state == "typing"
        assert tool_name == "Edit"

    def test_returns_model_from_assistant_with_tool(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])
        _, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert model == "claude-sonnet-4-5-20250929"

    def test_returns_model_from_text_only_assistant(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [{
            "type": "assistant",
            "message": {
                "content": [{"type": "text", "text": "thinking..."}],
                "model": "claude-opus-4-6-20250219",
            },
            "timestamp": "2026-02-23T10:00:00Z",
        }])
        _, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert model == "claude-opus-4-6-20250219"

    def test_returns_empty_model_for_user_message(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_user_message()])
        _, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert model == ""

    def test_returns_empty_model_for_system_message(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "session.jsonl"
        _write_jsonl(jsonl, [_make_system_turn_duration()])
        _, _, _, model, _ = _detect_state_from_tail(jsonl)
        assert model == ""


class TestProjectNameFromDir:
    def test_simple_name(self):
        from app.services.pixel_agents_service import _project_name_from_dir

        assert _project_name_from_dir("-my-project") == "my-project"

    def test_home_only(self):
        from app.services.pixel_agents_service import _project_name_from_dir

        home = str(Path.home()).strip("/").replace("/", "-")
        assert _project_name_from_dir("-" + home) == "~"

    def test_documents_work_prefix(self):
        from app.services.pixel_agents_service import _project_name_from_dir

        home = str(Path.home()).strip("/").replace("/", "-")
        result = _project_name_from_dir("-" + home + "-Documents-work-foo")
        assert result == "foo"

    def test_empty_after_strip(self):
        from app.services.pixel_agents_service import _project_name_from_dir

        result = _project_name_from_dir("---")
        assert result == ""  or len(result) > 0  # should not crash


class TestFindActiveFiles:
    def test_finds_recently_modified(self, tmp_path: Path):
        from app.services.pixel_agents_service import _find_active_jsonl_files

        project_dir = tmp_path / "my-project"
        project_dir.mkdir()
        jsonl = project_dir / "abc123.jsonl"
        _write_jsonl(jsonl, [_make_user_message()])

        results = _find_active_jsonl_files(tmp_path)
        assert len(results) == 1
        assert results[0][0] == jsonl

    def test_ignores_old_files(self, tmp_path: Path):
        from app.services.pixel_agents_service import _find_active_jsonl_files

        project_dir = tmp_path / "old-project"
        project_dir.mkdir()
        jsonl = project_dir / "old.jsonl"
        _write_jsonl(jsonl, [_make_user_message()])
        old_time = time.time() - 600
        os.utime(jsonl, (old_time, old_time))

        results = _find_active_jsonl_files(tmp_path)
        assert len(results) == 0

    def test_empty_dir_returns_empty(self, tmp_path: Path):
        from app.services.pixel_agents_service import _find_active_jsonl_files

        results = _find_active_jsonl_files(tmp_path)
        assert results == []

    def test_nonexistent_dir_returns_empty(self, tmp_path: Path):
        from app.services.pixel_agents_service import _find_active_jsonl_files

        results = _find_active_jsonl_files(tmp_path / "does-not-exist")
        assert results == []

    def test_ignores_non_jsonl_files(self, tmp_path: Path):
        from app.services.pixel_agents_service import _find_active_jsonl_files

        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        (project_dir / "notes.txt").write_text("hello")

        results = _find_active_jsonl_files(tmp_path)
        assert len(results) == 0


class TestDeskAssignment:
    def test_sort_based_desk_indices(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        for sid in ("ccc", "aaa", "bbb"):
            project_dir = tmp_path / "proj"
            project_dir.mkdir(exist_ok=True)
            jsonl = project_dir / f"{sid}.jsonl"
            _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        result = _get_active_agents_impl(tmp_path)
        assert len(result) == 3
        assert result[0].session_id == "aaa"
        assert result[0].desk_index == 0
        assert result[1].session_id == "bbb"
        assert result[1].desk_index == 1
        assert result[2].session_id == "ccc"
        assert result[2].desk_index == 2

    def test_different_agents_get_different_desks(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        for sid in ("agent-1", "agent-2"):
            project_dir = tmp_path / "proj"
            project_dir.mkdir(exist_ok=True)
            jsonl = project_dir / f"{sid}.jsonl"
            _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        result = _get_active_agents_impl(tmp_path)
        desk_indices = {a.desk_index for a in result}
        assert len(desk_indices) == 2


class TestGetActiveAgents:
    def test_returns_tuple(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "test-project"
        project_dir.mkdir()
        jsonl = project_dir / "sess1.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        result = _get_active_agents_impl(tmp_path)
        assert isinstance(result, tuple)
        assert all(isinstance(a, PixelAgentState) for a in result)

    def test_active_agent_has_correct_state(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "my-proj"
        project_dir.mkdir()
        jsonl = project_dir / "sess1.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Read")])

        result = _get_active_agents_impl(tmp_path)
        assert len(result) == 1
        agent = result[0]
        assert agent.state == "reading"
        assert agent.tool_name == "Read"
        assert agent.session_id == "sess1"
        assert agent.desk_index == 0

    def test_active_agent_has_model(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "my-proj"
        project_dir.mkdir()
        jsonl = project_dir / "sess1.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        result = _get_active_agents_impl(tmp_path)
        assert len(result) == 1
        assert result[0].model == "claude-sonnet-4-5-20250929"

    def test_multiple_active_agents(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        for i, tool in enumerate(["Edit", "Read", "Bash"]):
            project_dir = tmp_path / f"proj-{i}"
            project_dir.mkdir()
            jsonl = project_dir / f"sess-{i}.jsonl"
            _write_jsonl(jsonl, [_make_assistant_with_tool(tool)])

        result = _get_active_agents_impl(tmp_path)
        assert len(result) == 3
        states = {a.state for a in result}
        assert "typing" in states
        assert "reading" in states


class TestSubagentDetection:
    def _make_subagent_jsonl(self, tmp_path: Path, project_name: str, parent_session_id: str, sub_session_id: str) -> Path:
        project_dir = tmp_path / project_name
        project_dir.mkdir(exist_ok=True)
        sub_jsonl = project_dir / f"{sub_session_id}.jsonl"
        records = [
            {
                "type": "assistant",
                "message": {
                    "content": [{"type": "tool_use", "id": "t1", "name": "Read", "input": {}}],
                    "model": "claude-haiku-4-5-20251001",
                    "usage": {"input_tokens": 50, "output_tokens": 25},
                },
                "timestamp": "2026-02-23T10:00:05Z",
                "parentToolUseID": "parent_tool_abc",
            },
        ]
        _write_jsonl(sub_jsonl, records)
        return sub_jsonl

    def test_subagent_detected_by_parent_tool_use_id(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        parent_jsonl = project_dir / "parent-sess.jsonl"
        _write_jsonl(parent_jsonl, [_make_assistant_with_tool("Task")])

        self._make_subagent_jsonl(tmp_path, "proj", "parent-sess", "sub-sess")

        result = _get_active_agents_impl(tmp_path)
        subagents = [a for a in result if a.is_subagent]
        non_subagents = [a for a in result if not a.is_subagent]
        assert len(subagents) == 1
        assert subagents[0].session_id == "sub-sess"
        assert subagents[0].is_subagent is True
        assert len(non_subagents) == 1
        assert non_subagents[0].session_id == "parent-sess"

    def test_subagent_has_model(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        parent_jsonl = project_dir / "parent-sess.jsonl"
        _write_jsonl(parent_jsonl, [_make_assistant_with_tool("Task")])

        self._make_subagent_jsonl(tmp_path, "proj", "parent-sess", "sub-sess")

        result = _get_active_agents_impl(tmp_path)
        subagent = [a for a in result if a.is_subagent][0]
        assert subagent.model == "claude-haiku-4-5-20251001"

    def test_no_subagent_when_no_parent_tool_use_id(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        jsonl = project_dir / "normal-sess.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        result = _get_active_agents_impl(tmp_path)
        assert len(result) == 1
        assert result[0].is_subagent is False

    def test_detect_state_returns_is_subagent_flag(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "sub.jsonl"
        _write_jsonl(jsonl, [{
            "type": "assistant",
            "message": {
                "content": [{"type": "tool_use", "id": "t1", "name": "Read", "input": {}}],
                "model": "claude-haiku-4-5-20251001",
            },
            "parentToolUseID": "parent_xyz",
            "timestamp": "2026-02-23T10:00:00Z",
        }])
        result = _detect_state_from_tail(jsonl)
        assert len(result) == 5
        state, tool_name, tool_status, model, is_subagent = result
        assert is_subagent is True
        assert model == "claude-haiku-4-5-20251001"

    def test_detect_state_non_subagent_flag(self, tmp_path: Path):
        from app.services.pixel_agents_service import _detect_state_from_tail

        jsonl = tmp_path / "normal.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])
        result = _detect_state_from_tail(jsonl)
        assert len(result) == 5
        _, _, _, _, is_subagent = result
        assert is_subagent is False


def _make_team_config(team_name: str, lead_session_id: str, members: list[dict]) -> dict:
    return {
        "name": team_name,
        "leadSessionId": lead_session_id,
        "members": members,
    }


class TestTeamDetection:
    def test_team_name_set_when_team_active(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        # Create project dir with a session matching the team lead
        project_dir = tmp_path / "projects" / "my-proj"
        project_dir.mkdir(parents=True)
        lead_session_id = "lead-session-abc"
        jsonl = project_dir / f"{lead_session_id}.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        # Create team config
        teams_dir = tmp_path / "teams"
        team_dir = teams_dir / "my-team"
        team_dir.mkdir(parents=True)
        config = _make_team_config("my-team", lead_session_id, [
            {"name": "team-lead", "agentId": "team-lead@my-team"},
        ])
        (team_dir / "config.json").write_text(json.dumps(config))

        result = _get_active_agents_impl(
            tmp_path / "projects", teams_dir=teams_dir
        )
        assert len(result) == 1
        assert result[0].team_name == "my-team"
        assert result[0].session_id == lead_session_id

    def test_no_team_when_no_teams_dir(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "projects" / "proj"
        project_dir.mkdir(parents=True)
        jsonl = project_dir / "sess1.jsonl"
        _write_jsonl(jsonl, [_make_assistant_with_tool("Edit")])

        # Pass a nonexistent teams_dir
        result = _get_active_agents_impl(
            tmp_path / "projects", teams_dir=tmp_path / "no-teams"
        )
        assert len(result) == 1
        assert result[0].team_name == ""

    def test_team_members_grouped_consecutive_desks(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "projects" / "proj"
        project_dir.mkdir(parents=True)

        lead_session_id = "lead-sess-123"
        # Create lead session
        lead_jsonl = project_dir / f"{lead_session_id}.jsonl"
        _write_jsonl(lead_jsonl, [_make_assistant_with_tool("Task")])

        # Create subagent sessions under lead's subagents dir
        subagents_dir = project_dir / lead_session_id / "subagents"
        subagents_dir.mkdir(parents=True)
        sub1 = subagents_dir / "agent-sub1.jsonl"
        _write_jsonl(sub1, [{
            "type": "assistant",
            "message": {
                "content": [{"type": "tool_use", "id": "t1", "name": "Edit", "input": {}}],
                "model": "claude-sonnet-4-5-20250929",
            },
            "parentToolUseID": "parent_xyz",
            "timestamp": "2026-02-23T10:00:00Z",
        }])
        sub2 = subagents_dir / "agent-sub2.jsonl"
        _write_jsonl(sub2, [{
            "type": "assistant",
            "message": {
                "content": [{"type": "tool_use", "id": "t2", "name": "Read", "input": {}}],
                "model": "claude-sonnet-4-5-20250929",
            },
            "parentToolUseID": "parent_xyz2",
            "timestamp": "2026-02-23T10:00:01Z",
        }])

        # Create a solo agent (not in any team)
        solo_jsonl = project_dir / "solo-agent.jsonl"
        _write_jsonl(solo_jsonl, [_make_assistant_with_tool("Bash")])

        # Create team config
        teams_dir = tmp_path / "teams"
        team_dir = teams_dir / "alpha-team"
        team_dir.mkdir(parents=True)
        config = _make_team_config("alpha-team", lead_session_id, [
            {"name": "team-lead", "agentId": "team-lead@alpha-team"},
            {"name": "worker-1", "agentId": "worker-1@alpha-team"},
            {"name": "worker-2", "agentId": "worker-2@alpha-team"},
        ])
        (team_dir / "config.json").write_text(json.dumps(config))

        result = _get_active_agents_impl(
            tmp_path / "projects", teams_dir=teams_dir
        )

        # All team members should have team_name set
        team_agents = [a for a in result if a.team_name == "alpha-team"]
        solo_agents = [a for a in result if a.team_name == ""]
        assert len(team_agents) == 3  # lead + 2 subagents
        assert len(solo_agents) == 1

        # Team members should have consecutive desk indices
        team_desks = sorted(a.desk_index for a in team_agents)
        assert team_desks == [0, 1, 2]

        # Solo agent should come after team members
        assert solo_agents[0].desk_index == 3

    def test_subagent_in_subdir_gets_team_name(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_agents_impl

        project_dir = tmp_path / "projects" / "proj"
        project_dir.mkdir(parents=True)

        lead_session_id = "lead-abc"
        # Create subagent in subdir (no lead session file needed)
        subagents_dir = project_dir / lead_session_id / "subagents"
        subagents_dir.mkdir(parents=True)
        sub_jsonl = subagents_dir / "agent-worker.jsonl"
        _write_jsonl(sub_jsonl, [{
            "type": "assistant",
            "message": {
                "content": [{"type": "tool_use", "id": "t1", "name": "Edit", "input": {}}],
                "model": "claude-sonnet-4-5-20250929",
            },
            "parentToolUseID": "parent_abc",
            "timestamp": "2026-02-23T10:00:00Z",
        }])

        teams_dir = tmp_path / "teams"
        team_dir = teams_dir / "beta-team"
        team_dir.mkdir(parents=True)
        config = _make_team_config("beta-team", lead_session_id, [])
        (team_dir / "config.json").write_text(json.dumps(config))

        result = _get_active_agents_impl(
            tmp_path / "projects", teams_dir=teams_dir
        )
        assert len(result) == 1
        assert result[0].team_name == "beta-team"
        assert result[0].is_subagent is True

    def test_get_active_team_memberships_empty_teams_dir(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_team_memberships

        result = _get_active_team_memberships(tmp_path / "nonexistent")
        assert result == {}

    def test_get_active_team_memberships_reads_config(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_team_memberships

        teams_dir = tmp_path / "teams"
        team_dir = teams_dir / "test-team"
        team_dir.mkdir(parents=True)
        config = _make_team_config("test-team", "session-xyz", [
            {"name": "lead", "agentId": "lead@test-team"},
        ])
        (team_dir / "config.json").write_text(json.dumps(config))

        result = _get_active_team_memberships(teams_dir)
        assert result == {"session-xyz": "test-team"}

    def test_get_active_team_memberships_corrupt_config(self, tmp_path: Path):
        from app.services.pixel_agents_service import _get_active_team_memberships

        teams_dir = tmp_path / "teams"
        team_dir = teams_dir / "bad-team"
        team_dir.mkdir(parents=True)
        (team_dir / "config.json").write_text("not valid json{{{")

        result = _get_active_team_memberships(teams_dir)
        assert result == {}

    def test_resolve_team_name_for_lead_session(self, tmp_path: Path):
        from app.services.pixel_agents_service import _resolve_team_name

        file_path = tmp_path / "projects" / "proj" / "lead-session.jsonl"
        memberships = {"lead-session": "my-team"}
        assert _resolve_team_name(file_path, memberships) == "my-team"

    def test_resolve_team_name_for_subagent(self, tmp_path: Path):
        from app.services.pixel_agents_service import _resolve_team_name

        file_path = tmp_path / "projects" / "proj" / "lead-sess" / "subagents" / "agent-worker.jsonl"
        memberships = {"lead-sess": "team-x"}
        assert _resolve_team_name(file_path, memberships) == "team-x"

    def test_resolve_team_name_no_match(self, tmp_path: Path):
        from app.services.pixel_agents_service import _resolve_team_name

        file_path = tmp_path / "projects" / "proj" / "random-session.jsonl"
        memberships = {"other-session": "some-team"}
        assert _resolve_team_name(file_path, memberships) == ""
