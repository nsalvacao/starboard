# Starboard

A static, visual dashboard for your GitHub starred repositories.

## What it does

- Fetches all repos you've starred via the authenticated GitHub API (public, private, internal).
- Enriches each repo with a short LLM-generated category, summary and watch note, using **GitHub Models** (free tier only).
- Publishes a clean, filterable dashboard to **GitHub Pages**.
- Refreshes automatically every day via **GitHub Actions**.

---

## Setup

### 1. Fork or clone this repository

### 2. Create a GitHub Personal Access Token

The token needs:
- `read:user` – list your starred repos
- `public_repo` (or `repo` for private repos) – access repo metadata

> **Note:** If your token has `repo` scope, **private and internal repos you've starred will appear in `data/stars.json` and will be published to GitHub Pages**. Review the data before publishing or restrict the token to `public_repo` only.

### 3. Add the token as a repository secret

Go to **Settings → Secrets and variables → Actions** and add:

```
GITHUB_TOKEN   your_token_here
```

> The built-in `${{ secrets.GITHUB_TOKEN }}` already has enough permissions to run the workflow and deploy Pages — you only need a PAT if you want to fetch private/internal starred repos.

### 4. Enable GitHub Pages

Go to **Settings → Pages**, set source to **GitHub Actions**.

---

## Local usage

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy and fill in your token
cp .env.example .env
# edit .env and set GITHUB_TOKEN=...

# 3. Load the token
export $(cat .env | xargs)

# 4. Fetch stars
python scripts/fetch_stars.py

# 5. Enrich with GitHub Models (optional – requires token with models scope)
python scripts/enrich_stars.py

# 6. Copy data to site
python scripts/build_site.py

# 7. Open the dashboard locally
open site/index.html
# or: python -m http.server 8080 --directory site
```

---

## Changing heuristics

Edit `config.json`:

```json
"heuristics": {
  "recent_star_days": 30,
  "recent_activity_days": 90,
  "stale_days": 365
}
```

- `recent_star` = starred within `recent_star_days`
- `recent_activity` = pushed within `recent_activity_days`
- `stale` = not pushed for more than `stale_days`
- `cleanup_candidate` = archived OR stale
- `watch_candidate` = not archived AND recent_activity

After editing, re-run `fetch_stars.py` and `build_site.py` to apply.

---

## Changing the model allowlist

Edit `config.json`:

```json
"models": {
  "allowlist": [
    "gpt-4o-mini",
    "meta-llama-3.1-8b-instruct",
    "mistral-small",
    "gpt-4o"
  ],
  "max_retries_per_item": 3
}
```

Models are tried in order. On rate limit or error the next model is used.
All models must be available on **GitHub Models free tier**.

---

## Editing LLM prompts

The prompt template lives in `prompts/enrich.txt`. Edit it freely — it is versioned and applied at enrichment time.

---

## Privacy warning

> **If you have starred private or internal repositories**, they will be included in `data/stars.json` unless you filter them out manually.
>
> Before enabling GitHub Pages, review `data/stars.json` and decide what you are comfortable publishing.
>
> To avoid this, use a token scoped to `public_repo` only.

---

## Structure

```
config.json                  # heuristics + model allowlist
prompts/enrich.txt           # LLM prompt template (versioned)
scripts/fetch_stars.py       # fetch stars from GitHub API
scripts/enrich_stars.py      # enrich via GitHub Models
scripts/build_site.py        # copy data to site/
data/stars.json              # canonical source of truth
site/index.html              # dashboard
site/app.js                  # dashboard logic
site/styles.css              # styles
site/data/stars.json         # published copy of data
.github/workflows/refresh.yml
```