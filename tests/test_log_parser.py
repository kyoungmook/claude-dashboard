from pathlib import Path

from app.services.log_parser import (
    get_session_metadata,
    parse_jsonl_stream,
    parse_session_messages,
    raw_to_message,
)


def test_parse_jsonl_stream(sample_jsonl_path):
    entries = list(parse_jsonl_stream(sample_jsonl_path))
    assert len(entries) == 6
    assert entries[0]["type"] == "file-history-snapshot"
    assert entries[1]["type"] == "user"


def test_parse_jsonl_stream_nonexistent():
    entries = list(parse_jsonl_stream(Path("/nonexistent/file.jsonl")))
    assert entries == []


def test_raw_to_message_user(sample_jsonl_path):
    entries = list(parse_jsonl_stream(sample_jsonl_path))
    user_entry = entries[1]
    msg = raw_to_message(user_entry)
    assert msg is not None
    assert msg.msg_type == "user"
    assert msg.role == "user"
    assert "help me" in msg.content_text


def test_raw_to_message_assistant_with_tools(sample_jsonl_path):
    entries = list(parse_jsonl_stream(sample_jsonl_path))
    assistant_entry = entries[2]
    msg = raw_to_message(assistant_entry)
    assert msg is not None
    assert msg.msg_type == "assistant"
    assert msg.model == "claude-opus-4-5-20251101"
    assert msg.usage.input_tokens == 100
    assert msg.usage.output_tokens == 50
    assert msg.usage.cache_read_input_tokens == 5000
    assert len(msg.tool_calls) == 1
    assert msg.tool_calls[0].name == "Read"


def test_raw_to_message_with_thinking(sample_jsonl_path):
    entries = list(parse_jsonl_stream(sample_jsonl_path))
    msg = raw_to_message(entries[4])
    assert msg is not None
    assert "[thinking]" in msg.content_text
    assert "solution" in msg.content_text


def test_raw_to_message_system(sample_jsonl_path):
    entries = list(parse_jsonl_stream(sample_jsonl_path))
    msg = raw_to_message(entries[5])
    assert msg is not None
    assert msg.msg_type == "system"
    assert msg.subtype == "turn_duration"
    assert msg.duration_ms == 9000


def test_raw_to_message_skips_snapshot(sample_jsonl_path):
    entries = list(parse_jsonl_stream(sample_jsonl_path))
    msg = raw_to_message(entries[0])
    assert msg is None


def test_parse_session_messages(sample_jsonl_path):
    messages = parse_session_messages(sample_jsonl_path)
    assert len(messages) == 5
    types = [m.msg_type for m in messages]
    assert "user" in types
    assert "assistant" in types
    assert "system" in types


def test_get_session_metadata(sample_jsonl_path):
    metadata = get_session_metadata(sample_jsonl_path)
    assert metadata["session_id"] == "test-session-001"
    assert metadata["git_branch"] == "main"
    assert metadata["version"] == "2.1.11"


def test_aggregate_usage(sample_jsonl_path):
    messages = parse_session_messages(sample_jsonl_path)
    total_output = sum(m.usage.output_tokens for m in messages)
    assert total_output == 150
    total_input = sum(m.usage.input_tokens for m in messages)
    assert total_input == 300
