import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverEngine } from './DiscoverEngine';

const discoveryEntries = Array.from({ length: 5 }, (_unused, index) => {
  const rank = index + 1;
  return {
    source: {
      full_name: `owner/source-${rank}`,
      html_url: `https://github.com/owner/source-${rank}`,
      description: `A source repo ${rank}`,
      language: 'TypeScript',
      topics: ['claude-code', 'mcp'],
      stargazers_count: 120 + rank,
      forks_count: 10,
      visibility: 'public',
    },
    seed_topics: ['claude-code', 'mcp'],
    expanded_topics: ['claude-code', 'gemini-cli', 'mcp', 'mcp-server'],
    queries: ['topic:claude-code topic:mcp fork:false archived:false'],
    source_score: 123.4 + rank,
    suggestions: [
      {
        full_name: `foo/first-${rank}`,
        html_url: `https://github.com/foo/first-${rank}`,
        description: `Best candidate ${rank}`,
        language: 'Python',
        topics: ['claude-code', 'mcp'],
        stargazers_count: 900 - rank,
        forks_count: 20,
        visibility: 'public',
        score: 120.1 + rank,
        matched_topics: ['claude-code', 'mcp'],
        query_terms: ['topic:claude-code topic:mcp fork:false archived:false'],
      },
    ],
  };
});

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
          entries: discoveryEntries,
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
    await screen.findByText('owner/source-1');
    await screen.findByText('owner/source-5');
    expect(screen.getByText('foo/first-1')).toBeInTheDocument();
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
