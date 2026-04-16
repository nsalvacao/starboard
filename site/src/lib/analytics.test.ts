import { describe, expect, it } from 'vitest';
import { bucketCounts, calculatePortfolioHealthScore, calculateTrendingDelta } from './analytics';
import type { Repository } from '../types';

function makeRepo(overrides: Partial<Repository>): Repository {
  return {
    full_name: 'owner/repo',
    html_url: 'https://github.com/owner/repo',
    description: 'desc',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 10,
    forks_count: 2,
    open_issues_count: 0,
    archived: false,
    fork: false,
    default_branch: 'main',
    pushed_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    starred_at: '2026-04-01T00:00:00Z',
    days_since_push: 30,
    recent_star: false,
    recent_activity: true,
    stale: false,
    watch_candidate: true,
    cleanup_candidate: false,
    visibility: 'public',
    license_spdx: null,
    latest_release: null,
    readme_excerpt: null,
    contributor_count: null,
    commit_activity_52w: null,
    community_health: null,
    cached_pushed_at: '2026-04-01T00:00:00Z',
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

describe('bucketCounts', () => {
  it('groups tail values into Other', () => {
    const buckets = bucketCounts(
      [{ topic: 'ai' }, { topic: 'ai' }, { topic: 'mcp' }, { topic: 'cli' }, { topic: 'tools' }],
      (item) => item.topic,
      2
    );

    expect(buckets).toEqual([
      { label: 'ai', count: 2 },
      { label: 'cli', count: 1 },
      { label: 'Other', count: 2 },
    ]);
  });
});

describe('calculateTrendingDelta', () => {
  it('compares current and previous snapshots', () => {
    const deltas = calculateTrendingDelta(
      {
        date: '2026-04-16',
        repos: [
          { full_name: 'b/repo', stargazers_count: 18, forks_count: 5 },
          { full_name: 'a/repo', stargazers_count: 20, forks_count: 3 },
        ],
      },
      {
        date: '2026-04-15',
        repos: [
          { full_name: 'a/repo', stargazers_count: 10, forks_count: 1 },
          { full_name: 'b/repo', stargazers_count: 12, forks_count: 4 },
        ],
      }
    );

    expect(deltas).toEqual([
      {
        full_name: 'a/repo',
        stargazers_count: 20,
        forks_count: 3,
        star_delta: 10,
        fork_delta: 2,
      },
      {
        full_name: 'b/repo',
        stargazers_count: 18,
        forks_count: 5,
        star_delta: 6,
        fork_delta: 1,
      },
    ]);
  });
});

describe('calculatePortfolioHealthScore', () => {
  it('averages the sub-scores into a portfolio score', () => {
    const score = calculatePortfolioHealthScore([
      makeRepo({
        days_since_push: 10,
        license_spdx: 'MIT',
        latest_release: { tag: 'v1.0.0', date: '2026-03-01T00:00:00Z', url: 'https://example.com' },
        readme_excerpt: 'readme',
        contributor_count: 4,
        commit_activity_52w: [1, 2, 3],
        community_health: {
          score: 90,
          has_code_of_conduct: true,
          has_contributing: true,
          has_issue_template: true,
          has_pull_request_template: true,
          has_license: true,
          has_readme: true,
        },
      }),
      makeRepo({
        full_name: 'owner/other',
        llm_status: 'failed',
        archived: true,
        stale: true,
        days_since_push: 365,
        license_spdx: null,
        latest_release: null,
        readme_excerpt: null,
        contributor_count: null,
        commit_activity_52w: null,
        community_health: null,
      }),
    ]);

    expect(score).toEqual({
      score: 50,
      freshness: 49,
      enrichmentCoverage: 50,
      maintenanceHealth: 50,
      metadataDepth: 50,
    });
  });
});
