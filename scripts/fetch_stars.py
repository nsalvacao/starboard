"""
fetch_stars.py – Fetch all starred repositories for the authenticated GitHub user.

Writes data/stars.json as the canonical source of truth.
Includes public, private, and internal repos accessible to the token.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

GITHUB_API = "https://api.github.com"
STARS_PATH = Path(__file__).parent.parent / "data" / "stars.json"
PER_PAGE = 100


def get_token() -> str:
    token = os.environ.get("GH_STARS_PAT") or os.environ.get("GITHUB_TOKEN", "")
    if not token:
        print("ERROR: GH_STARS_PAT (or GITHUB_TOKEN) environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return token


def build_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.star+json",  # includes starred_at
        "X-GitHub-Api-Version": "2022-11-28",
    }


def fetch_page(session: requests.Session, url: str) -> tuple[list, str | None]:
    """Fetch one page of starred repos; return (items, next_url)."""
    resp = session.get(url, timeout=30)

    if resp.status_code == 403 and "rate limit" in resp.text.lower():
        reset_ts = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
        wait = max(reset_ts - int(time.time()), 1) + 2
        print(f"  Rate limit hit. Waiting {wait}s …", file=sys.stderr)
        time.sleep(wait)
        resp = session.get(url, timeout=30)

    if not resp.ok:
        print(f"ERROR: HTTP {resp.status_code} fetching {url}", file=sys.stderr)
        print(resp.text[:500], file=sys.stderr)
        sys.exit(1)

    items = resp.json()
    next_url = None
    link_header = resp.headers.get("Link", "")
    for part in link_header.split(","):
        if 'rel="next"' in part:
            next_url = part.split(";")[0].strip().strip("<>")
            break

    return items, next_url


def normalize_repo(item: dict) -> dict:
    """Extract only the fields we actually use."""
    repo = item.get("repo", item)  # star+json wraps repo under "repo"
    starred_at = item.get("starred_at") or repo.get("starred_at")

    pushed_at = repo.get("pushed_at")
    now = datetime.now(timezone.utc)
    days_since_push: int | None = None
    if pushed_at:
        pushed_dt = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
        days_since_push = (now - pushed_dt).days

    return {
        "full_name": repo["full_name"],
        "html_url": repo["html_url"],
        "description": repo.get("description") or "",
        "language": repo.get("language"),
        "topics": repo.get("topics", []),
        "stargazers_count": repo.get("stargazers_count", 0),
        "forks_count": repo.get("forks_count", 0),
        "open_issues_count": repo.get("open_issues_count", 0),
        "archived": repo.get("archived", False),
        "fork": repo.get("fork", False),
        "default_branch": repo.get("default_branch", "main"),
        "pushed_at": pushed_at,
        "updated_at": repo.get("updated_at"),
        "starred_at": starred_at,
        "days_since_push": days_since_push,
        # LLM fields – populated by enrich_stars.py
        "llm_category": None,
        "llm_summary": None,
        "llm_watch_note": None,
        "llm_model": None,
        "llm_status": None,
        "llm_enriched_at": None,
    }


def apply_heuristics(repo: dict, cfg: dict) -> dict:
    """Add boolean heuristic fields based on config thresholds."""
    h = cfg["heuristics"]
    now = datetime.now(timezone.utc)

    starred_at = repo.get("starred_at")
    recent_star = False
    if starred_at:
        dt = datetime.fromisoformat(starred_at.replace("Z", "+00:00"))
        recent_star = (now - dt).days <= h["recent_star_days"]

    days = repo.get("days_since_push")
    recent_activity = days is not None and days <= h["recent_activity_days"]
    stale = days is None or days > h["stale_days"]

    repo["recent_star"] = recent_star
    repo["recent_activity"] = recent_activity
    repo["stale"] = stale
    repo["watch_candidate"] = not repo["archived"] and recent_activity
    repo["cleanup_candidate"] = repo["archived"] or stale
    return repo


def load_config() -> dict:
    config_path = Path(__file__).parent.parent / "config.json"
    with open(config_path) as f:
        return json.load(f)


LLM_FIELDS = ("llm_category", "llm_summary", "llm_watch_note", "llm_model", "llm_status", "llm_enriched_at")


def load_existing_llm_data() -> dict[str, dict]:
    """Load LLM enrichment fields from the existing stars.json, keyed by full_name."""
    if not STARS_PATH.exists():
        return {}
    with open(STARS_PATH, encoding="utf-8") as f:
        existing = json.load(f)
    return {
        r["full_name"]: {k: r.get(k) for k in LLM_FIELDS}
        for r in existing
        if r.get("llm_status") == "ok"
    }


def main() -> None:
    token = get_token()
    cfg = load_config()

    # Preserve existing LLM enrichment so enrich_stars.py only processes new/unenriched repos
    existing_llm = load_existing_llm_data()
    if existing_llm:
        print(f"Loaded existing LLM data for {len(existing_llm)} repos (will be preserved).")

    session = requests.Session()
    session.headers.update(build_headers(token))

    url = f"{GITHUB_API}/user/starred?per_page={PER_PAGE}&direction=desc"
    all_repos: list[dict] = []
    page_num = 0

    print("Fetching starred repositories …")
    while url:
        page_num += 1
        print(f"  Page {page_num}: {url}")
        items, url = fetch_page(session, url)
        for item in items:
            repo = normalize_repo(item)
            repo = apply_heuristics(repo, cfg)
            # Restore prior LLM enrichment if available
            if repo["full_name"] in existing_llm:
                repo.update(existing_llm[repo["full_name"]])
            all_repos.append(repo)

    # Sort by starred_at descending (most recently starred first)
    all_repos.sort(key=lambda r: r.get("starred_at") or "", reverse=True)

    STARS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STARS_PATH, "w", encoding="utf-8") as f:
        json.dump(all_repos, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(all_repos)} repos written to {STARS_PATH}")

    # Warn about private/internal repos that will be published
    non_public = [r for r in all_repos if r["full_name"].startswith("private/") or "private" in r["html_url"]]
    # We cannot distinguish visibility from the star API without extra calls,
    # so we emit a general reminder instead.
    print(
        "\nNOTE: data/stars.json may include private or internal repositories "
        "accessible to your token. Review before publishing to GitHub Pages."
    )


if __name__ == "__main__":
    main()
