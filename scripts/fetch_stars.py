"""
fetch_stars.py – Fetch all starred repositories for the authenticated GitHub user.

Writes data/stars.json as the canonical source of truth.
Includes public, private, and internal repos accessible to the token.
"""

import base64
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

GITHUB_API = "https://api.github.com"
STARS_PATH = Path(__file__).parent.parent / "data" / "stars.json"
PER_PAGE = 100


def content_hash(repo: dict) -> str:
    """Return an MD5 hex digest of the fields that influence LLM enrichment output.

    Only description, topics (sorted), language, and archived are included.
    Other fields (stargazers, pushed_at, etc.) are intentionally excluded — they
    change frequently but don't meaningfully change what an LLM would say about
    the repo's purpose or category.
    """
    relevant = {
        "description": repo.get("description") or "",
        "topics": sorted(repo.get("topics") or []),
        "language": repo.get("language") or "",
        "archived": repo.get("archived", False),
    }
    return hashlib.md5(json.dumps(relevant, sort_keys=True).encode()).hexdigest()


def _should_preserve_llm(fresh_hash: str, stored: dict, max_age_days: int = 30) -> tuple[bool, str]:
    """Decide whether stored LLM enrichment data should be preserved for a repo.

    Returns (should_preserve: bool, reason: str) where reason is one of:
        "ok"              — preserve: hash matches and data is fresh
        "content_changed" — re-enrich: description/topics/language/archived changed
        "no_date"         — re-enrich: no llm_enriched_at timestamp stored
        "aged_Nd"         — re-enrich: data is N days old (>= max_age_days)
    """
    if stored.get("llm_content_hash") != fresh_hash:
        return False, "content_changed"

    enriched_at_str = stored.get("llm_enriched_at")
    if not enriched_at_str:
        return False, "no_date"

    enriched_dt = datetime.fromisoformat(enriched_at_str.replace("Z", "+00:00"))
    days_since = (datetime.now(timezone.utc) - enriched_dt).days
    if days_since >= max_age_days:
        return False, f"aged_{days_since}d"

    return True, "ok"


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


def _safe_api_get(session: requests.Session, url: str) -> requests.Response | None:
    resp = session.get(url, timeout=15)
    if resp.status_code == 403 and "rate limit" in resp.text.lower():
        reset_ts = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
        wait = max(reset_ts - int(time.time()), 1) + 2
        print(f"  Rate limit hit. Waiting {wait}s …", file=sys.stderr)
        time.sleep(wait)
        resp = session.get(url, timeout=15)
    return resp


def enrich_extended_metadata(session: requests.Session, repo: dict) -> dict:
    """Fetch additional REST metadata (T2-T7) for a repo."""
    full_name = repo["full_name"]
    print(f"    Fetching extended metadata for {full_name} ...")
    
    r_lic = _safe_api_get(session, f"{GITHUB_API}/repos/{full_name}/license")
    if r_lic and r_lic.ok:
        repo["license_spdx"] = r_lic.json().get("license", {}).get("spdx_id")
        
    r_rel = _safe_api_get(session, f"{GITHUB_API}/repos/{full_name}/releases/latest")
    if r_rel and r_rel.ok:
        data = r_rel.json()
        repo["latest_release"] = {
            "tag": data.get("tag_name"),
            "date": data.get("published_at"),
            "url": data.get("html_url")
        }
        
    r_rm = _safe_api_get(session, f"{GITHUB_API}/repos/{full_name}/readme")
    if r_rm and r_rm.ok:
        content_b64 = r_rm.json().get("content", "")
        if content_b64:
            try:
                decoded = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                repo["readme_excerpt"] = decoded[:500]
            except Exception:
                pass

    r_cont = _safe_api_get(session, f"{GITHUB_API}/repos/{full_name}/contributors?per_page=1&anon=true")
    if r_cont and r_cont.ok:
        link = r_cont.headers.get("Link", "")
        m = re.search(r'[?&]page=(\d+)[^>]*>; rel="last"', link)
        if m:
            repo["contributor_count"] = int(m.group(1))
        else:
            repo["contributor_count"] = len(r_cont.json())
            
    url_ca = f"{GITHUB_API}/repos/{full_name}/stats/commit_activity"
    for _ in range(3):
        r_ca = _safe_api_get(session, url_ca)
        if r_ca and r_ca.status_code == 202:
            time.sleep(2)
            continue
        if r_ca and r_ca.ok:
            data = r_ca.json()
            if isinstance(data, list):
                repo["commit_activity_52w"] = [w.get("total", 0) for w in data][-52:]
        break
        
    r_ch = _safe_api_get(session, f"{GITHUB_API}/repos/{full_name}/community/profile")
    if r_ch and r_ch.ok:
        data = r_ch.json()
        files = data.get("files", {}) or {}
        repo["community_health"] = {
            "score": data.get("health_percentage", 0),
            "has_code_of_conduct": bool(files.get("code_of_conduct")),
            "has_contributing": bool(files.get("contributing")),
            "has_issue_template": bool(files.get("issue_template")),
            "has_pull_request_template": bool(files.get("pull_request_template")),
            "has_license": bool(files.get("license")),
            "has_readme": bool(files.get("readme")),
        }
        
    repo["cached_pushed_at"] = repo.get("pushed_at") or repo.get("updated_at")
    return repo


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
        "visibility": repo.get("visibility", "public"),
        "pushed_at": pushed_at,
        "updated_at": repo.get("updated_at"),
        "starred_at": starred_at,
        "days_since_push": days_since_push,
        "license_spdx": None,
        "latest_release": None,
        "readme_excerpt": None,
        "contributor_count": None,
        "commit_activity_52w": None,
        "community_health": None,
        "cached_pushed_at": None,
        # LLM fields – populated by enrich_stars.py
        "llm_category": None,
        "llm_summary": None,
        "llm_watch_note": None,
        "llm_model": None,
        "llm_status": None,
        "llm_enriched_at": None,
        "llm_content_hash": None,
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


