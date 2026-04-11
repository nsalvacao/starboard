"""Unit tests for enrich_stars.py pure functions.

These tests cover _build_payload and _classify_retry — the two functions
that contain the rate-limit and model-family logic. No network calls.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

# These imports will FAIL until Task 3 creates the functions — that's expected (RED state).
from enrich_stars import _build_payload, _classify_retry


class TestBuildPayload:
    """_build_payload(model_cfg, prompt, max_tokens) -> dict suitable for POST to INFERENCE_URL"""

    def test_openai_family_uses_max_tokens(self):
        model = {"id": "openai/gpt-4o", "family": "openai"}
        payload = _build_payload(model, "test prompt", 256)
        assert payload["max_tokens"] == 256
        assert "max_completion_tokens" not in payload

    def test_openai_family_has_json_response_format(self):
        model = {"id": "openai/gpt-4o", "family": "openai"}
        payload = _build_payload(model, "test prompt", 256)
        assert payload["response_format"] == {"type": "json_object"}

    def test_reasoning_family_uses_max_completion_tokens_times_3(self):
        model = {"id": "openai/o4-mini", "family": "reasoning"}
        payload = _build_payload(model, "test prompt", 256)
        assert payload["max_completion_tokens"] == 768  # 256 * 3
        assert "max_tokens" not in payload

    def test_reasoning_family_still_has_json_response_format(self):
        model = {"id": "openai/o4-mini", "family": "reasoning"}
        payload = _build_payload(model, "test prompt", 256)
        assert payload["response_format"] == {"type": "json_object"}

    def test_azure_ml_family_uses_max_tokens(self):
        model = {"id": "meta/llama-3.3-70b-instruct", "family": "azure_ml"}
        payload = _build_payload(model, "test prompt", 256)
        assert payload["max_tokens"] == 256
        assert "max_completion_tokens" not in payload

    def test_azure_ml_family_has_no_response_format(self):
        # Azure ML models don't support response_format=json_object; JSON enforced via prompt text.
        model = {"id": "meta/llama-3.3-70b-instruct", "family": "azure_ml"}
        payload = _build_payload(model, "test prompt", 256)
        assert "response_format" not in payload

    def test_model_id_is_set_in_payload(self):
        model = {"id": "openai/gpt-4o", "family": "openai"}
        payload = _build_payload(model, "hello", 100)
        assert payload["model"] == "openai/gpt-4o"

    def test_prompt_is_in_user_message(self):
        model = {"id": "openai/gpt-4o", "family": "openai"}
        payload = _build_payload(model, "categorise this repo", 100)
        messages = payload["messages"]
        assert any(m["role"] == "user" and "categorise this repo" in m["content"] for m in messages)

    def test_unknown_family_defaults_to_openai_behaviour(self):
        model = {"id": "unknown/model", "family": "future_new_family"}
        payload = _build_payload(model, "test", 100)
        # Should not crash; should produce a valid payload with required fields
        assert "model" in payload
        assert "messages" in payload


class TestClassifyRetry:
    """_classify_retry(headers, per_minute_threshold) -> (limit_type: str, wait_seconds: int)"""

    def test_short_retry_after_is_per_minute(self):
        headers = {"retry-after": "30"}
        limit_type, wait = _classify_retry(headers)
        assert limit_type == "per_minute"
        assert wait == 30

    def test_long_retry_after_is_per_day(self):
        headers = {"retry-after": "11000"}
        limit_type, wait = _classify_retry(headers)
        assert limit_type == "per_day"
        assert wait == 11000

    def test_exactly_at_threshold_is_per_minute(self):
        headers = {"retry-after": "120"}
        limit_type, _ = _classify_retry(headers, per_minute_threshold=120)
        assert limit_type == "per_minute"

    def test_one_above_threshold_is_per_day(self):
        headers = {"retry-after": "121"}
        limit_type, _ = _classify_retry(headers, per_minute_threshold=120)
        assert limit_type == "per_day"

    def test_missing_header_defaults_to_per_minute_with_min_1s(self):
        headers = {}
        limit_type, wait = _classify_retry(headers)
        assert limit_type == "per_minute"
        assert wait >= 1  # Never sleep 0s

    def test_case_insensitive_header_key(self):
        # HTTP headers are case-insensitive; handle both cases
        headers = {"Retry-After": "60"}
        limit_type, wait = _classify_retry(headers)
        assert limit_type == "per_minute"
        assert wait == 60

    def test_zero_retry_after_treated_as_per_minute_min_1s(self):
        headers = {"retry-after": "0"}
        limit_type, wait = _classify_retry(headers)
        assert limit_type == "per_minute"
        assert wait >= 1
