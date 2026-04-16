import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TopNavigationBar } from './TopNavigationBar';
import { applyTheme } from '../../lib/theme';
import { useStore } from '../../store/useStore';
import type { Repository } from '../../types';

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

function Harness() {
  const theme = useStore((state) => state.preferences.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <TopNavigationBar />;
}

beforeEach(() => {
  useStore.setState({
    repos: [makeRepo()],
    isLoading: false,
    error: null,
    viewMode: 'all',
    searchQuery: '',
    filters: { category: [], language: [], status: [], topics: [] },
    sortCriteria: [],
    activeRepoFullName: null,
    preferences: { theme: 'dark', density: 'normal' },
    selectedRepos: [],
  });
});

describe('TopNavigationBar', () => {
  it('toggles the persisted theme and updates the document theme', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));

    await user.click(screen.getByRole('button', { name: /switch to light theme/i }));

    await waitFor(() => expect(useStore.getState().preferences.theme).toBe('light'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('navigates to the analytics workspace', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /analytics/i }));

    expect(useStore.getState().viewMode).toBe('analytics');
  });
});
