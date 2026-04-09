/* app.js – Starboard dashboard runtime logic.
 * Reads site/data/stars.json, applies filters/sort, renders repo cards.
 * No frameworks, no build step.
 */

const DATA_URL = "data/stars.json";

let allRepos = [];

// ─── Fetch & boot ──────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allRepos = await res.json();
  } catch (err) {
    document.getElementById("repo-grid").innerHTML =
      `<p class="empty-state">⚠️ Could not load data: ${err.message}</p>`;
    return;
  }

  populateLanguageFilter();
  renderStats();
  renderCards();
  bindControls();
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const total   = allRepos.length;
  const recent  = allRepos.filter(r => r.recent_star).length;
  const active  = allRepos.filter(r => r.watch_candidate).length;
  const cleanup = allRepos.filter(r => r.cleanup_candidate).length;
  const archived = allRepos.filter(r => r.archived).length;

  document.getElementById("stat-total").textContent   = total;
  document.getElementById("stat-recent").textContent  = recent;
  document.getElementById("stat-active").textContent  = active;
  document.getElementById("stat-cleanup").textContent = cleanup;
  document.getElementById("stat-archived").textContent = archived;
}

// ─── Language filter population ────────────────────────────────────────────────
function populateLanguageFilter() {
  const langs = [...new Set(allRepos.map(r => r.language).filter(Boolean))].sort();
  const sel = document.getElementById("filter-language");
  langs.forEach(lang => {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = lang;
    sel.appendChild(opt);
  });
}

// ─── Filter + Sort ─────────────────────────────────────────────────────────────
function getFiltered() {
  const lang      = document.getElementById("filter-language").value;
  const archived  = document.getElementById("filter-archived").value;
  const activity  = document.getElementById("filter-activity").value;
  const highlight = document.getElementById("filter-highlight").value;
  const sortBy    = document.getElementById("sort-by").value;
  const query     = document.getElementById("search-input").value.toLowerCase().trim();

  let repos = allRepos.filter(r => {
    if (lang && r.language !== lang) return false;
    if (archived !== "" && String(r.archived) !== archived) return false;
    if (activity === "recent" && !r.recent_activity) return false;
    if (activity === "stale"  && !r.stale) return false;
    if (highlight && !r[highlight]) return false;
    if (query) {
      const haystack = [
        r.full_name,
        r.description,
        r.llm_summary,
        ...(r.topics || []),
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  repos = [...repos].sort((a, b) => {
    const av = a[sortBy] ?? "";
    const bv = b[sortBy] ?? "";
    if (typeof av === "number") return bv - av;
    return bv > av ? 1 : bv < av ? -1 : 0;
  });

  return repos;
}

// ─── Render ────────────────────────────────────────────────────────────────────
function renderCards() {
  const repos = getFiltered();
  const grid = document.getElementById("repo-grid");
  const countEl = document.getElementById("result-count");

  countEl.textContent = `Showing ${repos.length} of ${allRepos.length} repositories`;

  if (repos.length === 0) {
    grid.innerHTML = '<p class="empty-state">No repositories match the current filters.</p>';
    return;
  }

  grid.innerHTML = repos.map(cardHTML).join("");
}

function cardHTML(repo) {
  const badges = [];
  if (repo.recent_star)      badges.push(`<span class="badge badge-recent">⭐ Recent</span>`);
  if (repo.watch_candidate)  badges.push(`<span class="badge badge-active">🔥 Active</span>`);
  if (repo.cleanup_candidate) badges.push(`<span class="badge badge-cleanup">🗑 Cleanup</span>`);
  if (repo.archived)         badges.push(`<span class="badge badge-archived">📦 Archived</span>`);

  const desc = repo.description
    ? `<p class="repo-desc">${esc(repo.description)}</p>`
    : "";

  const summary = repo.llm_summary
    ? `<div class="llm-summary">💡 ${esc(repo.llm_summary)}</div>`
    : "";

  const watchNote = repo.llm_watch_note
    ? `<div class="llm-watch-note">👁 ${esc(repo.llm_watch_note)}</div>`
    : "";

  const category = repo.llm_category
    ? `<span class="category">${esc(repo.llm_category)}</span>`
    : "";

  const topics = (repo.topics || []).length > 0
    ? `<div class="topics">${repo.topics.map(t => `<span class="topic">${esc(t)}</span>`).join("")}</div>`
    : "";

  const lang = repo.language
    ? `<span class="meta-item">🔵 ${esc(repo.language)}</span>`
    : "";

  const stars = `<span class="meta-item">⭐ ${fmt(repo.stargazers_count)}</span>`;
  const forks = repo.forks_count > 0
    ? `<span class="meta-item">🍴 ${fmt(repo.forks_count)}</span>`
    : "";

  const issues = repo.open_issues_count > 0
    ? `<span class="meta-item">🐛 ${repo.open_issues_count}</span>`
    : "";

  const pushed = repo.days_since_push != null
    ? `<span class="meta-item">📅 ${repo.days_since_push}d ago</span>`
    : "";

  const llmModel = repo.llm_model
    ? `<span class="llm-model">via ${esc(repo.llm_model)}</span>`
    : "";

  const starredDate = repo.starred_at
    ? `<span>starred ${shortDate(repo.starred_at)}</span>`
    : "";

  return `
<article class="repo-card">
  <div class="card-header">
    <div class="repo-name">
      <a href="${esc(repo.html_url)}" target="_blank" rel="noopener">${esc(repo.full_name)}</a>
    </div>
    <div class="card-badges">${badges.join("")}</div>
  </div>
  ${category}
  ${desc}
  ${summary}
  ${watchNote}
  ${topics}
  <div class="card-meta">${lang}${stars}${forks}${issues}${pushed}</div>
  <div class="card-footer">
    ${starredDate}
    ${llmModel}
  </div>
</article>`;
}

// ─── Controls binding ──────────────────────────────────────────────────────────
function bindControls() {
  ["filter-language","filter-archived","filter-activity","filter-highlight","sort-by"]
    .forEach(id => document.getElementById(id).addEventListener("change", renderCards));
  document.getElementById("search-input").addEventListener("input", renderCards);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function shortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
init();
