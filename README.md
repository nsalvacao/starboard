# Starboard

[![Data Enrichment](https://github.com/nsalvacao/starboard/actions/workflows/refresh.yml/badge.svg)](https://github.com/nsalvacao/starboard/actions/workflows/refresh.yml)

A self-hosted admin console for your GitHub starred repositories — auto-enriched by LLM and published to GitHub Pages.

## What it does

- **Fetches** all starred repos via the GitHub API
- **Enriches** each repo with an LLM-generated category, summary, and watch note using **GitHub Models** (free tier)
- **Smart re-enrichment** — skips repos whose metadata hasn't changed and were enriched within 30 days
- **Publishes** an admin console dashboard to **GitHub Pages**, refreshed daily via **GitHub Actions**

## Dashboard

A dense, sortable table with sidebar navigation:

- **Sidebar**: All / Watch / Explore / Cleanup / Not Enriched + dynamic LLM category counts
- **Table**: sortable by name, category, language, stars, status, last push
- **Filters**: category, language, status, stars range
- **Search**: full-text across name, summary, description
- **Row expand**: full summary, watch note, topics, links, stats — inline
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
python scripts/build_site.py        # sync data to site/

# View the dashboard
python -m http.server 8080 --directory site
# → open http://localhost:8080
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

---

## Privacy

> **If your `GH_STARS_PAT` has `repo` scope**, any private or internal repositories you have starred will be included in `data/stars.json` and published to GitHub Pages.
>
> Review `data/stars.json` before enabling Pages, or restrict the token to `public_repo` only.

---

## Structure

```
config.json                   heuristics + model chain
prompts/enrich.txt            LLM prompt template
scripts/
  fetch_stars.py              fetch stars, compute heuristics + content hash
  enrich_stars.py             LLM enrichment via GitHub Models
  build_site.py               copy data/ → site/data/
  validate_models.py          smoke-test model chain availability
data/
  stars.json                  canonical source of truth (updated by CI)
site/
  index.html                  dashboard shell
  app.js                      dashboard logic (vanilla JS, no build step)
  styles.css                  dark theme (GitHub palette)
  data/stars.json             published copy (served by GitHub Pages)
tests/
  test_fetch_stars.py         unit tests — content hash + re-enrichment logic
  test_enrich_stars.py        unit tests — LLM payload + retry classification
.github/workflows/refresh.yml daily refresh + Pages deploy
```
