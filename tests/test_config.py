import re

from app.config import now_kst, utc_to_kst


def test_utc_to_kst_iso_z():
    result = utc_to_kst("2026-01-10T10:00:01.000Z")
    assert result == "2026-01-10 19:00"


def test_utc_to_kst_iso_offset():
    result = utc_to_kst("2026-01-10T10:00:01.000+00:00")
    assert result == "2026-01-10 19:00"


def test_utc_to_kst_date_only_format():
    result = utc_to_kst("2026-01-10T15:30:00.000Z", fmt="%Y-%m-%d")
    assert result == "2026-01-11"


def test_utc_to_kst_custom_format():
    result = utc_to_kst("2026-01-10T15:30:00.000Z", fmt="%H:%M")
    assert result == "00:30"


def test_utc_to_kst_none():
    assert utc_to_kst(None) == ""


def test_utc_to_kst_empty():
    assert utc_to_kst("") == ""


def test_utc_to_kst_short_string():
    assert utc_to_kst("2026") == "2026"


def test_utc_to_kst_invalid():
    assert utc_to_kst("not-a-date-at-all") == "not-a-date-at-all"


def test_now_kst_format():
    result = now_kst()
    assert re.match(r"\d{2}:\d{2}:\d{2}", result)
