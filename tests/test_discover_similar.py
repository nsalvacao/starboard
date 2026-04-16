"""Unit tests for the topic-based discovery pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import discover_similar


def make_repo(
    full_name: str,
    topics: list[str],
    stars: int = 100,
    visibility: str = "public",
    archived: bool = False,
) -> dict:
    return {
        "full_name": full_name,
        "html_url": f"https://github.com/{full_name}",
        "description": f"Description for {full_name}",
        "language": "TypeScript",
        "topics": topics,
        "stargazers_count": stars,
        "forks_count": stars // 10,
        "visibility": visibility,
        "archived": archived,
    }


class FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200, text: str | None = None):
        self._payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = text or json.dumps(payload)
        self.headers = {}

    def json(self) -> dict:
        return self._payload


class FakeSession:
    def __init__(self, responses: dict[str, list[FakeResponse]]):
        self.responses = responses
        self.headers = {}

    def get(self, url: str, params=None, timeout: int = 30):  # noqa: ANN001
        query = (params or {}).get("q", "")
        queue = self.responses.setdefault(query, [])
        if not queue:
            return FakeResponse({"items": []})
        return queue.pop(0)


def test_build_topic_groups_expands_synonyms_bidirectionally():
    groups = discover_similar.build_topic_groups(
        {
            "claude-code": ["gemini-cli", "codex-cli"],
            "mcp": ["mcp-server", "mcp-tools"],
        }
    )

    assert groups["claude-code"] == ["claude-code", "gemini-cli", "codex-cli"]
    assert groups["gemini-cli"] == ["gemini-cli", "claude-code", "codex-cli"]
    assert groups["mcp"] == ["mcp", "mcp-server", "mcp-tools"]


def test_select_primary_topics_prefers_specific_topics():
    frequencies = discover_similar.topic_frequency(
        [
            make_repo("a/one", ["ai", "claude-code", "mcp"]),
            make_repo("b/two", ["ai", "llm", "python"]),
            make_repo("c/three", ["ai", "mcp"]),
        ]
    )
    groups = discover_similar.build_topic_groups({"claude-code": ["gemini-cli"], "mcp": ["mcp-server"]})

    primary = discover_similar.select_primary_topics(
        make_repo("owner/repo", ["ai", "claude-code", "mcp", "python"]),
        frequencies,
        groups,
    )

    assert primary == ["claude-code", "mcp"]


def test_build_query_variants_include_synonym_fallbacks():
    groups = discover_similar.build_topic_groups({"claude-code": ["gemini-cli", "codex-cli"], "mcp": ["mcp-server"]})

    variants = discover_similar.build_query_variants(["claude-code", "mcp"], groups)

    assert variants[0] == ("claude-code", "mcp")
    assert ("claude-code",) in variants
    assert ("mcp",) in variants
    assert ("gemini-cli",) in variants
    assert ("mcp-server",) in variants


def test_build_discovery_entry_merges_duplicate_candidates_and_skips_starred_repos():
    groups = discover_similar.build_topic_groups({"claude-code": ["gemini-cli"], "mcp": ["mcp-server"]})
    repos = [
        make_repo("owner/source", ["claude-code", "mcp"], stars=120),
        make_repo("owner/starred", ["gemini-cli", "mcp-server"], stars=500),
    ]
    frequencies = discover_similar.topic_frequency(repos)
    starred_names = {repo["full_name"] for repo in repos}

    session = FakeSession(
        {
            "topic:claude-code topic:mcp fork:false archived:false": [
                FakeResponse(
                    {
                        "items": [
                            make_repo("foo/first", ["claude-code", "mcp"], stars=900),
                            make_repo("owner/starred", ["gemini-cli", "mcp-server"], stars=500),
                        ]
                    }
                )
            ],
            "topic:claude-code fork:false archived:false": [
                FakeResponse(
                    {
                        "items": [
                            make_repo("foo/first", ["claude-code", "mcp"], stars=905),
                            make_repo("foo/second", ["gemini-cli"], stars=800),
                        ]
                    }
                )
            ],
            "topic:mcp fork:false archived:false": [
                FakeResponse({"items": [make_repo("foo/first", ["claude-code", "mcp"], stars=910)]})
            ],
            "topic:gemini-cli fork:false archived:false": [FakeResponse({"items": []})],
            "topic:mcp-server fork:false archived:false": [FakeResponse({"items": []})],
        }
    )

    entry = discover_similar.build_discovery_entry(
        repos[0],
        session,
        frequencies,
        groups,
        starred_names,
    )

    assert entry is not None
    assert entry["source"]["full_name"] == "owner/source"
    assert entry["seed_topics"] == ["claude-code", "mcp"]
    assert entry["suggestions"][0]["full_name"] == "foo/first"
    assert all(suggestion["full_name"] != "owner/starred" for suggestion in entry["suggestions"])
    assert entry["suggestions"][0]["query_terms"]


def test_build_public_dataset_filters_private_sources_and_suggestions():
    dataset = {
        "generated_at": "2026-04-16T00:00:00Z",
        "source_repo_count": 2,
        "entries": [
            {
                "source": {
                    "full_name": "public/source",
                    "html_url": "https://github.com/public/source",
                    "description": "Public",
                    "language": "TypeScript",
                    "topics": ["claude-code"],
                    "stargazers_count": 10,
                    "forks_count": 1,
                    "visibility": "public",
                },
                "seed_topics": ["claude-code"],
                "expanded_topics": ["claude-code", "gemini-cli"],
                "queries": ["topic:claude-code fork:false archived:false"],
                "source_score": 10.0,
                "suggestions": [
                    {
                        "full_name": "public/suggestion",
                        "html_url": "https://github.com/public/suggestion",
                        "description": "Suggestion",
                        "language": "Python",
                        "topics": ["claude-code"],
                        "stargazers_count": 50,
                        "forks_count": 4,
                        "visibility": "public",
                        "score": 10.0,
                        "matched_topics": ["claude-code"],
                        "query_terms": ["topic:claude-code fork:false archived:false"],
                    },
                    {
                        "full_name": "private/suggestion",
                        "html_url": "https://github.com/private/suggestion",
                        "description": "Suggestion",
                        "language": "Python",
                        "topics": ["claude-code"],
                        "stargazers_count": 50,
                        "forks_count": 4,
                        "visibility": "private",
                        "score": 9.0,
                        "matched_topics": ["claude-code"],
                        "query_terms": ["topic:claude-code fork:false archived:false"],
                    },
                ],
            },
            {
                "source": {
                    "full_name": "private/source",
                    "html_url": "https://github.com/private/source",
                    "description": "Private",
                    "language": "TypeScript",
                    "topics": ["mcp"],
                    "stargazers_count": 10,
                    "forks_count": 1,
                    "visibility": "private",
                },
                "seed_topics": ["mcp"],
                "expanded_topics": ["mcp", "mcp-server"],
                "queries": ["topic:mcp fork:false archived:false"],
                "source_score": 11.0,
                "suggestions": [
                    {
                        "full_name": "public/other",
                        "html_url": "https://github.com/public/other",
                        "description": "Other",
                        "language": "Python",
                        "topics": ["mcp"],
                        "stargazers_count": 50,
                        "forks_count": 4,
                        "visibility": "public",
                        "score": 11.0,
                        "matched_topics": ["mcp"],
                        "query_terms": ["topic:mcp fork:false archived:false"],
                    }
                ],
            },
        ],
    }

    public_dataset = discover_similar.build_public_dataset(dataset)

    assert public_dataset["public_source_repo_count"] == 1
    assert len(public_dataset["entries"]) == 1
    assert public_dataset["entries"][0]["source"]["full_name"] == "public/source"
    assert len(public_dataset["entries"][0]["suggestions"]) == 1
    assert public_dataset["entries"][0]["suggestions"][0]["full_name"] == "public/suggestion"


def test_main_writes_canonical_and_public_discovery(tmp_path, monkeypatch):
    stars_path = tmp_path / "stars.json"
    discovery_path = tmp_path / "discoveries.json"
    public_discovery_path = tmp_path / "site" / "public" / "data" / "discoveries.json"

    stars_path.write_text(
        json.dumps(
            [
                make_repo("owner/source", ["claude-code", "mcp"], stars=120),
                make_repo("owner/starred", ["gemini-cli", "mcp-server"], stars=500),
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(discover_similar, "SRC", stars_path)
    monkeypatch.setattr(discover_similar, "DISCOVERY_PATH", discovery_path)
    monkeypatch.setattr(discover_similar, "PUBLIC_DISCOVERY_PATH", public_discovery_path)
    monkeypatch.setattr(discover_similar, "CONFIG_PATH", tmp_path / "config.json")
    monkeypatch.setattr(
        discover_similar,
        "load_config",
        lambda: {"topic_synonyms": {"claude-code": ["gemini-cli"], "mcp": ["mcp-server"]}},
    )
    monkeypatch.setattr(discover_similar, "get_token", lambda: "token")
    monkeypatch.setattr(discover_similar, "utc_now", lambda: "2026-04-16T00:00:00Z")
    monkeypatch.setattr(
        discover_similar,
        "search_repositories",
        lambda _session, query: [
            make_repo("foo/first", ["claude-code", "mcp"], stars=900),
            make_repo("owner/starred", ["gemini-cli", "mcp-server"], stars=500),
        ]
        if query == "topic:claude-code topic:mcp"
        else [],
    )

    discover_similar.main()

    canonical = json.loads(discovery_path.read_text(encoding="utf-8"))
    public = json.loads(public_discovery_path.read_text(encoding="utf-8"))

    assert canonical["generated_at"] == "2026-04-16T00:00:00Z"
    assert canonical["source_repo_count"] == 2
    assert canonical["entries"][0]["source"]["full_name"] == "owner/source"
    assert canonical["entries"][0]["suggestions"][0]["full_name"] == "foo/first"
    assert public["public_source_repo_count"] == 1
    assert public["entries"][0]["source"]["full_name"] == "owner/source"
