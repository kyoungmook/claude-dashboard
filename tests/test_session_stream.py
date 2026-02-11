from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.routers.sessions import _message_to_dict
from app.models.schemas import Message, TokenUsage, ToolCall
from main import app


class TestMessageToDict:
    def test_basic_message(self):
        msg = Message(
            msg_type="user",
            role="user",
            content_text="hello",
            timestamp="2026-01-10T10:00:01.000Z",
        )
        result = _message_to_dict(msg)
        assert result["msg_type"] == "user"
        assert result["content_text"] == "hello"
        assert result["tool_calls"] == []

    def test_assistant_with_tool_calls(self):
        msg = Message(
            msg_type="assistant",
            role="assistant",
            content_text="ok",
            tool_calls=(
                ToolCall(name="Read", tool_use_id="t1"),
                ToolCall(name="Edit", tool_use_id="t2"),
            ),
            usage=TokenUsage(input_tokens=100, output_tokens=50),
        )
        result = _message_to_dict(msg)
        assert result["tool_calls"] == ["Read", "Edit"]
        assert result["usage"]["input_tokens"] == 100
        assert result["usage"]["output_tokens"] == 50

    def test_empty_tool_calls(self):
        msg = Message(msg_type="system", role="system")
        result = _message_to_dict(msg)
        assert result["tool_calls"] == []

    def test_serializable_to_json(self):
        msg = Message(
            msg_type="assistant",
            role="assistant",
            content_text="test",
            model="claude-opus-4-5-20251101",
            tool_calls=(ToolCall(name="Bash", tool_use_id="t1", input_preview="ls"),),
            usage=TokenUsage(input_tokens=50, output_tokens=25),
            duration_ms=1500,
        )
        result = _message_to_dict(msg)
        serialized = json.dumps(result, ensure_ascii=False)
        parsed = json.loads(serialized)
        assert parsed["model"] == "claude-opus-4-5-20251101"
        assert parsed["tool_calls"] == ["Bash"]
        assert parsed["duration_ms"] == 1500


class TestSessionStreamEndpoint:
    def test_returns_error_for_unknown_session(self):
        with patch(
            "app.routers.sessions.find_session_file", return_value=None
        ):
            client = TestClient(app)
            with client.stream("GET", "/sessions/unknown-id/stream") as resp:
                assert resp.status_code == 200
                for line in resp.iter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        assert "error" in data
                        break
