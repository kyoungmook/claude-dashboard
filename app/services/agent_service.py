from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from app.config import CLAUDE_DIR, PROJECTS_DIR
from app.models.schemas import (
    AgentDefinition,
    AgentStats,
    ReplayEvent,
    SubagentActivity,
    TeamSession,
)
from app.services.cache import ttl_cache

AGENTS_DIR = CLAUDE_DIR / "agents"

_HOME_DIR_ENCODED = str(Path.home()).strip("/").replace("/", "-")


def _project_name_from_dir(dir_name: str) -> str:
    name = dir_name.lstrip("-")
    if name == _HOME_DIR_ENCODED:
        return "~"
    if name.startswith(_HOME_DIR_ENCODED + "-"):
        name = name[len(_HOME_DIR_ENCODED) + 1 :]
    for prefix in ("Documents-work-", "Documents-"):
        if name.startswith(prefix):
            name = name[len(prefix) :]
            break
    return name or dir_name.lstrip("-")


def _parse_agent_md(path: Path) -> AgentDefinition | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None

    if not text.startswith("---"):
        return None

    end = text.find("---", 3)
    if end == -1:
        return None

    frontmatter = text[3:end]
    name = ""
    description = ""
    tools: list[str] = []
    model = ""

    for line in frontmatter.splitlines():
        if line.startswith("name:"):
            name = line.split(":", 1)[1].strip()
        elif line.startswith("description:"):
            description = line.split(":", 1)[1].strip()
        elif line.startswith("tools:"):
            raw = line.split(":", 1)[1].strip()
            tools = [t.strip().strip('"') for t in re.findall(r'"([^"]+)"', raw)]
        elif line.startswith("model:"):
            model = line.split(":", 1)[1].strip()

    if not name:
        return None

    return AgentDefinition(
        name=name,
        description=description,
        tools=tuple(tools),
        model=model,
    )


@ttl_cache(ttl_seconds=300)
def get_agent_definitions(agents_dir: str | None = None) -> list[AgentDefinition]:
    base = Path(agents_dir) if agents_dir else AGENTS_DIR
    if not base.is_dir():
        return []

    results: list[AgentDefinition] = []
    for md_file in sorted(base.glob("*.md")):
        defn = _parse_agent_md(md_file)
        if defn is not None:
            results.append(defn)
    return results


