"""
build_site.py – Copy data/stars.json to site/data/stars.json for static publishing.

The dashboard reads data at runtime from site/data/stars.json.
This script ensures the published copy is in sync with the source of truth.
"""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "stars.json"
DST = ROOT / "site" / "public" / "data" / "stars.json"


def main() -> None:
    if not SRC.exists():
        print(f"ERROR: {SRC} does not exist. Run fetch_stars.py first.")
        raise SystemExit(1)

    DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SRC, DST)

    with open(DST, encoding="utf-8") as f:
        repos = json.load(f)

    print(f"Copied {SRC} → {DST} ({len(repos)} repos)")


if __name__ == "__main__":
    main()
