from __future__ import annotations

import json
from collections.abc import Generator
from pathlib import Path
from typing import Any

from app.models.schemas import Message, TokenUsage, ToolCall


def parse_jsonl_stream(file_path: Path) -> Generator[dict[str, Any], None, None]:
    try:
        with open(file_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    except (OSError, IOError):
        return


def _extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "thinking":
                    parts.append(f"[thinking] {block.get('thinking', '')[:200]}")
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return ""


def _extract_tool_calls(content: Any) -> tuple[ToolCall, ...]:
    if not isinstance(content, list):
        return ()
    calls = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "tool_use":
            input_data = block.get("input", {})
            preview = json.dumps(input_data, ensure_ascii=False)[:100] if input_data else ""
            calls.append(
                ToolCall(
                    name=block.get("name", "unknown"),
                    tool_use_id=block.get("id", ""),
                    input_preview=preview,
                )
            )
    return tuple(calls)


def _extract_usage(usage_data: dict[str, Any] | None) -> TokenUsage:
    if not usage_data:
        return TokenUsage()
    return TokenUsage(
        input_tokens=usage_data.get("input_tokens", 0),
        output_tokens=usage_data.get("output_tokens", 0),
        cache_read_input_tokens=usage_data.get("cache_read_input_tokens", 0),
        cache_creation_input_tokens=usage_data.get("cache_creation_input_tokens", 0),
    )


def raw_to_message(raw: dict[str, Any]) -> Message | None:
    msg_type = raw.get("type")
    if msg_type not in ("user", "assistant", "system"):
        return None

    message_data = raw.get("message", {})
    role = message_data.get("role", msg_type)
    content = message_data.get("content", "")

    return Message(
        msg_type=msg_type,
        role=role,
        content_text=_extract_text_content(content),
        model=message_data.get("model", ""),
        usage=_extract_usage(message_data.get("usage")),
        tool_calls=_extract_tool_calls(content) if msg_type == "assistant" else (),
        timestamp=raw.get("timestamp", ""),
        uuid=raw.get("uuid", ""),
        is_meta=raw.get("isMeta", False),
        subtype=raw.get("subtype", ""),
        duration_ms=raw.get("durationMs", 0),
    )


def parse_session_messages(file_path: Path) -> list[Message]:
    messages = []
    for raw in parse_jsonl_stream(file_path):
        msg = raw_to_message(raw)
        if msg is not None:
            messages.append(msg)
    return messages


def get_session_metadata(file_path: Path) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "session_id": "",
        "git_branch": "",
        "version": "",
        "cwd": "",
    }
    for raw in parse_jsonl_stream(file_path):
        if raw.get("type") in ("user", "assistant"):
            if raw.get("sessionId"):
                metadata["session_id"] = raw["sessionId"]
            if raw.get("gitBranch"):
                metadata["git_branch"] = raw["gitBranch"]
            if raw.get("version"):
                metadata["version"] = raw["version"]
            if raw.get("cwd"):
                metadata["cwd"] = raw["cwd"]
            if all(metadata.values()):
                break
    return metadata


def _update_metadata(
    metadata: dict[str, Any], raw: dict[str, Any]
) -> dict[str, Any]:
    if raw.get("type") not in ("user", "assistant"):
        return metadata
    updates: dict[str, Any] = {}
    if raw.get("sessionId") and not metadata["session_id"]:
        updates["session_id"] = raw["sessionId"]
    if raw.get("gitBranch") and not metadata["git_branch"]:
        updates["git_branch"] = raw["gitBranch"]
    if raw.get("version") and not metadata["version"]:
        updates["version"] = raw["version"]
    if raw.get("cwd") and not metadata["cwd"]:
        updates["cwd"] = raw["cwd"]
    if not updates:
        return metadata
    return {**metadata, **updates}


def parse_session_full(file_path: Path) -> tuple[dict[str, Any], list[Message]]:
    """Parse metadata and messages in a single pass (one file read)."""
    metadata: dict[str, Any] = {
        "session_id": "",
        "git_branch": "",
        "version": "",
        "cwd": "",
    }
    messages: list[Message] = []
    metadata_complete = False

    for raw in parse_jsonl_stream(file_path):
        if not metadata_complete:
            metadata = _update_metadata(metadata, raw)
            metadata_complete = all(metadata.values())

        msg = raw_to_message(raw)
        if msg is not None:
            messages.append(msg)

    return metadata, messages