def _parse_subagent_jsonl(path: Path, project_name: str, session_id: str) -> SubagentActivity | None:
    agent_id = path.stem
    messages = 0
    input_tokens = 0
    output_tokens = 0
    tools: list[str] = []
    first_ts = ""
    last_ts = ""
    model = ""

    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                messages += 1
                ts = data.get("timestamp", "")
                if ts and (not first_ts or ts < first_ts):
                    first_ts = ts
                if ts and (not last_ts or ts > last_ts):
                    last_ts = ts

                msg = data.get("message", {})
                if not isinstance(msg, dict):
                    continue

                if msg.get("model") and not model:
                    model = msg["model"]

                usage = msg.get("usage", {})
                if isinstance(usage, dict):
                    input_tokens += usage.get("input_tokens", 0)
                    input_tokens += usage.get("cache_read_input_tokens", 0)
                    input_tokens += usage.get("cache_creation_input_tokens", 0)
                    output_tokens += usage.get("output_tokens", 0)

                content = msg.get("content", [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            tool_name = block.get("name", "")
                            if tool_name:
                                tools.append(tool_name)
    except OSError:
        return None

    if messages == 0:
        return None

    unique_tools = tuple(sorted(set(tools)))
    return SubagentActivity(
        session_id=session_id,
        agent_id=agent_id,
        project_name=project_name,
        message_count=messages,
        total_input_tokens=input_tokens,
        total_output_tokens=output_tokens,
        tools_used=unique_tools,
        first_timestamp=first_ts,
        last_timestamp=last_ts,
        model=model,
    )


@ttl_cache(ttl_seconds=60)
def get_all_subagent_activities(projects_dir: str | None = None) -> list[SubagentActivity]:
    base = Path(projects_dir) if projects_dir else PROJECTS_DIR
    if not base.is_dir():
        return []

    results: list[SubagentActivity] = []
    for project_dir in base.iterdir():
        if not project_dir.is_dir():
            continue
        project_name = _project_name_from_dir(project_dir.name)
        for session_dir in project_dir.iterdir():
            if not session_dir.is_dir():
                continue
            subagents_dir = session_dir / "subagents"
            if not subagents_dir.is_dir():
                continue
            for jsonl_file in subagents_dir.glob("*.jsonl"):
                activity = _parse_subagent_jsonl(
                    jsonl_file, project_name, session_dir.name
                )
                if activity is not None:
                    results.append(activity)

    results.sort(key=lambda a: a.last_timestamp, reverse=True)
    return results


@ttl_cache(ttl_seconds=60)
def get_agent_analytics(projects_dir: str | None = None) -> list[AgentStats]:
    activities = get_all_subagent_activities(projects_dir)
    definitions = {d.name: d for d in get_agent_definitions()}

    agent_data: dict[str, dict] = {}
    for act in activities:
        agent_type = _infer_agent_type(act.agent_id)
        if agent_type not in agent_data:
            defn = definitions.get(agent_type)
            agent_data[agent_type] = {
                "description": defn.description if defn else "",
                "model": defn.model if defn else "",
                "count": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "tool_counter": Counter(),
            }
        entry = agent_data[agent_type]
        entry["count"] += 1
        entry["input_tokens"] += act.total_input_tokens
        entry["output_tokens"] += act.total_output_tokens
        for tool in act.tools_used:
            entry["tool_counter"][tool] += 1

    results: list[AgentStats] = []
    for name, data in sorted(agent_data.items(), key=lambda x: x[1]["count"], reverse=True):
        tool_counts = tuple(sorted(data["tool_counter"].items(), key=lambda x: x[1], reverse=True))
        results.append(
            AgentStats(
                agent_name=name,
                description=data["description"],
                invocation_count=data["count"],
                total_input_tokens=data["input_tokens"],
                total_output_tokens=data["output_tokens"],
                tool_counts=tool_counts,
                model=data["model"],
            )
        )
    return results


def get_agent_detail(
    agent_name: str,
) -> tuple[AgentDefinition | None, AgentStats | None, list[SubagentActivity], dict[str, int]]:
    """Return (definition, stats, activities, project_distribution) for an agent."""
    definitions = get_agent_definitions()
    defn = next((d for d in definitions if d.name == agent_name), None)

    analytics = get_agent_analytics()
    stats = next((a for a in analytics if a.agent_name == agent_name), None)

    all_activities = get_all_subagent_activities()
    activities = [a for a in all_activities if _infer_agent_type(a.agent_id) == agent_name]

    project_dist: dict[str, int] = {}
    for act in activities:
        project_dist[act.project_name] = project_dist.get(act.project_name, 0) + 1

    return defn, stats, activities, project_dist


def _infer_agent_type(agent_id: str) -> str:
    clean = agent_id.replace("agent-", "")
    if "prompt_suggestion" in clean:
        return "prompt-suggestion"
    return "subagent"


@ttl_cache(ttl_seconds=60)
def get_team_sessions(projects_dir: str | None = None) -> list[TeamSession]:
    base = Path(projects_dir) if projects_dir else PROJECTS_DIR
    if not base.is_dir():
        return []

    results: list[TeamSession] = []
    for project_dir in base.iterdir():
        if not project_dir.is_dir():
            continue
        project_name = _project_name_from_dir(project_dir.name)
        for session_dir in project_dir.iterdir():
            if not session_dir.is_dir():
                continue
            subagents_dir = session_dir / "subagents"
            if not subagents_dir.is_dir():
                continue
            agent_files = list(subagents_dir.glob("*.jsonl"))
            if not agent_files:
                continue

            agent_ids: list[str] = []
            total_messages = 0
            first_ts = ""
            last_ts = ""

            for af in agent_files:
                agent_ids.append(af.stem)
                try:
                    with open(af, encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                data = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            total_messages += 1
                            ts = data.get("timestamp", "")
                            if ts and (not first_ts or ts < first_ts):
                                first_ts = ts
                            if ts and (not last_ts or ts > last_ts):
                                last_ts = ts
                except OSError:
                    continue

            results.append(
                TeamSession(
                    session_id=session_dir.name,
                    project_name=project_name,
                    agent_count=len(agent_ids),
                    message_count=total_messages,
                    first_timestamp=first_ts,
                    last_timestamp=last_ts,
                    agent_ids=tuple(sorted(agent_ids)),
                )
            )

    results.sort(key=lambda s: s.last_timestamp, reverse=True)
    return results


def get_replay_events(session_id: str, projects_dir: str | None = None) -> list[ReplayEvent]:
    base = Path(projects_dir) if projects_dir else PROJECTS_DIR
    if not base.is_dir():
        return []

    subagents_dir = _find_subagents_dir(base, session_id)
    if subagents_dir is None:
        return []

    events: list[ReplayEvent] = []

    for jsonl_file in subagents_dir.glob("*.jsonl"):
        agent_id = jsonl_file.stem
        agent_label = agent_id.replace("agent-", "")
        if len(agent_label) > 7:
            agent_label = agent_label[:7]

        try:
            with open(jsonl_file, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    ts = data.get("timestamp", "")
                    msg_type = data.get("type", "")
                    msg = data.get("message", {})
                    if not isinstance(msg, dict):
                        continue

                    model = msg.get("model", "")
                    content = msg.get("content", "")

                    if msg_type == "user":
                        text = _extract_text(content)
                        if text:
                            events.append(
                                ReplayEvent(
                                    timestamp=ts,
                                    agent_id=agent_id,
                                    agent_label=agent_label,
                                    event_type="task",
                                    content=text[:500],
                                )
                            )
                    elif msg_type == "assistant":
                        if isinstance(content, list):
                            for block in content:
                                if not isinstance(block, dict):
                                    continue
                                btype = block.get("type", "")
                                if btype == "text":
                                    text = block.get("text", "").strip()
                                    if text:
                                        events.append(
                                            ReplayEvent(
                                                timestamp=ts,
                                                agent_id=agent_id,
                                                agent_label=agent_label,
                                                event_type="message",
                                                content=text[:500],
                                                model=model,
                                            )
                                        )
                                elif btype == "tool_use":
                                    events.append(
                                        ReplayEvent(
                                            timestamp=ts,
                                            agent_id=agent_id,
                                            agent_label=agent_label,
                                            event_type="tool_use",
                                            tool_name=block.get("name", ""),
                                            content=_preview_tool_input(block.get("input", {})),
                                            model=model,
                                        )
                                    )
                        elif isinstance(content, str) and content.strip():
                            events.append(
                                ReplayEvent(
                                    timestamp=ts,
                                    agent_id=agent_id,
                                    agent_label=agent_label,
                                    event_type="message",
                                    content=content[:500],
                                    model=model,
                                )
                            )
        except OSError:
            continue

    events.sort(key=lambda e: e.timestamp)
    return events


def _find_subagents_dir(base: Path, session_id: str) -> Path | None:
    if not session_id or "/" in session_id or "\\" in session_id or ".." in session_id:
        return None

    resolved_base = base.resolve()
    for project_dir in base.iterdir():
        if not project_dir.is_dir():
            continue
        candidate = project_dir / session_id / "subagents"
        if not candidate.resolve().is_relative_to(resolved_base):
            continue
        if candidate.is_dir():
            return candidate
    return None


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return " ".join(parts).strip()
    return ""


def _preview_tool_input(inp: dict) -> str:
    if not isinstance(inp, dict):
        return ""
    if "file_path" in inp:
        return inp["file_path"]
    if "command" in inp:
        cmd = inp["command"]
        return cmd[:200] if isinstance(cmd, str) else ""
    if "pattern" in inp:
        return f'pattern: {inp["pattern"]}'
    if "query" in inp:
        return f'query: {inp["query"]}'
    return ""
