import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverEngine } from './DiscoverEngine';

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          generated_at: '2026-04-16T00:00:00Z',
          source_repo_count: 2,
          public_source_repo_count: 1,
          entries: [
            {
              source: {
                full_name: 'owner/source',
                html_url: 'https://github.com/owner/source',
                description: 'A source repo',
                language: 'TypeScript',
                topics: ['claude-code', 'mcp'],
                stargazers_count: 120,
                forks_count: 10,
                visibility: 'public',
              },
              seed_topics: ['claude-code', 'mcp'],
              expanded_topics: ['claude-code', 'gemini-cli', 'mcp', 'mcp-server'],
              queries: ['topic:claude-code topic:mcp fork:false archived:false'],
              source_score: 123.4,
              suggestions: [
                {
                  full_name: 'foo/first',
                  html_url: 'https://github.com/foo/first',
                  description: 'Best candidate',
                  language: 'Python',
                  topics: ['claude-code', 'mcp'],
                  stargazers_count: 900,
                  forks_count: 20,
                  visibility: 'public',
                  score: 120.1,
                  matched_topics: ['claude-code', 'mcp'],
                  query_terms: ['topic:claude-code topic:mcp fork:false archived:false'],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  );
});

describe('DiscoverEngine', () => {
  it('renders pipeline-generated discovery suggestions', async () => {
    render(<DiscoverEngine />);

    await screen.findByText(/topic-based suggestions/i);
    await screen.findByText('owner/source');
    expect(screen.getByText('foo/first')).toBeInTheDocument();
    expect(screen.getAllByText(/#claude-code/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/#gemini-cli/i).length).toBeGreaterThan(0);
  });

  it('shows a helpful empty state when the discovery dataset is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' }))
    );

    render(<DiscoverEngine />);

    await screen.findByText(/no discovery dataset is available yet/i);
    expect(screen.getByText(/discover_similar.py/i)).toBeInTheDocument();
  });

  it('surfaces malformed payloads clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            generated_at: '2026-04-16T00:00:00Z',
            source_repo_count: 1,
            entries: [{ source: { full_name: 'broken' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    render(<DiscoverEngine />);

    await waitFor(() => {
      expect(screen.getByText(/discovery payload is malformed/i)).toBeInTheDocument();
    });
  });
});
