# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- 사용자의 의견에 대한 평가와 답변을 할 때 아첨하지말고, 비판적인 시각으로 의견을 제시해줘.
- 모든 작업에서 테스트 코드를 작성하고, 테스트를 실행해줘.
- 테스트가 실패하면 수정사항이 있다면 수정해줘.

## Commands

```bash
uv sync                                        # Install dependencies
uv run uvicorn main:app --reload --port 8000   # Dev server (hot reload)
uv run pytest tests/ -v                        # Run all tests
uv run pytest tests/test_log_parser.py::test_raw_to_message_user -v  # Single test
```

## Architecture

FastAPI + Jinja2 server-rendered dashboard that reads Claude Code JSONL session logs from `~/.claude/projects/` and `~/.claude/stats-cache.json`. No database — all data is parsed from files on each request (with 30s TTL in-memory cache). Frontend uses Tailwind CSS, Chart.js, and HTMX via CDN (no build step).

### Data flow

1. **Data sources** (`~/.claude/`): `stats-cache.json` for pre-aggregated overview stats; `projects/**/*.jsonl` for per-session conversation logs
2. **Services** (`app/services/`): Parse and aggregate data. All expensive service functions are decorated with `@ttl_cache(ttl_seconds=30)` from `app/services/cache.py`
3. **Routers** (`app/routers/`): Each router checks `HX-Request` header — returns full page (with `base.html`) for normal requests, partial HTML fragment for HTMX polling requests
4. **Templates**: Each page has a full template (`app/templates/<page>.html`) that `{% include %}`s a partial (`app/templates/partials/<page>_content.html`). Partials contain inline `<script>` tags for Chart.js initialization

### Real-time update pattern

Every page auto-refreshes via HTMX polling (`hx-trigger="every 30s"`). The `base.html` has a `htmx:beforeSwap` listener that destroys Chart.js instances before swap to prevent memory leaks. Each chart helper in `static/js/charts.js` also calls `destroyIfExists()` defensively.

**Key constraint**: `static/js/charts.js` must load in `<head>` (before content) because partial templates contain inline scripts that call its functions immediately.

### JSONL message types

The log parser (`app/services/log_parser.py`) processes three types from JSONL: `user`, `assistant`, `system`. It skips `file-history-snapshot`. Key fields on `assistant` messages: `message.model`, `message.usage` (token counts), `message.content[]` (may contain `text`, `thinking`, `tool_use` blocks).

### All models are frozen dataclasses

`app/models/schemas.py` uses `@dataclass(frozen=True)` throughout. Collections use `tuple` (not `list`) for immutability. When passing dataclasses to Jinja2's `tojson` filter, use `dataclasses.asdict()` in the router first — nested frozen dataclasses are not JSON-serializable.

## Model pricing

Defined in `app/config.py` `MODEL_PRICING` dict (per 1M tokens). When new Claude models are released, add entries there. The `get_model_pricing()` function does substring matching on model IDs, so partial IDs work.
