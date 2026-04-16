import { describe, expect, it } from 'vitest';
import { isDiscoveryDataset } from './discovery';

describe('discovery dataset validation', () => {
  it('rejects malformed source visibility values', () => {
    expect(
      isDiscoveryDataset({
        generated_at: '2026-04-16T00:00:00Z',
        source_repo_count: 1,
        entries: [
          {
            source: {
              full_name: 'owner/source',
              html_url: 'https://github.com/owner/source',
              description: 'Source',
              language: 'TypeScript',
              topics: ['claude-code'],
              stargazers_count: 1,
              forks_count: 1,
              visibility: 123,
            },
            seed_topics: ['claude-code'],
            expanded_topics: ['claude-code'],
            queries: ['topic:claude-code fork:false archived:false'],
            source_score: 1,
            suggestions: [],
          },
        ],
      })
    ).toBe(false);
  });
});
