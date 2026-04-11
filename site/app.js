'use strict';

const DATA_URL = 'data/stars.json';

// ── State ─────────────────────────────────────────────────────────────────────
let repos = [];
let filtered = [];
const state = {
  nav:      'all',   // 'all'|'watch'|'explore'|'cleanup'|'pending'|<category>
  category: '',
  language: '',
  status:   '',
  stars:    '',
  search:   '',
  sortBy:   'stargazers_count',
  sortDir:  'desc',
  expanded: null,    // full_name of expanded row, or null
  selected: new Set(),
};

// ── Utils ─────────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = n => n >= 1000
  ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  : String(n);

function relDate(isoStr) {
  if (!isoStr) return '\u2014';
  const d = Math.floor((Date.now() - new Date(isoStr)) / 86400000);
  if (d < 1)   return 'today';
  if (d < 7)   return d + 'd';
  if (d < 30)  return Math.floor(d / 7) + 'w';
  if (d < 365) return Math.floor(d / 30) + 'mo';
  return Math.floor(d / 365) + 'y';
}

function getStatus(repo) {
  if (!repo.llm_status || repo.llm_status !== 'ok') return 'pending';
  if (repo.cleanup_candidate) return 'cleanup';
  if (repo.watch_candidate)   return 'watch';
  return 'stale';
}

function statusLabel(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function navCount(navId) {
  switch (navId) {
    case 'all':     return repos.length;
    case 'watch':   return repos.filter(r => r.watch_candidate).length;
    case 'explore': return repos.filter(r => !r.watch_candidate && !r.cleanup_candidate && r.llm_status === 'ok').length;
    case 'cleanup': return repos.filter(r => r.cleanup_candidate).length;
    case 'pending': return repos.filter(r => !r.llm_status || r.llm_status !== 'ok').length;
    default: return repos.filter(r => r.llm_category === navId).length;
  }
}

// ── Data Loading ──────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    repos = await res.json();
  } catch (e) {
    document.getElementById('repo-tbody').innerHTML =
      '<tr><td colspan="7" style="padding:64px;text-align:center;color:var(--status-cleanup)">' +
      'Error loading data: ' + esc(e.message) + '</td></tr>';
    return;
  }
  applyFilters();
  renderSidebar();
  populateFilterDropdowns();
  renderFilterBar();
  renderTable();
  renderSyncInfo();
  bindEvents();
}

