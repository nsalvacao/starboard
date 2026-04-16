import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsWorkspace } from './AnalyticsWorkspace';
import { useStore } from '../../store/useStore';
import type { Repository } from '../../types';

vi.mock('recharts', () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: Mock,
    LineChart: Mock,
    BarChart: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Line: Mock,
    Bar: Mock,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeRepo(overrides: Partial<Repository>): Repository {
  return {
    full_name: 'org/a',
    html_url: 'https://github.com/org/a',
    description: 'A repo',
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
    days_since_push: 12,
    recent_star: false,
    recent_activity: true,
    stale: false,
    watch_candidate: true,
    cleanup_candidate: false,
    visibility: 'public',
    llm_category: 'CLI/Tooling',
    llm_summary: 'Summary',
    llm_watch_note: 'Watch note',
    llm_model: 'openai/gpt-4o',
    llm_status: 'ok',
    llm_enriched_at: '2026-04-01T00:00:00Z',
    llm_content_hash: 'hash',
    ...overrides,
  };
}

beforeEach(() => {
  useStore.setState({
    repos: [makeRepo({ full_name: 'org/a' }), makeRepo({ full_name: 'org/b', stargazers_count: 22, forks_count: 4 })],
    isLoading: false,
    error: null,
    viewMode: 'analytics',
    searchQuery: '',
    filters: { category: [], language: [], status: [], topics: [] },
    sortCriteria: [],
    activeRepoFullName: null,
    preferences: { theme: 'dark', density: 'normal' },
    selectedRepos: [],
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            date: '2026-04-01',
            repos: [
              { full_name: 'org/a', stargazers_count: 10, forks_count: 2 },
              { full_name: 'org/b', stargazers_count: 15, forks_count: 3 },
            ],
          },
          {
            date: '2026-04-16',
            repos: [
              { full_name: 'org/a', stargazers_count: 14, forks_count: 2 },
              { full_name: 'org/b', stargazers_count: 21, forks_count: 4 },
            ],
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  );
});

describe('AnalyticsWorkspace', () => {
  it('loads history and switches between visible and portfolio scopes', async () => {
    const user = userEvent.setup();

    render(<AnalyticsWorkspace repos={useStore.getState().repos} visibleRepos={[useStore.getState().repos[0]]} />);

    await screen.findByText(/latest snapshot 2026-04-16/i);
    expect(screen.getByText(/1 repo in scope/i)).toBeInTheDocument();
    expect(screen.queryByText('org/b')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /portfolio/i }));

    await waitFor(() => expect(screen.getByText(/2 repos in scope/i)).toBeInTheDocument());
    expect(screen.getByText('org/b')).toBeInTheDocument();
  });

  it('aborts the history request when the workspace unmounts', async () => {
    let signal: AbortSignal | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? null;
        return new Promise<Response>(() => {});
      })
    );

    const { unmount } = render(
      <AnalyticsWorkspace repos={useStore.getState().repos} visibleRepos={useStore.getState().repos} />
    );

    await waitFor(() => expect(signal).not.toBeNull());

    unmount();

    const capturedSignal = signal as AbortSignal | null;
    if (capturedSignal === null) {
      throw new Error('Expected the fetch signal to be captured');
    }

    expect(capturedSignal.aborted).toBe(true);
  });

  it('surfaces a clear error when the history payload is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              date: '2026-04-16',
              repos: [
                { full_name: 'org/a', stargazers_count: 'ten', forks_count: 2 },
              ],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    render(<AnalyticsWorkspace repos={useStore.getState().repos} visibleRepos={useStore.getState().repos} />);

    await screen.findByText(/history payload is malformed/i);
  });
});
