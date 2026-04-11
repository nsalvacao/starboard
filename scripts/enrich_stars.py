"""
enrich_stars.py – Enrich data/stars.json with LLM-generated metadata via GitHub Models.

Uses requests.post directly (not OpenAI SDK) for full access to rate-limit response headers.
Distinguishes per-minute 429s (sleep & retry same model) from per-day 429s (mark exhausted,
rotate to next model). Session-wide exhaustion tracking prevents repeated failed calls.

Model families (from config.json models.chain[*].family):
  openai    — max_tokens, response_format=json_object
  azure_ml  — max_tokens, no response_format (JSON enforced by prompt text)
  reasoning — max_completion_tokens * 3 (reasoning budget), response_format=json_object
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

STARS_PATH = Path(__file__).parent.parent / "data" / "stars.json"
CONFIG_PATH = Path(__file__).parent.parent / "config.json"
PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "enrich.txt"
INFERENCE_URL = "https://models.github.ai/inference/chat/completions"

# Session-wide: models that returned a per-day 429 are skipped for the rest of this run.
_exhausted_models: set[str] = set()


def get_token() -> str:
    token = (
        os.environ.get("GH_MODELS_PAT")
        or os.environ.get("GH_STARS_PAT")
        or os.environ.get("GITHUB_TOKEN", "")
    )
    if not token:
        print("ERROR: GH_MODELS_PAT environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return token


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def load_prompt_template() -> str:
    with open(PROMPT_PATH) as f:
        return f.read().strip()


def build_prompt(repo: dict, taxonomy: list[str], template: str) -> str:
    """Substitute template placeholders. Uses .replace() to avoid KeyError on JSON braces."""
    return (
        template
        .replace("{name}", repo["full_name"].split("/")[-1])
        .replace("{description}", repo.get("description") or "(none)")
        .replace("{language}", repo.get("language") or "(unknown)")
        .replace("{topics}", ", ".join(repo.get("topics") or []) or "(none)")
        .replace("{taxonomy}", ", ".join(taxonomy))
    )


def _build_payload(model_cfg: dict, prompt: str, max_tokens: int) -> dict:
    """Build the POST payload for a specific model family.

    family='openai'    -> max_tokens + response_format=json_object
    family='azure_ml'  -> max_tokens, NO response_format (JSON enforced by prompt text)
    family='reasoning' -> max_completion_tokens=max_tokens*3 (reasoning headroom), json_object
    """
    family = model_cfg.get("family", "openai")
    model_id = model_cfg["id"]

    if family == "reasoning":
        return {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": max_tokens * 3,
            "temperature": 0.2,
        }
    if family == "azure_ml":
        return {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.2,
        }
    # Default: openai (also handles unknown families gracefully)
    return {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }


def _classify_retry(headers: dict, per_minute_threshold: int = 120) -> tuple[str, int]:
    """Classify a 429 response as per-minute or per-day from response headers.

    Returns:
        ("per_minute", wait_seconds) -- transient; sleep and retry the SAME model
        ("per_day", wait_seconds)    -- daily quota hit; mark exhausted and rotate to next
    """
    raw = headers.get("retry-after") or headers.get("Retry-After") or "0"
    retry_after = max(int(raw), 0)
    if retry_after <= per_minute_threshold:
        return "per_minute", max(retry_after, 1)
    return "per_day", retry_after


def call_model(
    token: str,
    model_cfg: dict,
    prompt: str,
    max_tokens: int,
    per_minute_threshold: int,
) -> dict:
    """POST to the inference API with automatic per-minute 429 retry.

    Returns one of:
        {"status": "ok", "content": str}
        {"status": "per_day_exhausted", "wait": int}
        {"status": "error", "error": str}
    """
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = _build_payload(model_cfg, prompt, max_tokens)

    while True:
        try:
            resp = requests.post(INFERENCE_URL, headers=headers, json=payload, timeout=60)
        except requests.RequestException as exc:
            return {"status": "error", "error": str(exc)}

        if resp.status_code == 429:
            limit_type, wait_secs = _classify_retry(resp.headers, per_minute_threshold)
            if limit_type == "per_minute":
                print(f"    [per-minute 429] {model_cfg['id']} -> sleeping {wait_secs}s ...", file=sys.stderr)
                time.sleep(wait_secs + 1)
                continue  # Retry the same model after the per-minute window resets
            return {"status": "per_day_exhausted", "wait": wait_secs}

        if not resp.ok:
            return {"status": "error", "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}

        choices = resp.json().get("choices", [])
        if not choices:
            return {"status": "error", "error": "Empty choices in response"}

        content = (choices[0].get("message", {}).get("content") or "").strip()
        return {"status": "ok", "content": content}


def _parse_json_response(content: str) -> dict | None:
    """Try to parse JSON from model output. Falls back to regex extraction for markdown-wrapped JSON."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    # Some azure_ml models wrap JSON in ```json ... ``` despite the prompt instruction.
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