// ── Filter + Sort ─────────────────────────────────────────────────────────────
function applyFilters() {
  let result = repos;

  // Sidebar nav filter
  switch (state.nav) {
    case 'watch':   result = result.filter(r => r.watch_candidate); break;
    case 'explore': result = result.filter(r => !r.watch_candidate && !r.cleanup_candidate && r.llm_status === 'ok'); break;
    case 'cleanup': result = result.filter(r => r.cleanup_candidate); break;
    case 'pending': result = result.filter(r => !r.llm_status || r.llm_status !== 'ok'); break;
    case 'all': break;
    default: result = result.filter(r => r.llm_category === state.nav);
  }

  // Dropdown filters
  if (state.category) result = result.filter(r => r.llm_category === state.category);
  if (state.language) result = result.filter(r => r.language === state.language);
  if (state.status)   result = result.filter(r => getStatus(r) === state.status);

  if (state.stars) {
    const parts = state.stars.split('-');
    const min = Number(parts[0]);
    const max = parts[1] !== '' ? Number(parts[1]) : Infinity;
    result = result.filter(r => r.stargazers_count >= min && r.stargazers_count <= max);
  }

  // Full-text search
  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(r =>
      r.full_name.toLowerCase().includes(q) ||
      (r.llm_summary || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  }

  // Sort
  filtered = [...result].sort((a, b) => {
    let av = a[state.sortBy], bv = b[state.sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return state.sortDir === 'asc' ? cmp : -cmp;
  });
}

// ── Render Sidebar ────────────────────────────────────────────────────────────
function renderSidebar() {
  const fixed = [
    { id: 'all',     label: 'All Repos' },
    { id: 'watch',   label: 'Watch Candidates' },
    { id: 'explore', label: 'Explore' },
    { id: 'cleanup', label: 'Cleanup' },
    { id: 'pending', label: 'Not Enriched' },
  ];

  document.getElementById('nav-fixed').innerHTML = fixed.map(n =>
    '<li class="nav-item' + (state.nav === n.id ? ' active' : '') + '" data-nav="' + esc(n.id) + '">' +
    '<span>' + n.label + '</span>' +
    '<span class="nav-count">' + navCount(n.id) + '</span></li>'
  ).join('');

  // Dynamic categories sorted by count desc
  const cats = {};
  for (const r of repos) if (r.llm_category) cats[r.llm_category] = (cats[r.llm_category] || 0) + 1;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);

  document.getElementById('nav-categories').innerHTML = sorted.map(([cat, count]) =>
    '<li class="nav-item' + (state.nav === cat ? ' active' : '') + '" data-nav="' + esc(cat) + '">' +
    '<span>' + esc(cat) + '</span>' +
    '<span class="nav-count">' + count + '</span></li>'
  ).join('');
}

// ── Populate Filter Dropdowns ─────────────────────────────────────────────────
function populateFilterDropdowns() {
  const cats  = [...new Set(repos.map(r => r.llm_category).filter(Boolean))].sort();
  const langs = [...new Set(repos.map(r => r.language).filter(Boolean))].sort();

  document.getElementById('filter-category').innerHTML =
    '<option value="">All Categories</option>' +
    cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');

  document.getElementById('filter-language').innerHTML =
    '<option value="">All Languages</option>' +
    langs.map(l => '<option value="' + esc(l) + '">' + esc(l) + '</option>').join('');

  document.getElementById('filter-status').innerHTML =
    '<option value="">All Status</option>' +
    '<option value="watch">Watch</option>' +
    '<option value="stale">Stale</option>' +
    '<option value="cleanup">Cleanup</option>' +
    '<option value="pending">Pending</option>';

  document.getElementById('filter-stars').innerHTML =
    '<option value="">Any Stars</option>' +
    '<option value="0-99">&lt; 100</option>' +
    '<option value="100-999">100 \u2013 999</option>' +
    '<option value="1000-9999">1k \u2013 10k</option>' +
    '<option value="10000-">10k+</option>';
}

// ── Render Filter Bar ─────────────────────────────────────────────────────────
function renderFilterBar() {
  document.getElementById('result-count').textContent =
    filtered.length + ' of ' + repos.length + ' repos';
}

// ── Render Table ──────────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('repo-tbody');
  const empty = document.getElementById('empty-state');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    updateSortIndicators();
    return;
  }
  empty.classList.add('hidden');

  const html = [];
  for (const repo of filtered) {
    const status = getStatus(repo);
    const slash  = repo.full_name.indexOf('/');
    const owner  = repo.full_name.slice(0, slash);
    const name   = repo.full_name.slice(slash + 1);
    const sel    = state.selected.has(repo.full_name);
    const exp    = state.expanded === repo.full_name;

    html.push(
      '<tr class="repo-row' + (sel ? ' selected' : '') + (exp ? ' expanded' : '') + '" data-fn="' + esc(repo.full_name) + '">' +
      '<td class="col-check" onclick="event.stopPropagation()">' +
      '<input type="checkbox" data-fn="' + esc(repo.full_name) + '"' + (sel ? ' checked' : '') + '></td>' +
      '<td class="col-repo">' +
      '<div class="repo-name"><span class="repo-owner">' + esc(owner) + '/</span>' + esc(name) + '</div>' +
      (repo.llm_summary ? '<div class="repo-summary" title="' + esc(repo.llm_summary) + '">' + esc(repo.llm_summary) + '</div>' : '') +
      '</td>' +
      '<td class="col-category">' +
      (repo.llm_category ? '<span class="badge-cat">' + esc(repo.llm_category) + '</span>' : '<span style="color:var(--text-muted)">\u2014</span>') +
      '</td>' +
      '<td class="col-lang">' + esc(repo.language || '\u2014') + '</td>' +
      '<td class="col-stars"><span class="stars-val">' + fmt(repo.stargazers_count) + '</span></td>' +
      '<td class="col-status"><span class="chip chip-' + status + '">' + statusLabel(status) + '</span></td>' +
      '<td class="col-date">' + relDate(repo.pushed_at) + '</td>' +
      '</tr>'
    );

    if (exp) html.push(expandedRowHTML(repo));
  }

  tbody.innerHTML = html.join('');
  updateSortIndicators();
}

