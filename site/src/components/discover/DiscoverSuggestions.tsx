import { ExternalLink, Sparkles, Star, GitFork } from 'lucide-react';
import type { DiscoveryEntry } from '../../lib/discovery';

interface DiscoverSuggestionsProps {
  entry: DiscoveryEntry;
  rank: number;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function DiscoverSuggestions({ entry, rank }: DiscoverSuggestionsProps) {
  const synonymTopics = entry.expanded_topics.filter((topic) => !entry.seed_topics.includes(topic));

  return (
    <section className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-4 shadow-sm">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-gh-muted)]">
              #{rank}
            </span>
            <h2 className="truncate text-base font-semibold text-[var(--color-gh-strong)]">
              {entry.source.full_name}
            </h2>
          </div>
          <p className="max-w-4xl text-sm text-[var(--color-gh-muted)]">
            {entry.source.description || 'No description available.'}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-gh-muted)]">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-gh-accent)]" />
              Score {Math.round(entry.source_score)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2.5 py-1">
              {formatCount(entry.source.stargazers_count)} stars
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2.5 py-1">
              {entry.source.language || 'Unknown language'}
            </span>
          </div>
        </div>

        <a
          href={entry.source.html_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-fit items-center gap-1.5 rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-gh-muted)] transition-colors hover:border-[var(--color-gh-muted)] hover:text-[var(--color-gh-strong)]"
        >
          Open source
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {entry.seed_topics.map((topic) => (
          <span
            key={topic}
            className="rounded-full border border-[var(--color-gh-accent)] bg-[var(--color-gh-accent)]/10 px-2.5 py-1 text-xs text-[var(--color-gh-accent)]"
          >
            #{topic}
          </span>
        ))}
      </div>

      {synonymTopics.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-gh-muted)]">
          Expanded with {synonymTopics.map((topic) => `#${topic}`).join(', ')}.
        </p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {entry.suggestions.map((suggestion) => (
          <article
            key={suggestion.full_name}
            className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-[var(--color-gh-strong)]">
                  {suggestion.full_name}
                </h3>
                <p className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-gh-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    {formatCount(suggestion.stargazers_count)} stars
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5 text-[var(--color-gh-success)]" />
                    {formatCount(suggestion.forks_count)} forks
                  </span>
                </p>
              </div>
              <span className="rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-gh-muted)]">
                {Math.round(suggestion.score)}
              </span>
            </div>

            <p className="mt-3 line-clamp-2 text-sm text-[var(--color-gh-muted)]">
              {suggestion.description || 'No description available.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {suggestion.matched_topics.map((topic) => (
                <span
                  key={`${suggestion.full_name}-${topic}`}
                  className="rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] px-2 py-1 text-[11px] text-[var(--color-gh-muted)]"
                >
                  #{topic}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--color-gh-muted)]">
              <span>{suggestion.language || 'Unknown language'}</span>
              <a
                href={suggestion.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-gh-border)] px-2.5 py-1 font-medium text-[var(--color-gh-muted)] transition-colors hover:border-[var(--color-gh-muted)] hover:text-[var(--color-gh-strong)]"
              >
                Open repo
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
