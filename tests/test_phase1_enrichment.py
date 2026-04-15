"""Unit tests for Phase 1 — new metadata fetcher functions.

Tests cover normalize_repo() output schema with new fields (visibility,
license, release, readme, contributors, commit_activity, community_health)
plus extended metadata fetching, caching, and the build_site.py privacy filter.
"""
import base64
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import fetch_stars
from fetch_stars import enrich_extended_metadata, normalize_repo


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_api_star_item(**overrides) -> dict:
    """Build a realistic star+json API response item."""
    repo = {
        "full_name": "owner/repo",
        "html_url": "https://github.com/owner/repo",
        "description": "A test repository",
        "language": "Python",
        "topics": ["ai", "cli"],
        "stargazers_count": 100,
        "forks_count": 10,
        "open_issues_count": 5,
        "archived": False,
        "fork": False,
        "default_branch": "main",
        "pushed_at": "2026-04-01T00:00:00Z",
        "updated_at": "2026-04-01T00:00:00Z",
        "visibility": "public",
    }
    repo.update(overrides)
    return {"repo": repo, "starred_at": "2026-04-10T00:00:00Z"}


def _mock_response(status_code=200, payload=None, headers=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.ok = 200 <= status_code < 300
    resp.headers = headers or {}
    resp.text = json.dumps(payload or {})
    resp.json.return_value = payload or {}
    return resp


# ---------------------------------------------------------------------------
# T1 — A7: Visibility field
# ---------------------------------------------------------------------------

class TestVisibilityField:
    """normalize_repo() must extract visibility from the API response."""

    def test_public_visibility_extracted(self):
        item = _make_api_star_item(visibility="public")
        result = normalize_repo(item)
        assert result["visibility"] == "public"

    def test_private_visibility_extracted(self):
        item = _make_api_star_item(visibility="private")
        result = normalize_repo(item)
        assert result["visibility"] == "private"

    def test_internal_visibility_extracted(self):
        item = _make_api_star_item(visibility="internal")
        result = normalize_repo(item)
        assert result["visibility"] == "internal"

    def test_missing_visibility_defaults_to_public(self):
        item = _make_api_star_item()
        del item["repo"]["visibility"]
        result = normalize_repo(item)
        assert result["visibility"] == "public"


# ---------------------------------------------------------------------------
# T2-T7 — New metadata fields exist with correct shape
# ---------------------------------------------------------------------------

class TestNewMetadataFieldsExist:
    """normalize_repo() output must include placeholder keys for all new fields."""

    def test_has_license_spdx_key(self):
        result = normalize_repo(_make_api_star_item())
        assert "license_spdx" in result

    def test_has_latest_release_key(self):
        result = normalize_repo(_make_api_star_item())
        assert "latest_release" in result

    def test_has_readme_excerpt_key(self):
        result = normalize_repo(_make_api_star_item())
        assert "readme_excerpt" in result

    def test_has_contributor_count_key(self):
        result = normalize_repo(_make_api_star_item())
        assert "contributor_count" in result

    def test_has_commit_activity_52w_key(self):
        result = normalize_repo(_make_api_star_item())
        assert "commit_activity_52w" in result

    def test_has_community_health_key(self):
        result = normalize_repo(_make_api_star_item())
        assert "community_health" in result

    def test_new_fields_default_to_none(self):
        """All new metadata fields should default to None before enrichment."""
        result = normalize_repo(_make_api_star_item())
        assert result["license_spdx"] is None
        assert result["latest_release"] is None
        assert result["readme_excerpt"] is None
        assert result["contributor_count"] is None
        assert result["commit_activity_52w"] is None
        assert result["community_health"] is None


# ---------------------------------------------------------------------------
# T2-T7 — Extended metadata fetch behavior
# ---------------------------------------------------------------------------

class TestExtendedMetadataFetch:
    """enrich_extended_metadata() must map GitHub API responses into repo fields."""

    def test_enrich_extended_metadata_happy_path(self):
        readme = base64.b64encode(b"# Example\nUseful project").decode("ascii")
        session = MagicMock()
        session.get.side_effect = [
            _mock_response(payload={"license": {"spdx_id": "MIT"}}),
            _mock_response(payload={"tag_name": "v1.2.3", "published_at": "2026-04-01T00:00:00Z", "html_url": "https://example/release"}),
            _mock_response(payload={"content": readme}),
            _mock_response(payload=[{"login": "one"}], headers={"Link": '<https://api.github.com/repos/owner/repo/contributors?page=42>; rel="last"'}),
            _mock_response(payload=[{"total": i} for i in range(60)]),
            _mock_response(payload={
                "health_percentage": 85,
                "files": {
                    "code_of_conduct": {"url": "https://example/coc"},
                    "contributing": {"url": "https://example/contributing"},
                    "issue_template": {"url": "https://example/issues"},
                    "pull_request_template": {"url": "https://example/pr"},
                    "license": {"url": "https://example/license"},
                    "readme": {"url": "https://example/readme"},
                },
            }),
        ]

        repo = normalize_repo(_make_api_star_item())
        result = enrich_extended_metadata(session, repo)

        assert result["license_spdx"] == "MIT"
        assert result["latest_release"] == {
            "tag": "v1.2.3",
            "date": "2026-04-01T00:00:00Z",
            "url": "https://example/release",
        }
        assert result["readme_excerpt"].startswith("# Example")
        assert result["contributor_count"] == 42
        assert result["commit_activity_52w"] == list(range(8, 60))
        assert result["community_health"]["score"] == 85
        assert result["community_health"]["has_pull_request_template"] is True
        assert result["cached_pushed_at"] == "2026-04-01T00:00:00Z"

    def test_enrich_extended_metadata_handles_missing_optional_endpoints(self):
        session = MagicMock()
        session.get.side_effect = [
            _mock_response(status_code=404),
            _mock_response(status_code=404),
            _mock_response(status_code=404),
            _mock_response(payload=[]),
            _mock_response(status_code=404),
            _mock_response(status_code=404),
        ]

        repo = normalize_repo(_make_api_star_item())
        result = enrich_extended_metadata(session, repo)

        assert result["license_spdx"] is None
        assert result["latest_release"] is None
        assert result["readme_excerpt"] is None
        assert result["contributor_count"] == 0
        assert result["commit_activity_52w"] is None
        assert result["community_health"] is None
        assert result["cached_pushed_at"] == "2026-04-01T00:00:00Z"

    def test_enrich_extended_metadata_retries_commit_activity_202(self, monkeypatch):
        monkeypatch.setattr(fetch_stars.time, "sleep", lambda _: None)
        session = MagicMock()
        session.get.side_effect = [
            _mock_response(status_code=404),
            _mock_response(status_code=404),
            _mock_response(status_code=404),
            _mock_response(payload=[]),
            _mock_response(status_code=202),
            _mock_response(payload=[{"total": 7}]),
            _mock_response(status_code=404),
        ]

        repo = normalize_repo(_make_api_star_item())
        result = enrich_extended_metadata(session, repo)

        assert result["commit_activity_52w"] == [7]

    def test_main_preserves_cached_extended_metadata(self, tmp_path, monkeypatch):
        stars_path = tmp_path / "stars.json"
        existing = normalize_repo(_make_api_star_item())
        existing.update({
            "license_spdx": "Apache-2.0",
            "latest_release": {"tag": "v1", "date": "2026-01-01T00:00:00Z", "url": "https://example/v1"},
            "readme_excerpt": "cached readme",
            "contributor_count": 5,
            "commit_activity_52w": [1, 2, 3],
            "community_health": {"score": 50},
            "cached_pushed_at": "2026-04-01T00:00:00Z",
            "llm_status": "failed",
        })
        stars_path.write_text(json.dumps([existing]), encoding="utf-8")

        monkeypatch.setattr(fetch_stars, "STARS_PATH", stars_path)
        monkeypatch.setattr(fetch_stars, "get_token", lambda: "token")
        monkeypatch.setattr(fetch_stars, "load_config", lambda: {"heuristics": {"recent_star_days": 30, "recent_activity_days": 90, "stale_days": 365}})
        monkeypatch.setattr(fetch_stars, "fetch_page", MagicMock(return_value=([_make_api_star_item()], None)))
        enrich_mock = MagicMock(side_effect=AssertionError("cached metadata should be preserved"))
        monkeypatch.setattr(fetch_stars, "enrich_extended_metadata", enrich_mock)

        fetch_stars.main()

        written = json.loads(stars_path.read_text(encoding="utf-8"))
        assert written[0]["license_spdx"] == "Apache-2.0"
        assert written[0]["latest_release"]["tag"] == "v1"
        assert written[0]["readme_excerpt"] == "cached readme"
        assert written[0]["contributor_count"] == 5
        assert written[0]["commit_activity_52w"] == [1, 2, 3]
        assert written[0]["community_health"] == {"score": 50}
        enrich_mock.assert_not_called()


# ---------------------------------------------------------------------------
# T9 — F1: Privacy filter
# ---------------------------------------------------------------------------

class TestPrivacyFilter:
    """build_site.py must exclude non-public repos from the published JSON."""

    def test_filter_excludes_private_repos(self):
        from build_site import filter_public_repos

        repos = [
            {"full_name": "a/pub", "visibility": "public"},
            {"full_name": "b/priv", "visibility": "private"},
            {"full_name": "c/int", "visibility": "internal"},
            {"full_name": "d/pub2", "visibility": "public"},
        ]
        result = filter_public_repos(repos)
        assert len(result) == 2
        assert all(r["visibility"] == "public" for r in result)

    def test_filter_preserves_all_when_all_public(self):
        from build_site import filter_public_repos

        repos = [
            {"full_name": "a/pub", "visibility": "public"},
            {"full_name": "b/pub2", "visibility": "public"},
        ]
        result = filter_public_repos(repos)
        assert len(result) == 2

    def test_filter_returns_empty_when_none_public(self):
        from build_site import filter_public_repos

        repos = [
            {"full_name": "a/priv", "visibility": "private"},
        ]
        result = filter_public_repos(repos)
        assert len(result) == 0

    def test_filter_rejects_repos_with_missing_visibility(self):
        from build_site import filter_public_repos

        repos = [
            {"full_name": "a/old", "description": "no visibility field"},
        ]
        try:
            filter_public_repos(repos)
        except SystemExit as exc:
            assert exc.code == 1
        else:
            raise AssertionError("missing visibility should stop publication")