function expandedRowHTML(repo) {
  const topics = (repo.topics || [])
    .map(t => '<span class="topic-tag">' + esc(t) + '</span>')
    .join('');

  return '<tr class="expanded-row"><td colspan="7"><div class="expanded-content">' +
    '<div>' +
    (repo.llm_summary ?
      '<div class="exp-field"><div class="exp-label">LLM Summary</div>' +
      '<div class="exp-value">' + esc(repo.llm_summary) + '</div></div>' : '') +
    (repo.llm_watch_note ?
      '<div class="exp-field"><div class="exp-label">Watch Note</div>' +
      '<div class="exp-value" style="color:var(--status-watch)">' + esc(repo.llm_watch_note) + '</div></div>' : '') +
    (repo.description ?
      '<div class="exp-field"><div class="exp-label">Description</div>' +
      '<div class="exp-value">' + esc(repo.description) + '</div></div>' : '') +
    (topics ?
      '<div class="exp-field"><div class="exp-label">Topics</div><div>' + topics + '</div></div>' : '') +
    '</div>' +
    '<div>' +
    '<div class="exp-field"><div class="exp-label">Stats</div>' +
    '<div class="exp-value">\u2605 ' + fmt(repo.stargazers_count) +
    ' \u00a0\u2442 ' + fmt(repo.forks_count) + ' forks' +
    ' \u00a0' + repo.open_issues_count + ' issues</div></div>' +
    '<div class="exp-field"><div class="exp-label">Starred</div>' +
    '<div class="exp-value">' + relDate(repo.starred_at) + ' ago' +
    (repo.starred_at ? ' (' + new Date(repo.starred_at).toLocaleDateString() + ')' : '') + '</div></div>' +
    '<div class="exp-field"><div class="exp-label">Last Push</div>' +
    '<div class="exp-value">' + relDate(repo.pushed_at) + ' ago' +
    (repo.pushed_at ? ' (' + new Date(repo.pushed_at).toLocaleDateString() + ')' : '') + '</div></div>' +
    (repo.llm_model ?
      '<div class="exp-field"><div class="exp-label">LLM Model</div>' +
      '<div class="exp-value" style="color:var(--text-muted)">' + esc(repo.llm_model) + '</div></div>' : '') +
    '<div class="exp-field exp-links">' +
    '<a href="' + esc(repo.html_url) + '" target="_blank" rel="noopener">GitHub \u2197</a>' +
    '<a href="' + esc(repo.html_url) + '/forks" target="_blank" rel="noopener">Forks (' + fmt(repo.forks_count) + ')</a>' +
    '<a href="' + esc(repo.html_url) + '/issues" target="_blank" rel="noopener">Issues (' + repo.open_issues_count + ')</a>' +
    '</div>' +
    '</div>' +
    '</div></td></tr>';
}

// ── Render Compare Panel ──────────────────────────────────────────────────────
function renderComparePanel() {
  const sel  = repos.filter(r => state.selected.has(r.full_name));
  const cats = [...new Set(sel.map(r => r.llm_category).filter(Boolean))];
  document.getElementById('compare-title').textContent = cats.join(' / ') || 'Mixed Categories';

  document.getElementById('compare-cards').innerHTML = sel.map(repo =>
    '<div class="compare-card">' +
    '<h4><a href="' + esc(repo.html_url) + '" target="_blank" rel="noopener">' + esc(repo.full_name) + '</a></h4>' +
    (repo.llm_summary ? '<p class="compare-summary">' + esc(repo.llm_summary) + '</p>' : '') +
    '<div class="cmp-metric"><span class="lbl">Stars</span><span>' + fmt(repo.stargazers_count) + '</span></div>' +
    '<div class="cmp-metric"><span class="lbl">Forks</span><span>' + fmt(repo.forks_count) + '</span></div>' +
    '<div class="cmp-metric"><span class="lbl">Language</span><span>' + esc(repo.language || '\u2014') + '</span></div>' +
    '<div class="cmp-metric"><span class="lbl">Last push</span><span>' + relDate(repo.pushed_at) + '</span></div>' +
    '<div class="cmp-metric"><span class="lbl">Status</span>' +
    '<span class="chip chip-' + getStatus(repo) + '">' + statusLabel(getStatus(repo)) + '</span></div>' +
    (repo.llm_watch_note ?
      '<div style="margin-top:8px;font-size:12px;color:var(--status-watch)">' + esc(repo.llm_watch_note) + '</div>' : '') +
    '</div>'
  ).join('');

  // Aggregate
  const sortedByStars = [...sel].sort((a, b) => a.stargazers_count - b.stargazers_count);
  const mid = Math.floor(sortedByStars.length / 2);
  const medianStars = sortedByStars.length % 2 === 0
    ? Math.round((sortedByStars[mid - 1].stargazers_count + sortedByStars[mid].stargazers_count) / 2)
    : sortedByStars[mid].stargazers_count;
  const langs = [...new Set(sel.map(r => r.language).filter(Boolean))];
  const totalStars = sel.reduce((s, r) => s + r.stargazers_count, 0);

  document.getElementById('compare-aggregate').innerHTML =
    '<strong>Aggregate (' + sel.length + ' repos selected)</strong>' +
    '<div class="cmp-metric"><span class="lbl">Median Stars</span><span>' + fmt(medianStars) + '</span></div>' +
    '<div class="cmp-metric"><span class="lbl">Total Stars</span><span>' + fmt(totalStars) + '</span></div>' +
    '<div class="cmp-metric"><span class="lbl">Languages</span><span>' + esc(langs.join(', ') || '\u2014') + '</span></div>';
}

