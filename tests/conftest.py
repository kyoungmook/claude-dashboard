from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_jsonl_path():
    return FIXTURES_DIR / "sample.jsonl"
