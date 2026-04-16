"""
build_history.py – Build daily public history snapshots for analytics.

Reads data/stars.json, filters to public repositories, and writes a canonical
history dataset plus a public copy for the static site.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from build_site import filter_public_repos

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "stars.json"
HISTORY_PATH = ROOT / "data" / "history.json"
PUBLIC_HISTORY_PATH = ROOT / "site" / "public" / "data" / "history.json"


def utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def build_daily_snapshot(repos: list[dict], snapshot_date: str | None = None) -> dict:
    public_repos = filter_public_repos(repos)
    return {
        "date": snapshot_date or utc_today(),
        "repos": [
            {
                "full_name": repo["full_name"],
                "stargazers_count": repo.get("stargazers_count", 0),
                "forks_count": repo.get("forks_count", 0),
            }
            for repo in sorted(public_repos, key=lambda repo: repo["full_name"])
        ],
    }


def merge_history_snapshots(existing: list[dict], snapshot: dict) -> list[dict]:
    merged_by_date = {
        entry["date"]: entry
        for entry in existing
        if isinstance(entry, dict) and entry.get("date")
    }
    merged_by_date[snapshot["date"]] = snapshot
    return [merged_by_date[date] for date in sorted(merged_by_date)]


def load_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON array of snapshots")
    return data


def write_json(path: Path, payload: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def main() -> None:
    if not SRC.exists():
        print(f"ERROR: {SRC} does not exist. Run fetch_stars.py first.", file=sys.stderr)
        raise SystemExit(1)

    with open(SRC, encoding="utf-8") as f:
        repos = json.load(f)

    snapshot = build_daily_snapshot(repos)
    existing = load_json(HISTORY_PATH)
    history = merge_history_snapshots(existing, snapshot)

    write_json(HISTORY_PATH, history)
    write_json(PUBLIC_HISTORY_PATH, history)

    public_repo_count = len(snapshot["repos"])
    print(
        f"Wrote daily history snapshot for {snapshot['date']} "
        f"({public_repo_count} public repos) → {HISTORY_PATH} and {PUBLIC_HISTORY_PATH}"
    )


if __name__ == "__main__":
    main()