// ── Update Sort Indicators ────────────────────────────────────────────────────
function updateSortIndicators() {
  document.querySelectorAll('#repo-table th.sortable').forEach(th => {
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    ind.textContent = th.dataset.sort === state.sortBy
      ? (state.sortDir === 'asc' ? ' \u2191' : ' \u2193')
      : '';
  });
}

// ── Render Sync Info ──────────────────────────────────────────────────────────
function renderSyncInfo() {
  const latest = repos.map(r => r.llm_enriched_at).filter(Boolean).sort().pop();
  document.getElementById('sync-info').textContent = latest ? 'Last sync: ' + relDate(latest) : '';
  document.getElementById('repo-count').textContent = repos.length + ' repos';
}

// ── Update Compare Button ─────────────────────────────────────────────────────
function updateCompareButton() {
  const count = state.selected.size;
  const btn   = document.getElementById('compare-btn');
  const panel = document.getElementById('compare-panel');
  if (count >= 2 && count <= 4) {
    btn.classList.remove('hidden');
    btn.textContent = 'Compare ' + count + ' repos';
  } else {
    btn.classList.add('hidden');
    panel.classList.add('hidden');
  }
}

function resetDropdowns() {
  ['filter-category', 'filter-language', 'filter-status', 'filter-stars'].forEach(id => {
    document.getElementById(id).value = '';
  });
  state.category = '';
  state.language = '';
  state.status   = '';
  state.stars    = '';
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
  // Sidebar nav
  document.getElementById('sidebar').addEventListener('click', e => {
    const li = e.target.closest('[data-nav]');
    if (!li) return;
    state.nav      = li.dataset.nav;
    state.expanded = null;
    state.selected.clear();
    resetDropdowns();
    applyFilters();
    renderSidebar();
    renderFilterBar();
    renderTable();
    updateCompareButton();
  });

  // Filter dropdowns
  const dropMap = {
    'filter-category': 'category',
    'filter-language':  'language',
    'filter-status':    'status',
    'filter-stars':     'stars',
  };
  Object.entries(dropMap).forEach(([id, key]) => {
    document.getElementById(id).addEventListener('change', e => {
      state[key] = e.target.value;
      applyFilters();
      renderFilterBar();
      renderTable();
    });
  });

  // Search (debounced 200ms)
  let searchTimer;
  document.getElementById('search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      applyFilters();
      renderFilterBar();
      renderTable();
    }, 200);
  });

  // Table: sort / expand / checkbox / select-all
  document.getElementById('repo-table').addEventListener('click', e => {
    // Sort header
    const th = e.target.closest('th.sortable');
    if (th) {
      const col = th.dataset.sort;
      if (state.sortBy === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy  = col;
        state.sortDir = (col === 'stargazers_count' || col === 'days_since_push') ? 'desc' : 'asc';
      }
      applyFilters();
      renderTable();
      return;
    }

    // Row checkbox
    const cb = e.target.closest('input[type="checkbox"][data-fn]');
    if (cb) {
      if (cb.checked) state.selected.add(cb.dataset.fn);
      else            state.selected.delete(cb.dataset.fn);
      renderTable();
      updateCompareButton();
      return;
    }

    // Select-all
    if (e.target.id === 'select-all') {
      if (e.target.checked) filtered.forEach(r => state.selected.add(r.full_name));
      else                  filtered.forEach(r => state.selected.delete(r.full_name));
      renderTable();
      updateCompareButton();
      return;
    }

    // Row expand/collapse
    const row = e.target.closest('tr.repo-row');
    if (row) {
      const fn = row.dataset.fn;
      state.expanded = state.expanded === fn ? null : fn;
      renderTable();
    }
  });

  // Compare button
  document.getElementById('compare-btn').addEventListener('click', () => {
    renderComparePanel();
    const panel = document.getElementById('compare-panel');
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth' });
  });

  // Compare close
  document.getElementById('compare-close').addEventListener('click', () => {
    document.getElementById('compare-panel').classList.add('hidden');
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
