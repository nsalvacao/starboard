"""
build_site.py – Write a privacy-filtered stars dataset for static publishing.

The dashboard reads data at runtime from site/public/data/stars.json.
This script keeps the published copy in sync with the source of truth while
excluding non-public repositories.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "stars.json"
DST = ROOT / "site" / "public" / "data" / "stars.json"


def filter_public_repos(repos: list[dict]) -> list[dict]:
    """Filter out non-public repos and fail when visibility metadata is missing."""
    missing_visibility = [r.get("full_name", "<unknown>") for r in repos if "visibility" not in r]
    if missing_visibility:
        sample = ", ".join(missing_visibility[:5])
        more = "" if len(missing_visibility) <= 5 else f" (and {len(missing_visibility) - 5} more)"
        print(
            "ERROR: Refusing to publish stars.json because some repository entries are missing "
            f"'visibility' metadata: {sample}{more}. Re-run fetch_stars.py before publishing.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return [r for r in repos if r.get("visibility") == "public"]


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

    print(
        f"Wrote filtered dataset {SRC} → {DST} "
        f"({len(public_repos)} public repos, {excluded} non-public repos excluded)"
    )


if __name__ == "__main__":
    main()
