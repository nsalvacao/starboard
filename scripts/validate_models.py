#!/usr/bin/env python3
"""validate_models.py — Discover and validate GitHub Models availability and rate limits.

Usage:
    source .env && python scripts/validate_models.py                    # test all models in config.json
    source .env && python scripts/validate_models.py --discover         # list ALL available from catalog
    source .env && python scripts/validate_models.py --model openai/gpt-4o  # test single model
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "config.json"
CATALOG_URL = "https://models.github.ai/catalog/models"
INFERENCE_URL = "https://models.github.ai/inference/chat/completions"
TEST_PROMPT = [{"role": "user", "content": "Reply with the single word: OK"}]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def discover_models(token: str) -> list[dict]:
    resp = requests.get(CATALOG_URL, headers=_headers(token), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list):
        return data
    return data.get("models", data.get("data", []))


def test_model(model_id: str, token: str, max_tokens: int = 5) -> dict:
    payload = {
        "model": model_id,
        "messages": TEST_PROMPT,
        "max_tokens": max_tokens,
        "temperature": 0.0,
    }
    result: dict = {
        "model": model_id,
        "available": False,
        "http_status": 0,
        "rate_limit_headers": {},
        "response_preview": "",
        "error": None,
    }
    try:
        resp = requests.post(INFERENCE_URL, headers=_headers(token), json=payload, timeout=30)
        result["http_status"] = resp.status_code
        result["rate_limit_headers"] = {
            k: v for k, v in resp.headers.items()
            if any(x in k.lower() for x in ["ratelimit", "rate-limit", "retry", "remaining", "reset", "limit"])
        }
        if resp.status_code == 200:
            result["available"] = True
            choices = resp.json().get("choices", [])
            if choices:
                result["response_preview"] = (choices[0].get("message", {}).get("content") or "")[:60]
        elif resp.status_code == 429:
            result["error"] = f"Rate limited — retry-after: {resp.headers.get('retry-after', 'unknown')}"
        else:
            result["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        result["error"] = str(exc)
    return result


def print_test_result(r: dict) -> None:
    status = "OK" if r["available"] else ("RATE_LIMIT" if r["http_status"] == 429 else "FAIL")
    print(f"  [{status}] {r['model']}")
    print(f"     HTTP: {r['http_status']}")
    if r["response_preview"]:
        print(f"     Response: {r['response_preview']!r}")
    if r["rate_limit_headers"]:
        print("     Rate-limit headers:")
        for k, v in r["rate_limit_headers"].items():
            print(f"       {k}: {v}")
    if r["error"]:
        print(f"     Error: {r['error']}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate GitHub Models availability and rate limits.")
    parser.add_argument("--discover", action="store_true", help="List all available models from catalog")
    parser.add_argument("--model", help="Test a single model by ID (e.g. openai/gpt-4o)")
    args = parser.parse_args()

    token = os.environ.get("GH_MODELS_PAT", "")
    if not token:
        print("ERROR: GH_MODELS_PAT not set. Run: source .env", file=sys.stderr)
        sys.exit(1)

    if args.discover:
        print("Fetching GitHub Models catalog ...\n")
        models = discover_models(token)
        print(f"Found {len(models)} models:\n")
        for m in models:
            model_id = m.get("id") or m.get("name", "unknown")
            tier = m.get("rate_limit_tier", m.get("tier", "unknown"))
            ctx = m.get("max_input_tokens", "?")
            print(f"  {model_id:55s}  tier={tier}  ctx={ctx}")
        print("\nKey: tier=low/high -> azure_ml family; tier=standard/premium -> openai family")
        print("Add desired models to config.json models.chain, then re-run without --discover to test them.")
        return

    if args.model:
        print(f"Testing: {args.model}\n")
        print_test_result(test_model(args.model, token))
        return

    # Default: test all models currently in config.json
    if not CONFIG_PATH.exists():
        print(f"ERROR: {CONFIG_PATH} not found.", file=sys.stderr)
        sys.exit(1)
    cfg = json.loads(CONFIG_PATH.read_text())
    chain = cfg.get("models", {}).get("chain", [])
    if not chain:
        print("ERROR: No models.chain found in config.json. Run Task 1 first.", file=sys.stderr)
        sys.exit(1)

    print(f"Testing {len(chain)} models from config.json ...\n")
    for model_cfg in chain:
        model_id = model_cfg["id"]
        print(f"Testing: {model_id}")
        print_test_result(test_model(model_id, token))
        time.sleep(1.0)

    print("Done.")
    print("Key: retry-after <= 120s -> per-minute (sleep & retry same model)")
    print("     retry-after > 120s  -> per-day   (mark exhausted, rotate to next)")


if __name__ == "__main__":
    main()
