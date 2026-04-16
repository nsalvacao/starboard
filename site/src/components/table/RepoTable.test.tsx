import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoTable } from './RepoTable';
import { useStore } from '../../store/useStore';
import type { Repository } from '../../types';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 75,
    getVirtualItems: () => [{ index: 0, size: 75, start: 0 }],
  }),
}));

function makeRepo(): Repository {
  return {
    full_name: 'org/repo',
    html_url: 'https://github.com/org/repo',
    description: 'Repository description',
    language: 'TypeScript',
    topics: ['cli'],
    stargazers_count: 10,
    forks_count: 2,
    open_issues_count: 0,
    archived: false,
    fork: false,
    default_branch: 'main',
    pushed_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    starred_at: '2026-04-01T00:00:00Z',
    days_since_push: 7,
    recent_star: false,
    recent_activity: true,
    stale: false,
    watch_candidate: true,
    cleanup_candidate: false,
    llm_category: 'CLI/Tooling',
    llm_summary: 'Summary',
    llm_watch_note: 'Watch note',
    llm_model: 'openai/gpt-4o',
    llm_status: 'ok',
    llm_enriched_at: '2026-04-01T00:00:00Z',
    llm_content_hash: 'hash',
  };
}

beforeEach(() => {
  useStore.setState({
    selectedRepos: [],
    activeRepoId: null,
    sortCriteria: [],
  });
});

describe('RepoTable', () => {
  it('does not open the detail modal when the row checkbox is clicked', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();

    useStore.setState({
      repos: [repo],
      viewMode: 'all',
      searchQuery: '',
      filters: { category: [], language: [], status: [], topics: [] },
    });

    render(<RepoTable repos={[repo]} />);

    await user.click(screen.getByRole('checkbox', { name: /select org\/repo for comparison/i }));

    expect(useStore.getState().selectedRepos).toContain('org/repo');
    expect(useStore.getState().activeRepoId).toBeNull();
  });

  it('opens the detail modal from the row via keyboard', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();

    useStore.setState({
      repos: [repo],
      viewMode: 'all',
      searchQuery: '',
      filters: { category: [], language: [], status: [], topics: [] },
    });

    render(<RepoTable repos={[repo]} />);

    const row = screen.getByRole('button', { name: /org\/repo/i });
    row.focus();
    await user.keyboard('{Enter}');

    expect(useStore.getState().activeRepoId).toBe('org/repo');
  });
});
