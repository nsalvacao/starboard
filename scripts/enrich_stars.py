"""
enrich_stars.py – Enrich data/stars.json with LLM-generated metadata via GitHub Models.

Uses a configurable allowlist of models with simple rotation/fallback.
All prompts are read from prompts/enrich.txt (local, versioned).
Fails gracefully: on error, LLM fields stay null or preserve last valid value.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI, RateLimitError, APIStatusError, APIConnectionError

STARS_PATH = Path(__file__).parent.parent / "data" / "stars.json"
CONFIG_PATH = Path(__file__).parent.parent / "config.json"
PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "enrich.txt"
GITHUB_MODELS_BASE_URL = "https://models.github.ai/inference"


def get_token() -> str:
    """Return the GitHub Models PAT (GH_MODELS_PAT), falling back to GH_STARS_PAT/GITHUB_TOKEN."""
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
    return template.format(
        name=repo["full_name"].split("/")[-1],
        description=repo.get("description") or "(none)",
        language=repo.get("language") or "(unknown)",
        topics=", ".join(repo.get("topics") or []) or "(none)",
        taxonomy=", ".join(taxonomy),
    )


def call_model(client: OpenAI, model: str, prompt: str) -> dict:
    """Call one model and return parsed JSON dict. Raises on failure."""
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=256,
        temperature=0.2,
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


def enrich_repo(
    client: OpenAI,
    repo: dict,
    models: list[str],
    max_retries: int,
    prompt_template: str,
    taxonomy: list[str],
) -> dict:
    """
    Try to enrich one repo using the model allowlist with fallback.
    Returns the repo dict with LLM fields updated (or preserved/null on failure).
    """
    prompt = build_prompt(repo, taxonomy, prompt_template)
    attempts = 0

    for model in models:
        if attempts >= max_retries:
            break
        attempts += 1

        try:
            result = call_model(client, model, prompt)
            category = result.get("llm_category")
            summary = result.get("llm_summary")
            watch_note = result.get("llm_watch_note")

            # Validate category against taxonomy
            if category not in taxonomy:
                category = "Other"

            repo["llm_category"] = category or None
            repo["llm_summary"] = summary or None
            repo["llm_watch_note"] = watch_note or None
            repo["llm_model"] = model
            repo["llm_status"] = "ok"
            repo["llm_enriched_at"] = datetime.now(timezone.utc).isoformat()
            return repo

        except RateLimitError:
            print(f"    Rate limit on {model}. Trying next model …", file=sys.stderr)
            time.sleep(2)
            continue

        except (APIStatusError, APIConnectionError) as exc:
            print(f"    API error on {model}: {exc}. Trying next model …", file=sys.stderr)
            time.sleep(1)
            continue

        except (json.JSONDecodeError, KeyError) as exc:
            print(f"    Parse error on {model}: {exc}. Trying next model …", file=sys.stderr)
            continue

    # All models failed for this repo – preserve existing LLM fields or mark failed
    repo["llm_status"] = "failed"
    print(f"  WARN: Could not enrich {repo['full_name']}", file=sys.stderr)
    return repo


def needs_enrichment(repo: dict) -> bool:
    """Skip repos that were successfully enriched already."""
    return repo.get("llm_status") != "ok"


def main() -> None:
    token = get_token()
    cfg = load_config()
    models = cfg["models"]["allowlist"]
    max_retries = cfg["models"]["max_retries_per_item"]
    taxonomy = cfg["llm_category_taxonomy"]

    prompt_template = load_prompt_template()

    with open(STARS_PATH, encoding="utf-8") as f:
        repos: list[dict] = json.load(f)

    client = OpenAI(
        base_url=GITHUB_MODELS_BASE_URL,
        api_key=token,
    )

    to_enrich = [r for r in repos if needs_enrichment(r)]
    already_done = len(repos) - len(to_enrich)

    print(f"Enriching {len(to_enrich)} repos ({already_done} already done) …")
    print(f"Model allowlist: {models}")

    for i, repo in enumerate(repos):
        if not needs_enrichment(repo):
            continue
        print(f"  [{i+1}/{len(repos)}] {repo['full_name']}")
        repos[i] = enrich_repo(client, repo, models, max_retries, prompt_template, taxonomy)

    with open(STARS_PATH, "w", encoding="utf-8") as f:
        json.dump(repos, f, indent=2, ensure_ascii=False)

    ok = sum(1 for r in repos if r.get("llm_status") == "ok")
    failed = sum(1 for r in repos if r.get("llm_status") == "failed")
    print(f"\nDone. Enriched: {ok}  Failed: {failed}  Written to {STARS_PATH}")


if __name__ == "__main__":
    main()
