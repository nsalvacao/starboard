"""
discover_similar.py – Build topic-based discovery suggestions.

The script reads the canonical stars dataset, expands topics through the
curated synonym map in config.json, queries GitHub search for topic-based
matches, and writes both a canonical discovery dataset plus a public copy for
the static site.
"""

from __future__ import annotations

import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import requests

from fetch_stars import build_headers, get_token

GITHUB_API = "https://api.github.com"
ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "stars.json"
CONFIG_PATH = ROOT / "config.json"
DISCOVERY_PATH = ROOT / "data" / "discoveries.json"
PUBLIC_DISCOVERY_PATH = ROOT / "site" / "public" / "data" / "discoveries.json"

SEARCH_PER_PAGE = 10
MAX_QUERY_VARIANTS = 5
MAX_SUGGESTIONS_PER_SOURCE = 5
SEARCH_DELAY_SECONDS = 7.0
GENERIC_TOPICS = {
    "ai",
    "application",
    "automation",
    "awesome",
    "chatgpt",
    "cli",
    "development",
    "docs",
    "framework",
    "github",
    "language",
    "llm",
    "llms",
    "markdown",
    "open-source",
    "openai",
    "python",
    "software",
    "tool",
    "tools",
    "tooling",
    "typescript",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def build_topic_groups(topic_synonyms: dict[str, list[str]]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for anchor, synonyms in topic_synonyms.items():
        terms = [anchor, *synonyms]
        for term in terms:
            groups[term] = [term] + [item for item in terms if item != term]

    return groups


def topic_frequency(repos: list[dict]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for repo in repos:
        counts.update(repo.get("topics") or [])
    return counts


def score_topic(topic: str, frequencies: Counter[str], topic_groups: dict[str, list[str]]) -> float:
    freq = frequencies.get(topic, 0)
    generic_penalty = 500 if topic in GENERIC_TOPICS else 0
    group_bonus = 100 if len(topic_groups.get(topic, [])) > 1 else 0
    punctuation_bonus = 8 if "-" in topic else 0
    length_bonus = min(len(topic), 12)
    specificity = 1000 / (1 + freq)
    return specificity + group_bonus + punctuation_bonus + length_bonus - generic_penalty


def select_primary_topics(repo: dict, frequencies: Counter[str], topic_groups: dict[str, list[str]]) -> list[str]:
    topics = repo.get("topics") or []
    ranked = sorted(
        topics,
        key=lambda topic: (
            -score_topic(topic, frequencies, topic_groups),
            topic,
        ),
    )
    return ranked[:2]


def expand_topic(topic: str, topic_groups: dict[str, list[str]]) -> list[str]:
    return topic_groups.get(topic, [topic])


def build_query_variants(primary_topics: list[str], topic_groups: dict[str, list[str]]) -> list[tuple[str, ...]]:
    if not primary_topics:
        return []

    variants: list[tuple[str, ...]] = []

    if len(primary_topics) == 1:
        for term in expand_topic(primary_topics[0], topic_groups)[:MAX_QUERY_VARIANTS]:
            variants.append((term,))
    else:
        first, second = primary_topics[:2]
        variants.append((first, second))
        variants.append((first,))
        variants.append((second,))

        first_expanded = [term for term in expand_topic(first, topic_groups) if term != first]
        second_expanded = [term for term in expand_topic(second, topic_groups) if term != second]

        if first_expanded:
            variants.append((first_expanded[0],))
        if second_expanded:
            variants.append((second_expanded[0],))

    seen: set[tuple[str, ...]] = set()
    ordered: list[tuple[str, ...]] = []
    for variant in variants:
        if variant in seen:
            continue
        seen.add(variant)
        ordered.append(variant)
    return ordered[:MAX_QUERY_VARIANTS]


def query_string(terms: Iterable[str]) -> str:
    return " ".join(f"topic:{term}" for term in terms)


def _github_get(session: requests.Session, url: str, params: dict[str, object] | None = None) -> requests.Response:
    resp = session.get(url, params=params, timeout=30)
    if resp.status_code == 403 and "rate limit" in resp.text.lower():
        reset_ts = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
        wait = max(reset_ts - int(time.time()), 1) + 2
        print(f"  Rate limit hit. Waiting {wait}s …", file=sys.stderr)
        time.sleep(wait)
        resp = session.get(url, params=params, timeout=30)
    return resp


def search_repositories(session: requests.Session, topic_query: str) -> list[dict]:
    params = {
        "q": f"{topic_query} fork:false archived:false",
        "sort": "stars",
        "order": "desc",
        "per_page": SEARCH_PER_PAGE,
    }
    resp = _github_get(session, f"{GITHUB_API}/search/repositories", params=params)
    if not resp.ok:
        print(f"WARNING: search failed for {topic_query!r}: HTTP {resp.status_code}", file=sys.stderr)
        return []
    try:
        payload = resp.json()
    except ValueError:
        print(f"WARNING: search returned invalid JSON for {topic_query!r}", file=sys.stderr)
        return []
    items = payload.get("items", []) if isinstance(payload, dict) else []
    return [item for item in items if isinstance(item, dict)]


def normalize_candidate(item: dict, source_topics: set[str]) -> dict | None:
    full_name = item.get("full_name")
    html_url = item.get("html_url")
    if not isinstance(full_name, str) or not isinstance(html_url, str):
        return None

    topics = [topic for topic in (item.get("topics") or []) if isinstance(topic, str)]
    matched_topics = sorted(set(topics) & source_topics)
    if not matched_topics:
        return None

    return {
        "full_name": full_name,
        "html_url": html_url,
        "description": item.get("description") or "",
        "language": item.get("language"),
        "topics": topics,
        "stargazers_count": item.get("stargazers_count", 0),
        "forks_count": item.get("forks_count", 0),
        "visibility": item.get("visibility", "public"),
        "score": 0.0,
        "matched_topics": matched_topics,
        "query_terms": [],
    }


def score_candidate(candidate: dict, seed_topics: list[str], expanded_topics: set[str]) -> float:
    topics = set(candidate.get("topics") or [])
    matched_seeds = topics & set(seed_topics)
    matched_expanded = topics & expanded_topics
    stars = candidate.get("stargazers_count", 0) or 0
    forks = candidate.get("forks_count", 0) or 0
    return len(matched_seeds) * 1000 + len(matched_expanded) * 100 + stars / 1000 + forks / 10000


def build_discovery_entry(
    repo: dict,
    session: requests.Session,
    frequencies: Counter[str],
    topic_groups: dict[str, list[str]],
    starred_names: set[str],
) -> dict | None:
    primary_topics = select_primary_topics(repo, frequencies, topic_groups)
    if not primary_topics:
        return None

    expanded_topics = sorted(
        {
            topic
            for seed in primary_topics
            for topic in expand_topic(seed, topic_groups)
        }
    )
    queries = [query_string(variant) for variant in build_query_variants(primary_topics, topic_groups)]

    merged: dict[str, dict] = {}
    expanded_topic_set = set(expanded_topics)
    for index, query in enumerate(queries):
        for item in search_repositories(session, query):
            candidate = normalize_candidate(item, expanded_topic_set)
            if candidate is None:
                continue
            if candidate["full_name"] == repo["full_name"] or candidate["full_name"] in starred_names:
                continue
            candidate["score"] = score_candidate(candidate, primary_topics, expanded_topic_set)
            current = merged.get(candidate["full_name"])
            if current is None:
                current = candidate
                current["query_terms"] = [query]
                merged[candidate["full_name"]] = current
                continue

            current["score"] = max(current["score"], candidate["score"])
            current["matched_topics"] = sorted(set(current["matched_topics"]) | set(candidate["matched_topics"]))
            current["query_terms"] = sorted(set(current["query_terms"]) | {query})
            if candidate["stargazers_count"] > current["stargazers_count"]:
                current["stargazers_count"] = candidate["stargazers_count"]
                current["description"] = candidate["description"]
                current["language"] = candidate["language"]
                current["topics"] = candidate["topics"]
                current["forks_count"] = candidate["forks_count"]
                current["visibility"] = candidate["visibility"]
                current["html_url"] = candidate["html_url"]
        if index < len(queries) - 1:
            time.sleep(SEARCH_DELAY_SECONDS)

    suggestions = sorted(
        merged.values(),
        key=lambda candidate: (
            -candidate["score"],
            -candidate["stargazers_count"],
            candidate["full_name"],
        ),
    )[:MAX_SUGGESTIONS_PER_SOURCE]

    if not suggestions:
        return None

    source_score = score_topic(primary_topics[0], frequencies, topic_groups)
    if len(primary_topics) > 1:
        source_score += score_topic(primary_topics[1], frequencies, topic_groups)

    return {
        "source": {
            "full_name": repo["full_name"],
            "html_url": repo["html_url"],
            "description": repo.get("description") or "",
            "language": repo.get("language"),
            "topics": repo.get("topics") or [],
            "stargazers_count": repo.get("stargazers_count", 0),
            "forks_count": repo.get("forks_count", 0),
            "visibility": repo.get("visibility", "public"),
        },
        "seed_topics": primary_topics,
        "expanded_topics": expanded_topics,
        "queries": queries,
        "source_score": round(source_score, 3),
        "suggestions": suggestions,
    }


def build_public_dataset(dataset: dict) -> dict:
    public_entries: list[dict] = []
    for entry in dataset.get("entries", []):
        source = entry.get("source", {})
        if not isinstance(source, dict) or source.get("visibility") != "public":
            continue
        public_suggestions = [
            suggestion
            for suggestion in entry.get("suggestions", [])
            if isinstance(suggestion, dict) and suggestion.get("visibility") == "public"
        ]
        if not public_suggestions:
            continue
        public_entries.append({**entry, "suggestions": public_suggestions})

    public_source_repo_count = len(public_entries)

    return {
        "generated_at": dataset["generated_at"],
        "source_repo_count": dataset["source_repo_count"],
        "public_source_repo_count": public_source_repo_count,
        "entries": public_entries,
    }


def build_discovery_dataset(repos: list[dict], session: requests.Session, cfg: dict) -> dict:
    frequencies = topic_frequency(repos)
    topic_groups = build_topic_groups(cfg.get("topic_synonyms", {}))
    starred_names = {repo["full_name"] for repo in repos if isinstance(repo.get("full_name"), str)}

    ranked_sources: list[tuple[float, dict]] = []
    for repo in repos:
        if not isinstance(repo, dict) or not isinstance(repo.get("full_name"), str):
            continue
        primary_topics = select_primary_topics(repo, frequencies, topic_groups)
        if not primary_topics:
            continue
        source_score = score_topic(primary_topics[0], frequencies, topic_groups)
        if len(primary_topics) > 1:
            source_score += score_topic(primary_topics[1], frequencies, topic_groups)
        ranked_sources.append((source_score, repo))

    ranked_sources.sort(
        key=lambda item: (
            -item[0],
            -item[1].get("stargazers_count", 0),
            item[1]["full_name"],
        )
    )

    source_repo_limit = int(cfg.get("discovery", {}).get("source_repo_limit", 30))
    entries: list[dict] = []
    for _, repo in ranked_sources[:source_repo_limit]:
        entry = build_discovery_entry(repo, session, frequencies, topic_groups, starred_names)
        if entry is not None:
            entries.append(entry)

    entries.sort(
        key=lambda entry: (
            -entry["source_score"],
            -entry["source"]["stargazers_count"],
            entry["source"]["full_name"],
        )
    )

    return {
        "generated_at": utc_now(),
        "source_repo_count": len(repos),
        "entries": entries,
    }


def main() -> None:
    token = get_token()
    cfg = load_config()

    if not SRC.exists():
        print(f"ERROR: {SRC} does not exist. Run fetch_stars.py first.", file=sys.stderr)
        raise SystemExit(1)

    with open(SRC, encoding="utf-8") as f:
        repos = json.load(f)
    if not isinstance(repos, list):
        print(f"ERROR: {SRC} must contain a JSON array of repositories.", file=sys.stderr)
        raise SystemExit(1)

    session = requests.Session()
    session.headers.update(build_headers(token))

    dataset = build_discovery_dataset(repos, session, cfg)
    public_dataset = build_public_dataset(dataset)

    write_json(DISCOVERY_PATH, dataset)
    write_json(PUBLIC_DISCOVERY_PATH, public_dataset)

    print(
        f"Wrote discovery suggestions for {len(dataset['entries'])} source repos "
        f"({public_dataset['public_source_repo_count']} public) → {DISCOVERY_PATH} and {PUBLIC_DISCOVERY_PATH}"
    )


if __name__ == "__main__":
    main()
