from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0

    @property
    def total(self) -> int:
        return (
            self.input_tokens
            + self.output_tokens
            + self.cache_read_input_tokens
            + self.cache_creation_input_tokens
        )


@dataclass(frozen=True)
class ToolCall:
    name: str
    tool_use_id: str
    input_preview: str = ""


@dataclass(frozen=True)
class Message:
    msg_type: str
    role: str
    content_text: str = ""
    model: str = ""
    usage: TokenUsage = field(default_factory=TokenUsage)
    tool_calls: tuple[ToolCall, ...] = ()
    timestamp: str = ""
    uuid: str = ""
    is_meta: bool = False
    subtype: str = ""
    duration_ms: int = 0


@dataclass(frozen=True)
class SessionInfo:
    session_id: str
    project_path: str
    project_name: str
    file_path: str
    first_timestamp: str = ""
    last_timestamp: str = ""
    message_count: int = 0
    total_usage: TokenUsage = field(default_factory=TokenUsage)
    models_used: tuple[str, ...] = ()
    tool_calls_count: int = 0
    tool_names: tuple[str, ...] = ()
    git_branch: str = ""
    version: str = ""


@dataclass(frozen=True)
class DailyActivity:
    date: str
    message_count: int = 0
    session_count: int = 0
    tool_call_count: int = 0


@dataclass(frozen=True)
class ModelUsageStats:
    model_id: str
    display_name: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cost_usd: float = 0.0


@dataclass(frozen=True)
class LongestSession:
    session_id: str = ""
    duration_hours: float = 0.0
    message_count: int = 0


@dataclass(frozen=True)
class OverviewStats:
    total_sessions: int = 0
    total_messages: int = 0
    total_tool_calls: int = 0
    first_session_date: str = ""
    daily_activity: tuple[DailyActivity, ...] = ()
    model_usage: tuple[ModelUsageStats, ...] = ()
    hour_counts: dict[str, int] = field(default_factory=dict)
    total_cost_usd: float = 0.0
    longest_session: LongestSession = field(default_factory=LongestSession)
    avg_messages_per_session: float = 0.0
    active_days: int = 0


@dataclass(frozen=True)
class ProjectStats:
    project_path: str
    project_name: str
    session_count: int = 0
    total_messages: int = 0
    total_usage: TokenUsage = field(default_factory=TokenUsage)
    total_cost_usd: float = 0.0
    tool_calls_count: int = 0
    models_used: tuple[str, ...] = ()
    last_activity: str = ""


@dataclass(frozen=True)
class TeamMember:
    name: str
    agent_id: str = ""
    agent_type: str = ""


@dataclass(frozen=True)
class Team:
    team_name: str
    members: tuple[TeamMember, ...] = ()


@dataclass(frozen=True)
class TaskItem:
    id: str
    subject: str
    status: str
    description: str = ""
    active_form: str = ""
    blocks: tuple[str, ...] = ()
    blocked_by: tuple[str, ...] = ()


@dataclass(frozen=True)
class TaskList:
    list_id: str
    tasks: tuple[TaskItem, ...] = ()
    last_modified: str = ""


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    description: str
    tools: tuple[str, ...] = ()
    model: str = ""


@dataclass(frozen=True)
class SubagentActivity:
    session_id: str
    agent_id: str
    project_name: str
    message_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    tools_used: tuple[str, ...] = ()
    first_timestamp: str = ""
    last_timestamp: str = ""
    model: str = ""


@dataclass(frozen=True)
class AgentStats:
    agent_name: str
    description: str = ""
    invocation_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    tool_counts: tuple[tuple[str, int], ...] = ()
    model: str = ""


@dataclass(frozen=True)
class ReplayEvent:
    timestamp: str
    agent_id: str
    agent_label: str
    event_type: str
    content: str = ""
    tool_name: str = ""
    model: str = ""


@dataclass(frozen=True)
class TeamSession:
    session_id: str
    project_name: str
    agent_count: int = 0
    message_count: int = 0
    first_timestamp: str = ""
    last_timestamp: str = ""
    agent_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class LiveEvent:
    timestamp: str
    project_name: str
    session_id: str
    msg_type: str
    content_preview: str
    tool_calls: tuple[str, ...] = ()
    output_tokens: int = 0
    duration_ms: int = 0
    model: str = ""
