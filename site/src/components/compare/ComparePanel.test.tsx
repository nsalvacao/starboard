import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ComparePanel } from './ComparePanel';
import { useStore } from '../../store/useStore';
import type { Repository } from '../../types';

function makeRepo(fullName: string, stars: number, daysSincePush: number, watchCandidate = false, cleanupCandidate = false): Repository {
  return {
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    description: `${fullName} description`,
    language: 'TypeScript',
    topics: ['cli'],
    stargazers_count: stars,
    forks_count: 2,
    open_issues_count: 0,
    archived: false,
    fork: false,
    default_branch: 'main',
    pushed_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    starred_at: '2026-04-01T00:00:00Z',
    days_since_push: daysSincePush,
    recent_star: false,
    recent_activity: true,
    stale: false,
    watch_candidate: watchCandidate,
    cleanup_candidate: cleanupCandidate,
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
    searchQuery: '',
    filters: { category: [], language: [], status: [], topics: [] },
    sortCriteria: [],
    viewMode: 'compare',
    repos: [],
    selectedRepos: [],
    activeRepoFullName: null,
  });
});

describe('ComparePanel', () => {
  it('summarizes the selected repos and opens details from the tray', async () => {
    const user = userEvent.setup();
    const repos = [makeRepo('org/repo-a', 10, 5, true), makeRepo('org/repo-b', 20, 15, false, true)];

    useStore.setState({
      repos,
      selectedRepos: ['org/repo-a', 'org/repo-b'],
      viewMode: 'compare',
    });

    render(<ComparePanel />);

    expect(screen.getByText('Repos').closest('div')).toHaveTextContent('2');
    expect(screen.getByText('Avg Stars').closest('div')).toHaveTextContent('15');
    expect(screen.getByText('Avg Push Age').closest('div')).toHaveTextContent('10d');
    expect(screen.getByText('Watch / Cleanup').closest('div')).toHaveTextContent('1 / 1');

    await user.click(screen.getAllByRole('button', { name: /view details/i })[0]);
    expect(useStore.getState().activeRepoFullName).toBe('org/repo-a');
  });
});
