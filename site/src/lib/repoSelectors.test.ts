import { describe, expect, it } from 'vitest';
import { getVisibleRepos, updateSortCriteria } from './repoSelectors';
import type { Repository, SortCriterion } from '../types';

function makeRepo(overrides: Partial<Repository>): Repository {
  return {
    full_name: 'owner/repo',
    html_url: 'https://github.com/owner/repo',
    description: 'desc',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    archived: false,
    fork: false,
    default_branch: 'main',
    pushed_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    starred_at: '2026-04-01T00:00:00Z',
    days_since_push: 10,
    recent_star: false,
    recent_activity: true,
    stale: false,
    watch_candidate: true,
    cleanup_candidate: false,
    llm_category: 'CLI/Tooling',
    llm_summary: 'summary',
    llm_watch_note: 'note',
    llm_model: 'openai/gpt-4o',
    llm_status: 'ok',
    llm_enriched_at: '2026-04-01T00:00:00Z',
    llm_content_hash: 'hash',
    ...overrides,
  };
}

describe('updateSortCriteria', () => {
  it('cycles sort direction for single sort', () => {
    let current: SortCriterion[] = [];
    current = updateSortCriteria(current, 'stargazers_count', false);
    expect(current).toEqual([{ key: 'stargazers_count', direction: 'desc' }]);
    current = updateSortCriteria(current, 'stargazers_count', false);
    expect(current).toEqual([{ key: 'stargazers_count', direction: 'asc' }]);
    current = updateSortCriteria(current, 'stargazers_count', false);
    expect(current).toEqual([]);
  });

  it('supports multi-sort with shift semantics', () => {
    const first = updateSortCriteria([], 'stargazers_count', false);
    const second = updateSortCriteria(first, 'forks_count', true);
    expect(second).toEqual([
      { key: 'stargazers_count', direction: 'desc' },
      { key: 'forks_count', direction: 'desc' },
    ]);
  });
});

describe('getVisibleRepos', () => {
  const repos = [
    makeRepo({
      full_name: 'org/a',
      stargazers_count: 20,
      forks_count: 2,
      llm_category: 'AI/ML',
      language: 'TypeScript',
      topics: ['ai-agents', 'mcp'],
      watch_candidate: true,
      cleanup_candidate: false,
      starred_at: '2026-04-12T00:00:00Z',
    }),
    makeRepo({
      full_name: 'org/b',
      stargazers_count: 80,
      forks_count: 5,
      llm_category: 'CLI/Tooling',
      language: 'Python',
      topics: ['cli', 'automation'],
      watch_candidate: false,
      cleanup_candidate: true,
      starred_at: '2026-04-10T00:00:00Z',
    }),
    makeRepo({
      full_name: 'org/c',
      stargazers_count: 80,
      forks_count: 1,
      llm_category: 'CLI/Tooling',
      language: 'Python',
      topics: ['cli', 'mcp'],
      watch_candidate: true,
      cleanup_candidate: false,
      starred_at: '2026-04-08T00:00:00Z',
    }),
  ];

  it('filters by view/search/category/language/topics', () => {
    const visible = getVisibleRepos({
      repos,
      viewMode: 'watch',
      searchQuery: 'org',
      filters: {
        category: ['CLI/Tooling'],
        language: ['Python'],
        status: [],
        topics: ['mcp'],
      },
      sortCriteria: [],
    });

    expect(visible.map((repo) => repo.full_name)).toEqual(['org/c']);
  });

  it('applies stable multi-sort with deterministic fallback', () => {
    const visible = getVisibleRepos({
      repos,
      viewMode: 'all',
      searchQuery: '',
      filters: { category: [], language: [], status: [], topics: [] },
      sortCriteria: [
        { key: 'stargazers_count', direction: 'desc' },
        { key: 'forks_count', direction: 'asc' },
      ],
    });

    expect(visible.map((repo) => repo.full_name)).toEqual(['org/c', 'org/b', 'org/a']);
  });
});
