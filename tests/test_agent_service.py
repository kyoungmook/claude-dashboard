import json
from pathlib import Path

import pytest

from app.models.schemas import AgentDefinition, AgentStats, SubagentActivity, TeamSession
from app.services.agent_service import (
    _extract_text,
    _infer_agent_type,
    _parse_agent_md,
    _parse_subagent_jsonl,
    _preview_tool_input,
    get_agent_analytics,
    get_agent_definitions,
    get_all_subagent_activities,
    get_replay_events,
    get_team_sessions,
)
from app.services.cache import clear_all_caches


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_all_caches()
    yield
    clear_all_caches()


@pytest.fixture
def agents_dir(tmp_path):
    d = tmp_path / "agents"
    d.mkdir()
    return d


@pytest.fixture
def projects_dir(tmp_path):
    d = tmp_path / "projects"
    d.mkdir()
    return d


def _write_agent_md(agents_dir: Path, name: str, model: str = "opus", tools: list[str] | None = None):
    tools_str = json.dumps(tools or ["Read", "Grep"])
    content = f"""---
name: {name}
description: Test agent for {name}
tools: {tools_str}
model: {model}
---
# Instructions for {name}
"""
    (agents_dir / f"{name}.md").write_text(content, encoding="utf-8")


def _write_subagent_jsonl(projects_dir: Path, project: str, session: str, agent_id: str, messages: list[dict]):
    session_dir = projects_dir / project / session / "subagents"
    session_dir.mkdir(parents=True, exist_ok=True)
    path = session_dir / f"{agent_id}.jsonl"
    lines = [json.dumps(msg) for msg in messages]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


class TestParseAgentMd:
    def test_valid_frontmatter(self, agents_dir):
        _write_agent_md(agents_dir, "reviewer", "sonnet", ["Read", "Bash"])
        result = _parse_agent_md(agents_dir / "reviewer.md")
        assert result is not None
        assert result.name == "reviewer"
        assert result.model == "sonnet"
        assert result.tools == ("Read", "Bash")
        assert "Test agent" in result.description

    def test_no_frontmatter(self, tmp_path):
        path = tmp_path / "no_front.md"
        path.write_text("Just some text", encoding="utf-8")
        assert _parse_agent_md(path) is None

    def test_missing_name(self, tmp_path):
        path = tmp_path / "no_name.md"
        path.write_text("---\ndescription: foo\n---\n", encoding="utf-8")
        assert _parse_agent_md(path) is None

    def test_nonexistent_file(self, tmp_path):
        assert _parse_agent_md(tmp_path / "nope.md") is None


class TestGetAgentDefinitions:
    def test_loads_all(self, agents_dir):
        _write_agent_md(agents_dir, "alpha")
        _write_agent_md(agents_dir, "beta")
        result = get_agent_definitions(agents_dir=str(agents_dir))
        assert len(result) == 2
        names = [d.name for d in result]
        assert "alpha" in names
        assert "beta" in names

    def test_nonexistent_dir(self, tmp_path):
        assert get_agent_definitions(agents_dir=str(tmp_path / "nope")) == []


