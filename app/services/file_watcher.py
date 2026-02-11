from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.models.schemas import LiveEvent, Message
from app.services.log_parser import raw_to_message

_INITIAL_TAIL_BYTES = 4096


@dataclass(frozen=True)
class FilePosition:
    path: str
    offset: int
    mtime: float


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


def _session_id_from_raw(raw: dict[str, Any]) -> str:
    return raw.get("sessionId", "")


class SingleFileWatcher:
    """Watch a single JSONL file and return new Message objects."""

    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._offset: int = 0
        self._mtime: float = 0.0

    def init_at_end(self) -> None:
        """Set offset to current file end so only new messages are detected."""
        try:
            stat = self._file_path.stat()
            self._offset = stat.st_size
            self._mtime = stat.st_mtime
        except (OSError, IOError):
            self._offset = 0
            self._mtime = 0.0

    def read_new_messages(self) -> list[Message]:
        """Read only new lines appended since last read, return visible Messages."""
        try:
            stat = self._file_path.stat()
        except (OSError, IOError):
            return []

        if stat.st_mtime == self._mtime and stat.st_size == self._offset:
            return []

        if stat.st_size < self._offset:
            self._offset = 0

        messages: list[Message] = []

        with open(self._file_path, "rb") as f:
            f.seek(self._offset)
            for raw_line in f:
                try:
                    line = raw_line.decode("utf-8").strip()
                except UnicodeDecodeError:
                    continue
                if not line:
                    continue
                try:
                    raw = json.loads(line)
                except json.JSONDecodeError:
                    continue

                msg = raw_to_message(raw)
                if msg is None or msg.is_meta:
                    continue
                messages.append(msg)

            self._offset = f.tell()

        self._mtime = stat.st_mtime
        return messages


class FileWatcher:
    def __init__(self, projects_dir: Path) -> None:
        self._positions: dict[str, FilePosition] = {}
        self._projects_dir = projects_dir

    def init_at_end(self) -> None:
        """Set offsets to current EOF for all existing files so only new data is detected."""
        if not self._projects_dir.exists():
            return
        for project_dir in self._projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
            for jsonl_file in project_dir.glob("*.jsonl"):
                try:
                    stat = jsonl_file.stat()
                    key = str(jsonl_file)
                    self._positions[key] = FilePosition(
                        path=key, offset=stat.st_size, mtime=stat.st_mtime,
                    )
                except (OSError, IOError):
                    continue

    def scan_new_lines(self) -> list[LiveEvent]:
        """Read only new lines from changed JSONL files."""
        new_events: list[LiveEvent] = []
        if not self._projects_dir.exists():
            return new_events

        for project_dir in self._projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
            project_name = _project_name_from_dir(project_dir.name)

            for jsonl_file in project_dir.glob("*.jsonl"):
                try:
                    events = self._read_file_delta(jsonl_file, project_name)
                    new_events.extend(events)
                except (OSError, IOError):
                    continue

        return new_events

    def _read_file_delta(
        self, jsonl_file: Path, project_name: str
    ) -> list[LiveEvent]:
        key = str(jsonl_file)
        stat = jsonl_file.stat()
        pos = self._positions.get(key)

        if pos and stat.st_mtime == pos.mtime and stat.st_size == pos.offset:
            return []

        is_initial = pos is None

        if pos and stat.st_size < pos.offset:
            offset = 0
            is_initial = True
        elif pos:
            offset = pos.offset
        else:
            offset = max(0, stat.st_size - _INITIAL_TAIL_BYTES)

        events: list[LiveEvent] = []
        session_id = ""

        with open(jsonl_file, "rb") as f:
            f.seek(offset)
            if is_initial and offset > 0:
                f.readline()  # skip partial line (binary safe)

            for raw_line in f:
                try:
                    line = raw_line.decode("utf-8").strip()
                except UnicodeDecodeError:
                    continue
                if not line:
                    continue
                try:
                    raw = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if not session_id:
                    session_id = _session_id_from_raw(raw)

                msg = raw_to_message(raw)
                if msg is None:
                    continue

                tool_names = tuple(tc.name for tc in msg.tool_calls)
                preview = msg.content_text[:100] if msg.content_text else ""

                events.append(
                    LiveEvent(
                        timestamp=msg.timestamp,
                        project_name=project_name,
                        session_id=session_id or jsonl_file.stem,
                        msg_type=msg.msg_type,
                        content_preview=preview,
                        tool_calls=tool_names,
                        output_tokens=msg.usage.output_tokens,
                        duration_ms=msg.duration_ms,
                        model=msg.model,
                    )
                )

            new_offset = f.tell()

        self._positions[key] = FilePosition(
            path=key, offset=new_offset, mtime=stat.st_mtime
        )
        return events