def enrich_repo(
    token: str,
    repo: dict,
    model_chain: list[dict],
    max_tokens: int,
    per_minute_threshold: int,
    prompt_template: str,
    taxonomy: list[str],
) -> dict:
    """Try to enrich one repo using the model chain with fallback and session exhaustion tracking."""
    prompt = build_prompt(repo, taxonomy, prompt_template)

    for model_cfg in model_chain:
        model_id = model_cfg["id"]

        if model_id in _exhausted_models:
            continue

        result = call_model(token, model_cfg, prompt, max_tokens, per_minute_threshold)

        if result["status"] == "ok":
            parsed = _parse_json_response(result["content"])
            if parsed is None:
                print(f"    Parse error on {model_id}. Trying next ...", file=sys.stderr)
                continue

            category = parsed.get("llm_category")
            if category not in taxonomy:
                category = "Other"

            repo["llm_category"] = category or None
            repo["llm_summary"] = parsed.get("llm_summary") or None
            repo["llm_watch_note"] = parsed.get("llm_watch_note") or None
            repo["llm_model"] = model_id
            repo["llm_status"] = "ok"
            repo["llm_enriched_at"] = datetime.now(timezone.utc).isoformat()
            return repo

        if result["status"] == "per_day_exhausted":
            print(f"    [per-day 429] {model_id} exhausted. Rotating ...", file=sys.stderr)
            _exhausted_models.add(model_id)
            continue

        # status == "error"
        print(f"    Error on {model_id}: {result['error']}. Trying next ...", file=sys.stderr)

    repo["llm_status"] = "failed"
    print(f"  WARN: Could not enrich {repo['full_name']}", file=sys.stderr)
    return repo


def needs_enrichment(repo: dict) -> bool:
    """Skip repos that were successfully enriched and haven't been invalidated."""
    return repo.get("llm_status") != "ok"


def main() -> None:
    token = get_token()
    cfg = load_config()
    model_chain: list[dict] = cfg["models"]["chain"]
    max_tokens: int = cfg["models"].get("max_tokens", 256)
    request_delay: float = cfg["models"].get("request_delay_seconds", 1.0)
    per_minute_threshold: int = cfg["models"].get("per_minute_threshold_seconds", 120)
    taxonomy: list[str] = cfg["llm_category_taxonomy"]

    prompt_template = load_prompt_template()

    with open(STARS_PATH, encoding="utf-8") as f:
        repos: list[dict] = json.load(f)

    to_enrich = [r for r in repos if needs_enrichment(r)]
    already_done = len(repos) - len(to_enrich)
    print(f"Enriching {len(to_enrich)} repos ({already_done} already done) ...")
    print(f"Model chain ({len(model_chain)}): {[m['id'] for m in model_chain]}")

    for i, repo in enumerate(repos):
        if not needs_enrichment(repo):
            continue

        # Stop early if all models are exhausted — no point continuing
        available = [m for m in model_chain if m["id"] not in _exhausted_models]
        if not available:
            remaining = sum(1 for r in repos[i:] if needs_enrichment(r))
            print(f"\n  All models exhausted. {remaining} repos left unenriched.", file=sys.stderr)
            break

        print(f"  [{i + 1}/{len(repos)}] {repo['full_name']}")
        repos[i] = enrich_repo(
            token, repo, model_chain, max_tokens, per_minute_threshold,
            prompt_template, taxonomy,
        )
        time.sleep(request_delay)

    with open(STARS_PATH, "w", encoding="utf-8") as f:
        json.dump(repos, f, indent=2, ensure_ascii=False)

    ok = sum(1 for r in repos if r.get("llm_status") == "ok")
    failed = sum(1 for r in repos if r.get("llm_status") == "failed")
    if _exhausted_models:
        print(f"\nExhausted models this run: {sorted(_exhausted_models)}")
    print(f"\nDone. Enriched: {ok}  Failed: {failed}  Written to {STARS_PATH}")


if __name__ == "__main__":
    main()
