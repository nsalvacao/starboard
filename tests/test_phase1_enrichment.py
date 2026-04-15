"""Unit tests for Phase 1 — new metadata fetcher functions.

Tests cover normalize_repo() output schema with new fields (visibility,
license, release, readme, contributors, commit_activity, community_health)
and the build_site.py privacy filter.

Uses unittest.mock to simulate GitHub API responses without network calls.
"""
import base64
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from fetch_stars import normalize_repo


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

    def test_filter_handles_missing_visibility_as_public(self):
        from build_site import filter_public_repos

        repos = [
            {"full_name": "a/old", "description": "no visibility field"},
        ]
        result = filter_public_repos(repos)
        assert len(result) == 1
