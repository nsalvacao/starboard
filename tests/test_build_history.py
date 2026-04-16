"""Unit tests for the daily history snapshot pipeline."""

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import build_history


def make_repo(full_name: str, visibility: str = "public", stars: int = 10, forks: int = 2) -> dict:
    return {
        "full_name": full_name,
        "stargazers_count": stars,
        "forks_count": forks,
        "visibility": visibility,
    }


def test_build_daily_snapshot_filters_public_and_sorts_repos():
    snapshot = build_history.build_daily_snapshot(
        [
            make_repo("z/private", visibility="private", stars=1, forks=1),
            make_repo("b/repo", stars=20, forks=5),
            make_repo("a/repo", stars=10, forks=3),
        ],
        snapshot_date="2026-04-16",
    )

    assert snapshot == {
        "date": "2026-04-16",
        "repos": [
            {"full_name": "a/repo", "stargazers_count": 10, "forks_count": 3},
            {"full_name": "b/repo", "stargazers_count": 20, "forks_count": 5},
        ],
    }


def test_merge_history_snapshots_replaces_same_day_and_keeps_sort_order():
    existing = [
        {"date": "2026-04-14", "repos": [make_repo("a/repo")]},
        {"date": "2026-04-16", "repos": [make_repo("old/repo")]},
    ]
    replacement = {"date": "2026-04-16", "repos": [make_repo("new/repo")]}

    merged = build_history.merge_history_snapshots(existing, replacement)

    assert [entry["date"] for entry in merged] == ["2026-04-14", "2026-04-16"]
    assert merged[-1]["repos"] == [make_repo("new/repo")]


def test_main_writes_canonical_and_public_history(tmp_path, monkeypatch):
    stars_path = tmp_path / "stars.json"
    history_path = tmp_path / "history.json"
    public_history_path = tmp_path / "site" / "public" / "data" / "history.json"

    stars_path.write_text(
        json.dumps([
            make_repo("a/repo", stars=10, forks=1),
            make_repo("private/repo", visibility="private", stars=99, forks=9),
        ]),
        encoding="utf-8",
    )

    monkeypatch.setattr(build_history, "SRC", stars_path)
    monkeypatch.setattr(build_history, "HISTORY_PATH", history_path)
    monkeypatch.setattr(build_history, "PUBLIC_HISTORY_PATH", public_history_path)
    monkeypatch.setattr(build_history, "utc_today", lambda: "2026-04-16")

    build_history.main()

    canonical = json.loads(history_path.read_text(encoding="utf-8"))
    published = json.loads(public_history_path.read_text(encoding="utf-8"))

    assert canonical == [
        {
            "date": "2026-04-16",
            "repos": [
                {"full_name": "a/repo", "stargazers_count": 10, "forks_count": 1},
            ],
        }
    ]
    assert published == canonical


def test_main_replaces_existing_day_snapshot(tmp_path, monkeypatch):
    stars_path = tmp_path / "stars.json"
    history_path = tmp_path / "history.json"
    public_history_path = tmp_path / "site" / "public" / "data" / "history.json"

    stars_path.write_text(json.dumps([make_repo("a/repo", stars=12, forks=4)]), encoding="utf-8")
    history_path.write_text(
        json.dumps([
            {
                "date": "2026-04-16",
                "repos": [make_repo("a/repo", stars=1, forks=1)],
            }
        ]),
        encoding="utf-8",
    )

    monkeypatch.setattr(build_history, "SRC", stars_path)
    monkeypatch.setattr(build_history, "HISTORY_PATH", history_path)
    monkeypatch.setattr(build_history, "PUBLIC_HISTORY_PATH", public_history_path)
    monkeypatch.setattr(build_history, "utc_today", lambda: "2026-04-16")

    build_history.main()

    canonical = json.loads(history_path.read_text(encoding="utf-8"))
    assert canonical == [
        {
            "date": "2026-04-16",
            "repos": [
                {"full_name": "a/repo", "stargazers_count": 12, "forks_count": 4},
            ],
        }
    ]


def test_load_json_returns_empty_list_for_invalid_json(tmp_path):
    invalid = tmp_path / "history.json"
    invalid.write_text("", encoding="utf-8")

    assert build_history.load_json(invalid) == []


def test_filter_public_repos_requires_visibility():
    with pytest.raises(SystemExit):
        build_history.build_daily_snapshot([{"full_name": "missing/visibility"}], snapshot_date="2026-04-16")
