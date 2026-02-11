from datetime import datetime, timezone, timedelta
from pathlib import Path


KST = timezone(timedelta(hours=9))

CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"
STATS_CACHE_PATH = CLAUDE_DIR / "stats-cache.json"

CACHE_TTL_SECONDS = 30

MODEL_PRICING = {
    "claude-opus-4-6": {
        "input": 15.0,
        "output": 75.0,
        "cache_read": 1.50,
        "cache_creation": 18.75,
        "display_name": "Opus 4.6",
    },
    "claude-opus-4-5-20251101": {
        "input": 15.0,
        "output": 75.0,
        "cache_read": 1.50,
        "cache_creation": 18.75,
        "display_name": "Opus 4.5",
    },
    "claude-sonnet-4-5-20250929": {
        "input": 3.0,
        "output": 15.0,
        "cache_read": 0.30,
        "cache_creation": 3.75,
        "display_name": "Sonnet 4.5",
    },
    "claude-haiku-4-5-20251001": {
        "input": 0.80,
        "output": 4.0,
        "cache_read": 0.08,
        "cache_creation": 1.0,
        "display_name": "Haiku 4.5",
    },
}

DEFAULT_PRICING = {
    "input": 15.0,
    "output": 75.0,
    "cache_read": 1.50,
    "cache_creation": 18.75,
    "display_name": "Unknown",
}


def get_model_pricing(model_id: str) -> dict:
    for key, pricing in MODEL_PRICING.items():
        if key in model_id:
            return pricing
    return DEFAULT_PRICING


def get_model_display_name(model_id: str) -> str:
    return get_model_pricing(model_id)["display_name"]


def now_kst() -> str:
    return datetime.now(KST).strftime("%H:%M:%S")


def utc_to_kst(iso_str: str | None, fmt: str = "%Y-%m-%d %H:%M") -> str:
    if not iso_str or len(iso_str) < 16:
        return iso_str or ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.astimezone(KST).strftime(fmt)
    except (ValueError, TypeError):
        return iso_str
