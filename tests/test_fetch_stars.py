"""Unit tests for fetch_stars.py pure functions.

Tests cover content_hash() and _should_preserve_llm() — the two functions
that drive smart re-enrichment. No network calls, no file I/O.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

# These imports FAIL until Task 1 creates the functions (RED state).
from fetch_stars import content_hash, _should_preserve_llm


class TestContentHash:
    """content_hash(repo) -> str: 32-char MD5 hex digest of description+topics+language+archived"""

    def test_returns_32_char_hex_string(self):
        repo = {"description": "test", "topics": [], "language": "Python", "archived": False}
        h = content_hash(repo)
        assert isinstance(h, str)
        assert len(h) == 32
        assert all(c in "0123456789abcdef" for c in h)

    def test_same_content_same_hash(self):
        repo1 = {"description": "A CLI tool", "topics": ["cli"], "language": "Go", "archived": False}
        repo2 = {"description": "A CLI tool", "topics": ["cli"], "language": "Go", "archived": False}
        assert content_hash(repo1) == content_hash(repo2)

    def test_different_description_different_hash(self):
        repo1 = {"description": "Old description", "topics": [], "language": "Python", "archived": False}
        repo2 = {"description": "New description", "topics": [], "language": "Python", "archived": False}
        assert content_hash(repo1) != content_hash(repo2)

    def test_different_topics_different_hash(self):
        repo1 = {"description": "test", "topics": ["api"], "language": "Python", "archived": False}
        repo2 = {"description": "test", "topics": ["api", "rest"], "language": "Python", "archived": False}
        assert content_hash(repo1) != content_hash(repo2)

    def test_topics_order_does_not_matter(self):
        # Topics are sorted before hashing so order-only differences are ignored
        repo1 = {"description": "test", "topics": ["rest", "api"], "language": "Python", "archived": False}
        repo2 = {"description": "test", "topics": ["api", "rest"], "language": "Python", "archived": False}
        assert content_hash(repo1) == content_hash(repo2)

    def test_archived_change_changes_hash(self):
        repo1 = {"description": "test", "topics": [], "language": "Python", "archived": False}
        repo2 = {"description": "test", "topics": [], "language": "Python", "archived": True}
        assert content_hash(repo1) != content_hash(repo2)

    def test_language_change_changes_hash(self):
        repo1 = {"description": "test", "topics": [], "language": "Python", "archived": False}
        repo2 = {"description": "test", "topics": [], "language": "TypeScript", "archived": False}
        assert content_hash(repo1) != content_hash(repo2)

    def test_none_description_treated_as_empty_string(self):
        repo1 = {"description": None, "topics": [], "language": "Python", "archived": False}
        repo2 = {"description": "", "topics": [], "language": "Python", "archived": False}
        assert content_hash(repo1) == content_hash(repo2)

    def test_none_topics_treated_as_empty_list(self):
        repo1 = {"description": "test", "topics": None, "language": "Python", "archived": False}
        repo2 = {"description": "test", "topics": [], "language": "Python", "archived": False}
        assert content_hash(repo1) == content_hash(repo2)

    def test_none_language_treated_as_empty_string(self):
        repo1 = {"description": "test", "topics": [], "language": None, "archived": False}
        repo2 = {"description": "test", "topics": [], "language": "", "archived": False}
        assert content_hash(repo1) == content_hash(repo2)

    def test_unrelated_fields_ignored(self):
        # stargazers_count, pushed_at, etc. don't affect the hash
        repo1 = {"description": "test", "topics": [], "language": "Python", "archived": False,
                 "stargazers_count": 100, "pushed_at": "2024-01-01"}
        repo2 = {"description": "test", "topics": [], "language": "Python", "archived": False,
                 "stargazers_count": 9999, "pushed_at": "2026-04-01"}
        assert content_hash(repo1) == content_hash(repo2)


class TestShouldPreserveLlm:
    """_should_preserve_llm(fresh_hash, stored, max_age_days) -> (bool, str)"""

    def _make_stored(self, hash_val: str, days_ago: int = 1) -> dict:
        """Helper: build a stored LLM dict enriched N days ago with the given hash."""
        enriched_at = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
        return {
            "llm_status": "ok",
            "llm_content_hash": hash_val,
            "llm_enriched_at": enriched_at,
            "llm_category": "AI/ML",
            "llm_summary": "A test repo.",
            "llm_watch_note": None,
            "llm_model": "openai/gpt-4o",
        }

    def test_hash_match_recent_returns_true(self):
        stored = self._make_stored("abc123", days_ago=1)
        preserve, reason = _should_preserve_llm("abc123", stored)
        assert preserve is True
        assert reason == "ok"

    def test_hash_mismatch_returns_false_content_changed(self):
        stored = self._make_stored("abc123", days_ago=1)
        preserve, reason = _should_preserve_llm("different_hash", stored)
        assert preserve is False
        assert reason == "content_changed"

    def test_aged_out_exactly_30_days_returns_false(self):
        stored = self._make_stored("abc123", days_ago=30)
        preserve, reason = _should_preserve_llm("abc123", stored, max_age_days=30)
        assert preserve is False
        assert "aged" in reason

    def test_29_days_is_still_fresh(self):
        stored = self._make_stored("abc123", days_ago=29)
        preserve, reason = _should_preserve_llm("abc123", stored, max_age_days=30)
        assert preserve is True
        assert reason == "ok"

    def test_missing_content_hash_returns_false(self):
        stored = self._make_stored("abc123", days_ago=1)
        del stored["llm_content_hash"]
        preserve, reason = _should_preserve_llm("abc123", stored)
        assert preserve is False
        assert reason == "content_changed"

    def test_missing_enriched_at_returns_false(self):
        stored = self._make_stored("abc123", days_ago=1)
        del stored["llm_enriched_at"]
        preserve, reason = _should_preserve_llm("abc123", stored)
        assert preserve is False
        assert reason == "no_date"

    def test_max_age_days_is_configurable(self):
        # 10-day threshold
        stored_fresh = self._make_stored("abc123", days_ago=9)
        stored_old = self._make_stored("abc123", days_ago=10)
        assert _should_preserve_llm("abc123", stored_fresh, max_age_days=10)[0] is True
        assert _should_preserve_llm("abc123", stored_old, max_age_days=10)[0] is False
