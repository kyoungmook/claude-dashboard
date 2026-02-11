import json
from pathlib import Path

import pytest

from app.models.schemas import TaskItem, TaskList, Team, TeamMember
from app.services.cache import clear_all_caches
from app.services.task_service import (
    _dir_mtime_kst,
    _load_task_list,
    _parse_task_file,
    get_active_teams,
    get_all_task_lists,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_all_caches()
    yield
    clear_all_caches()


@pytest.fixture
def tasks_dir(tmp_path):
    return tmp_path / "tasks"


@pytest.fixture
def teams_dir(tmp_path):
    return tmp_path / "teams"


def _write_task(dir_path: Path, task_id: str, data: dict):
    dir_path.mkdir(parents=True, exist_ok=True)
    (dir_path / f"{task_id}.json").write_text(json.dumps(data), encoding="utf-8")


class TestParseTaskFile:
    def test_valid_task(self, tmp_path):
        data = {
            "id": "1",
            "subject": "Do something",
            "status": "pending",
            "description": "Details here",
            "activeForm": "Doing something",
            "blocks": ["2"],
            "blockedBy": [],
        }
        path = tmp_path / "1.json"
        path.write_text(json.dumps(data), encoding="utf-8")

        result = _parse_task_file(path)
        assert result is not None
        assert result.id == "1"
        assert result.subject == "Do something"
        assert result.status == "pending"
        assert result.description == "Details here"
        assert result.active_form == "Doing something"
        assert result.blocks == ("2",)
        assert result.blocked_by == ()

    def test_minimal_task(self, tmp_path):
        data = {"id": "5", "subject": "Minimal"}
        path = tmp_path / "5.json"
        path.write_text(json.dumps(data), encoding="utf-8")

        result = _parse_task_file(path)
        assert result is not None
        assert result.id == "5"
        assert result.status == "pending"
        assert result.blocks == ()

    def test_invalid_json(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text("not json", encoding="utf-8")

        result = _parse_task_file(path)
        assert result is None

    def test_missing_id(self, tmp_path):
        path = tmp_path / "no_id.json"
        path.write_text(json.dumps({"subject": "No id"}), encoding="utf-8")

        result = _parse_task_file(path)
        assert result is None


class TestLoadTaskList:
    def test_loads_tasks_sorted_by_filename(self, tmp_path):
        list_dir = tmp_path / "abc-123"
        _write_task(list_dir, "2", {"id": "2", "subject": "Second", "status": "pending"})
        _write_task(list_dir, "1", {"id": "1", "subject": "First", "status": "completed"})

        result = _load_task_list(list_dir)
        assert result is not None
        assert result.list_id == "abc-123"
        assert len(result.tasks) == 2
        assert result.tasks[0].id == "1"
        assert result.tasks[1].id == "2"

    def test_empty_dir_returns_none(self, tmp_path):
        list_dir = tmp_path / "empty"
        list_dir.mkdir()

        result = _load_task_list(list_dir)
        assert result is None

    def test_skips_invalid_files(self, tmp_path):
        list_dir = tmp_path / "mixed"
        list_dir.mkdir()
        _write_task(list_dir, "1", {"id": "1", "subject": "Good"})
        (list_dir / "2.json").write_text("broken", encoding="utf-8")

        result = _load_task_list(list_dir)
        assert result is not None
        assert len(result.tasks) == 1


class TestGetAllTaskLists:
    def test_returns_sorted_by_mtime_desc(self, tasks_dir):
        tasks_dir.mkdir()

        dir_a = tasks_dir / "aaa"
        _write_task(dir_a, "1", {"id": "1", "subject": "A task"})

        dir_b = tasks_dir / "bbb"
        _write_task(dir_b, "1", {"id": "1", "subject": "B task"})

        result = get_all_task_lists(tasks_dir=str(tasks_dir))
        assert len(result) == 2
        assert result[0].last_modified >= result[1].last_modified

    def test_filters_empty_dirs(self, tasks_dir):
        tasks_dir.mkdir()
        (tasks_dir / "empty").mkdir()
        _write_task(tasks_dir / "has-tasks", "1", {"id": "1", "subject": "Task"})

        result = get_all_task_lists(tasks_dir=str(tasks_dir))
        assert len(result) == 1
        assert result[0].list_id == "has-tasks"

    def test_nonexistent_dir(self, tmp_path):
        result = get_all_task_lists(tasks_dir=str(tmp_path / "nope"))
        assert result == []


class TestGetActiveTeams:
    def test_loads_team_config(self, teams_dir):
        teams_dir.mkdir()
        team_dir = teams_dir / "my-team"
        team_dir.mkdir()
        config = {
            "members": [
                {"name": "lead", "agentId": "uuid1", "agentType": "general-purpose"},
                {"name": "worker", "agentId": "uuid2", "agentType": "Bash"},
            ]
        }
        (team_dir / "config.json").write_text(json.dumps(config), encoding="utf-8")

        result = get_active_teams(teams_dir=str(teams_dir))
        assert len(result) == 1
        assert isinstance(result[0], Team)
        assert result[0].team_name == "my-team"
        assert len(result[0].members) == 2
        assert isinstance(result[0].members[0], TeamMember)
        assert result[0].members[0].name == "lead"
        assert result[0].members[0].agent_type == "general-purpose"

    def test_skips_dir_without_config(self, teams_dir):
        teams_dir.mkdir()
        (teams_dir / "no-config").mkdir()

        result = get_active_teams(teams_dir=str(teams_dir))
        assert result == []

    def test_nonexistent_dir(self, tmp_path):
        result = get_active_teams(teams_dir=str(tmp_path / "nope"))
        assert result == []

    def test_invalid_config_json(self, teams_dir):
        teams_dir.mkdir()
        team_dir = teams_dir / "bad-team"
        team_dir.mkdir()
        (team_dir / "config.json").write_text("not json", encoding="utf-8")

        result = get_active_teams(teams_dir=str(teams_dir))
        assert result == []


class TestDirMtimeKst:
    def test_returns_formatted_string(self, tmp_path):
        result = _dir_mtime_kst(tmp_path)
        assert len(result) == 19  # YYYY-MM-DD HH:MM:SS

    def test_nonexistent_path(self, tmp_path):
        result = _dir_mtime_kst(tmp_path / "nonexistent")
        assert result == ""