PRESERVED_FIELDS = (
    "llm_category", "llm_summary", "llm_watch_note", "llm_model", "llm_status", "llm_enriched_at", "llm_content_hash",
    "license_spdx", "latest_release", "readme_excerpt", "contributor_count", "commit_activity_52w", "community_health", "cached_pushed_at"
)


def load_existing_data() -> dict[str, dict]:
    """Load preserved fields from the existing stars.json, keyed by full_name."""
    if not STARS_PATH.exists():
        return {}
    with open(STARS_PATH, encoding="utf-8") as f:
        existing = json.load(f)
    return {
        r["full_name"]: {k: r.get(k) for k in PRESERVED_FIELDS}
        for r in existing
    }


def main() -> None:
    token = get_token()
    cfg = load_config()

    existing_data = load_existing_data()
    if existing_data:
        print(f"Loaded existing data for {len(existing_data)} repos (will be preserved if applicable).")

    session = requests.Session()
    session.headers.update(build_headers(token))

    _reprocess_reasons: dict[str, int] = {}  # tracks why repos will be re-enriched

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
            
            current_push = repo.get("pushed_at") or repo.get("updated_at")
            if repo["full_name"] in existing_data:
                stored = existing_data[repo["full_name"]]
                
                # 1. Extended metadata caching strategy
                cached_push = stored.get("cached_pushed_at")
                if cached_push == current_push and current_push is not None:
                    repo.update({k: stored.get(k) for k in (
                        "license_spdx", "latest_release", "readme_excerpt", 
                        "contributor_count", "commit_activity_52w", "community_health", "cached_pushed_at"
                    )})
                else:
                    repo = enrich_extended_metadata(session, repo)
                    
                # 2. LLM caching strategy
                if stored.get("llm_status") == "ok":
                    fresh = content_hash(repo)
                    preserve, reason = _should_preserve_llm(fresh, stored, max_age_days=30)
                    if preserve:
                        repo.update({k: stored.get(k) for k in (
                            "llm_category", "llm_summary", "llm_watch_note", "llm_model", 
                            "llm_status", "llm_enriched_at", "llm_content_hash"
                        )})
                    else:
                        _reprocess_reasons[reason] = _reprocess_reasons.get(reason, 0) + 1
                else:
                    _reprocess_reasons["failed_previous"] = _reprocess_reasons.get("failed_previous", 0) + 1
            else:
                repo = enrich_extended_metadata(session, repo)
                _reprocess_reasons["new_repo"] = _reprocess_reasons.get("new_repo", 0) + 1
                
            # Always write the current content hash (reflects today's GitHub API data)
            repo["llm_content_hash"] = content_hash(repo)
            all_repos.append(repo)

    if _reprocess_reasons:
        total = sum(_reprocess_reasons.values())
        breakdown = ", ".join(f"{v} {k}" for k, v in sorted(_reprocess_reasons.items()))
        print(f"Re-enrichment queued: {total} repos ({breakdown})")
    else:
        print("All enriched repos preserved (no content changes, all < 30 days old).")

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
