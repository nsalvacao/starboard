import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { RepoDetailModal } from './RepoDetailModal';
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
    license_spdx: 'MIT',
    latest_release: { tag: 'v1.0.0', date: '2026-03-01T00:00:00Z', url: 'https://github.com/org/repo/releases/tag/v1.0.0' },
    readme_excerpt: 'README excerpt',
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
    cached_pushed_at: '2026-04-01T00:00:00Z',
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
    repos: [],
    viewMode: 'all',
    searchQuery: '',
    filters: { category: [], language: [], status: [], topics: [] },
    sortCriteria: [],
    selectedRepos: [],
    activeRepoFullName: 'org/repo',
  });
});

afterEach(() => {
  document.body.style.overflow = '';
  useStore.setState({
    activeRepoFullName: null,
    selectedRepos: [],
    filters: { category: [], language: [], status: [], topics: [] },
  });
});

describe('RepoDetailModal', () => {
  it('locks background scroll and traps focus', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();

    function Harness() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <RepoDetailModal
          repo={repo}
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            useStore.setState({ activeRepoFullName: null });
          }}
        />
      );
    }

    render(<Harness />);

    expect(document.body.style.overflow).toBe('hidden');

    const dialog = screen.getByRole('dialog', { name: /repository details for org\/repo/i });
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const compareButton = focusable[0];
    const openRepoLink = focusable[1];
    const closeButton = focusable[2];
    const topicButton = focusable[3];

    await waitFor(() => expect(compareButton).toHaveFocus());
    await user.tab();
    expect(openRepoLink).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(topicButton).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('toggles topic filters and compare selection from the modal', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();

    function Harness() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <RepoDetailModal
          repo={repo}
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            useStore.setState({ activeRepoFullName: null });
          }}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'cli' }));
    expect(useStore.getState().filters.topics).toContain('cli');

    await user.click(screen.getByRole('button', { name: /add to compare/i }));
    expect(useStore.getState().selectedRepos).toContain('org/repo');

    await user.click(screen.getByRole('button', { name: /remove from compare/i }));
    expect(useStore.getState().selectedRepos).not.toContain('org/repo');
  });
});