class TestParseSubagentJsonl:
    def test_basic_parsing(self, tmp_path):
        path = tmp_path / "agent-abc.jsonl"
        messages = [
            {
                "type": "user",
                "timestamp": "2026-01-01T10:00:00Z",
                "message": {"role": "user", "content": "Do something"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-01-01T10:00:05Z",
                "message": {
                    "role": "assistant",
                    "model": "claude-opus-4-6",
                    "content": [
                        {"type": "text", "text": "Done"},
                        {"type": "tool_use", "name": "Read", "input": {"file_path": "/tmp/x"}},
                    ],
                    "usage": {"input_tokens": 100, "output_tokens": 50},
                },
            },
        ]
        path.write_text("\n".join(json.dumps(m) for m in messages), encoding="utf-8")

        result = _parse_subagent_jsonl(path, "test-project", "session-1")
        assert result is not None
        assert result.agent_id == "agent-abc"
        assert result.message_count == 2
        assert result.total_input_tokens == 100
        assert result.total_output_tokens == 50
        assert "Read" in result.tools_used
        assert result.model == "claude-opus-4-6"
        assert result.first_timestamp == "2026-01-01T10:00:00Z"
        assert result.last_timestamp == "2026-01-01T10:00:05Z"

    def test_empty_file(self, tmp_path):
        path = tmp_path / "empty.jsonl"
        path.write_text("", encoding="utf-8")
        assert _parse_subagent_jsonl(path, "p", "s") is None


class TestGetAllSubagentActivities:
    def test_scans_projects(self, projects_dir):
        messages = [
            {
                "type": "assistant",
                "timestamp": "2026-01-01T10:00:00Z",
                "message": {"role": "assistant", "model": "opus", "content": "ok", "usage": {"input_tokens": 10, "output_tokens": 5}},
            }
        ]
        _write_subagent_jsonl(projects_dir, "proj-a", "sess-1", "agent-x", messages)
        _write_subagent_jsonl(projects_dir, "proj-b", "sess-2", "agent-y", messages)

        result = get_all_subagent_activities(projects_dir=str(projects_dir))
        assert len(result) == 2

    def test_nonexistent_dir(self, tmp_path):
        assert get_all_subagent_activities(projects_dir=str(tmp_path / "nope")) == []


class TestGetTeamSessions:
    def test_discovers_sessions(self, projects_dir):
        messages = [
            {"type": "user", "timestamp": "2026-01-01T10:00:00Z", "message": {"content": "hi"}},
            {"type": "assistant", "timestamp": "2026-01-01T10:01:00Z", "message": {"content": "ok"}},
        ]
        _write_subagent_jsonl(projects_dir, "my-proj", "sess-abc", "agent-a1", messages)
        _write_subagent_jsonl(projects_dir, "my-proj", "sess-abc", "agent-a2", messages)

        result = get_team_sessions(projects_dir=str(projects_dir))
        assert len(result) == 1
        assert isinstance(result[0], TeamSession)
        assert result[0].agent_count == 2
        assert result[0].message_count == 4

    def test_nonexistent_dir(self, tmp_path):
        assert get_team_sessions(projects_dir=str(tmp_path / "nope")) == []


class TestGetReplayEvents:
    def test_builds_timeline(self, projects_dir):
        messages = [
            {
                "type": "user",
                "timestamp": "2026-01-01T10:00:00Z",
                "message": {"role": "user", "content": "Review this code"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-01-01T10:00:05Z",
                "message": {
                    "role": "assistant",
                    "model": "claude-opus-4-6",
                    "content": [
                        {"type": "text", "text": "Looking at the code..."},
                        {"type": "tool_use", "name": "Read", "input": {"file_path": "/tmp/test.py"}},
                    ],
                },
            },
        ]
        _write_subagent_jsonl(projects_dir, "proj", "sess-replay", "agent-r1", messages)

        result = get_replay_events("sess-replay", projects_dir=str(projects_dir))
        assert len(result) == 3
        assert result[0].event_type == "task"
        assert result[1].event_type == "message"
        assert result[2].event_type == "tool_use"
        assert result[2].tool_name == "Read"

    def test_nonexistent_session(self, projects_dir):
        assert get_replay_events("no-such-session", projects_dir=str(projects_dir)) == []


class TestGetAgentAnalytics:
    def test_aggregates_stats(self, projects_dir):
        messages = [
            {
                "type": "assistant",
                "timestamp": "2026-01-01T10:00:00Z",
                "message": {
                    "model": "opus",
                    "content": [{"type": "tool_use", "name": "Read", "input": {}}],
                    "usage": {"input_tokens": 100, "output_tokens": 50},
                },
            }
        ]
        _write_subagent_jsonl(projects_dir, "p", "s1", "agent-a1", messages)
        _write_subagent_jsonl(projects_dir, "p", "s2", "agent-a2", messages)

        result = get_agent_analytics(projects_dir=str(projects_dir))
        assert len(result) >= 1
        total_invocations = sum(a.invocation_count for a in result)
        assert total_invocations == 2


class TestHelpers:
    def test_infer_agent_type(self):
        assert _infer_agent_type("agent-abc123") == "subagent"
        assert _infer_agent_type("agent-aprompt_suggestion-xyz") == "prompt-suggestion"

    def test_extract_text_string(self):
        assert _extract_text("hello") == "hello"

    def test_extract_text_list(self):
        content = [{"type": "text", "text": "hello"}, {"type": "tool_use", "name": "X"}]
        assert _extract_text(content) == "hello"

    def test_extract_text_empty(self):
        assert _extract_text(None) == ""
        assert _extract_text([]) == ""

    def test_preview_tool_input_file(self):
        assert _preview_tool_input({"file_path": "/tmp/x"}) == "/tmp/x"

    def test_preview_tool_input_command(self):
        assert _preview_tool_input({"command": "ls -la"}) == "ls -la"

    def test_preview_tool_input_pattern(self):
        assert _preview_tool_input({"pattern": "*.py"}) == "pattern: *.py"

    def test_preview_tool_input_empty(self):
        assert _preview_tool_input({}) == ""
        assert _preview_tool_input("not a dict") == ""
