# Starboard

[![Data Enrichment](https://github.com/nsalvacao/starboard/actions/workflows/refresh.yml/badge.svg)](https://github.com/nsalvacao/starboard/actions/workflows/refresh.yml)

A self-hosted admin console for your GitHub starred repositories — auto-enriched by LLM and published to GitHub Pages.

## What it does

- **Fetches** all starred repos via the GitHub API
- **Enriches** each repo with GitHub REST metadata plus an LLM-generated category, summary, and watch note using **GitHub Models** (free tier)
- **Smart re-enrichment** — skips LLM work whose source metadata hasn't changed and skips REST metadata refreshes when the repo has not moved since the last successful extended fetch
- **Privacy-filtered publishing** — keeps the canonical local dataset in `data/stars.json` and publishes only public repos to the static site
- **Publishes** an admin console dashboard to **GitHub Pages**, refreshed daily via **GitHub Actions**

## Dashboard

A dense dashboard with sidebar navigation and workspace tools:

- **Sidebar**: All / Watch / Explore / Cleanup / Not Enriched + dynamic LLM category counts
- **Workspace strip**: visible-repo stats, topic cloud, and export actions
- **Table**: multi-column sorting for repository, category, stars, and activity
- **Filters**: category, language, status, stars range, and topics
- **Search**: full-text across name, summary, description
- **Row detail modal**: repository metadata, LLM fields, and Phase 1 extended GitHub data
- **Compare**: select 2–4 repos for side-by-side comparison with aggregate metrics

Status chips:
- **Watch** — active, non-archived repos with recent pushes
- **Stale** — enriched repos with no recent activity
- **Cleanup** — archived or long-inactive repos
- **Pending** — not yet enriched

---

## Setup

### 1. Fork this repository

### 2. Create two Personal Access Tokens

**`GH_STARS_PAT`** — fetches your starred repos:
- Classic PAT → scopes: `read:user`, `public_repo`
- Add `repo` scope if you want private starred repos included (see [Privacy](#privacy))
- Create at: Settings → Developer settings → Personal access tokens → Tokens (classic)

**`GH_MODELS_PAT`** — calls the LLM enrichment API:
- Fine-grained PAT → permission: Models → Read
- Create at: Settings → Developer settings → Personal access tokens → Fine-grained tokens

### 3. Add secrets to the repository

Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|------|-------|
| `GH_STARS_PAT` | your classic PAT |
| `GH_MODELS_PAT` | your fine-grained PAT |

### 4. Enable GitHub Pages

Settings → Pages → Source: **GitHub Actions**

### 5. Trigger the first run

Actions → Refresh Starboard → Run workflow

---

## Local usage

```bash
# Install dependencies
pip install -r requirements.txt

# Configure tokens
cp .env.example .env
# edit .env — set GH_STARS_PAT and GH_MODELS_PAT

# Run the pipeline
python scripts/fetch_stars.py       # fetch stars + compute heuristics
python scripts/enrich_stars.py      # LLM enrichment (requires GH_MODELS_PAT)
python scripts/build_site.py        # write privacy-filtered data to site/

# View the dashboard
cd site
npm install
npm run dev
# → open http://localhost:5173/
```

---

## Configuration

Edit `config.json`.

### Heuristics

```json
"heuristics": {
  "recent_star_days": 30,
  "recent_activity_days": 90,
  "stale_days": 365
}
```

- `watch_candidate` = not archived AND pushed within `recent_activity_days`
- `cleanup_candidate` = archived OR not pushed for `stale_days`

### Model chain

Models are tried in order; on rate limit or error the next one is used:

```json
"models": {
  "chain": [
    {"id": "openai/gpt-4o",        "family": "openai"},
    {"id": "openai/gpt-4.1-mini",  "family": "openai"},
    ...
  ]
}
```

All models are available on the **GitHub Models free tier**.

### LLM prompt

Edit `prompts/enrich.txt` — it is versioned and applied at enrichment time.

---

## Smart re-enrichment

`fetch_stars.py` hashes each repo's relevant metadata (`description`, `topics`, `language`, `archived`). On subsequent runs, existing LLM data is preserved when:

1. The content hash matches (no relevant metadata changed), **and**
2. The enrichment is less than 30 days old

Repos that fail either condition are queued for re-enrichment. The run prints a summary:

```
Re-enrichment queued: 3 repos (1 content_changed, 2 aged_31d)
```

`fetch_stars.py` also caches extended GitHub REST metadata separately from the LLM fields. License, latest release, README excerpt, contributor count, 52-week commit activity and community health data are reused while `cached_pushed_at` matches the repo's current `pushed_at`/`updated_at`. Transient endpoint failures and README decode errors do not advance `cached_pushed_at`, so a later run can retry instead of freezing incomplete metadata.

---

## Privacy

> **If your `GH_STARS_PAT` has `repo` scope**, private or internal repositories you have starred can be included in the canonical `data/stars.json`.
>
> `scripts/build_site.py` refuses to publish entries without `visibility` metadata and writes only repositories with `visibility == "public"` to `site/public/data/stars.json`. Still review `data/stars.json` before committing or sharing it, or restrict the token to `public_repo` only.

---

## Structure

```
config.json                   heuristics + model chain
prompts/enrich.txt            LLM prompt template
scripts/
  fetch_stars.py              fetch stars, REST metadata, heuristics + content hash
  enrich_stars.py             LLM enrichment via GitHub Models
  build_site.py               write privacy-filtered data to site/public/data/
  validate_models.py          smoke-test model chain availability
data/
  stars.json                  canonical source of truth, may include non-public repos
site/
  src/                        React + TypeScript dashboard source
  public/data/stars.json      privacy-filtered runtime data for the SPA
  dist/                       production build output
tests/
  test_fetch_stars.py         unit tests — content hash + re-enrichment logic
  test_enrich_stars.py        unit tests — LLM payload + retry classification
  test_phase1_enrichment.py   unit tests — Phase 1 REST metadata + privacy filter
.github/workflows/refresh.yml daily refresh + Pages deploy
```
