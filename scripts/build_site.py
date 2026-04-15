"""
build_site.py – Copy data/stars.json to site/public/data/stars.json for static publishing.

The dashboard reads data at runtime from site/public/data/stars.json.
This script ensures the published copy is in sync with the source of truth.
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "stars.json"
DST = ROOT / "site" / "public" / "data" / "stars.json"


def filter_public_repos(repos: list[dict]) -> list[dict]:
    """Filter out non-public repos, preserving old records with no visibility field."""
    return [r for r in repos if r.get("visibility", "public") == "public"]


def main() -> None:
    if not SRC.exists():
        print(f"ERROR: {SRC} does not exist. Run fetch_stars.py first.")
        raise SystemExit(1)

    DST.parent.mkdir(parents=True, exist_ok=True)

    with open(SRC, encoding="utf-8") as f:
        repos = json.load(f)

    public_repos = filter_public_repos(repos)
    excluded = len(repos) - len(public_repos)

    with open(DST, "w", encoding="utf-8") as f:
        json.dump(public_repos, f, indent=2, ensure_ascii=False)

    print(f"Copied {SRC} → {DST} ({len(public_repos)} repos, {excluded} excluded)")


if __name__ == "__main__":
    main()
