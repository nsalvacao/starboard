import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DiscoverSuggestions } from './DiscoverSuggestions';
import {
  isDiscoveryDataset,
  normalizeDiscoveryDataset,
  type DiscoveryDataset,
} from '../../lib/discovery';

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function DiscoverEngine() {
  const [dataset, setDataset] = useState<DiscoveryDataset | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDiscovery() {
      setStatus('loading');
      setError(null);

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/discoveries.json`, {
          signal: controller.signal,
        });

        if (response.status === 404) {
          if (!controller.signal.aborted) {
            setDataset(null);
            setStatus('missing');
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load discovery suggestions: ${response.status} ${response.statusText}`);
        }

        const payload: unknown = await response.json();
        if (!isDiscoveryDataset(payload)) {
          throw new Error('Discovery payload is malformed');
        }

        if (controller.signal.aborted) return;
        setDataset(normalizeDiscoveryDataset(payload));
        setStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setDataset(null);
        setStatus('error');
        setError(error instanceof Error ? error.message : 'Failed to load discovery suggestions');
      }
    }

    loadDiscovery();

    return () => {
      controller.abort();
    };
  }, []);

  const entries = useMemo(() => dataset?.entries ?? [], [dataset]);
  const totalSuggestions = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.suggestions.length, 0),
    [entries]
  );
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-gh-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-gh-accent)]" />
              Discover
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-gh-strong)]">Topic-based suggestions</h1>
            <p className="max-w-3xl text-sm text-[var(--color-gh-muted)]">
              Curated synonym groups and GitHub topic search drive these suggestions. The pipeline keeps the
              matches reproducible instead of calculating them ad hoc in the browser.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">Generated</div>
              <div className="mt-1 text-sm font-semibold text-[var(--color-gh-strong)]">
                {dataset ? formatDateLabel(dataset.generated_at) : 'Pending'}
              </div>
            </div>
            <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">Sources</div>
              <div className="mt-1 text-sm font-semibold text-[var(--color-gh-strong)]">
                {dataset ? formatCount(dataset.source_repo_count) : '0'}
              </div>
            </div>
            <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">Suggestions</div>
              <div className="mt-1 text-sm font-semibold text-[var(--color-gh-strong)]">
                {formatCount(totalSuggestions)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {status === 'loading' && (
        <div className="flex items-center justify-center rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-12 text-[var(--color-gh-muted)]">
          <Loader2 className="mr-3 h-5 w-5 animate-spin text-[var(--color-gh-accent)]" />
          Loading discovery suggestions…
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-md border border-[var(--color-gh-danger)] bg-[var(--color-gh-danger)]/10 p-4 text-sm text-[var(--color-gh-danger)]">
          {error || 'Failed to load discovery suggestions.'}
        </div>
      )}

      {status === 'missing' && (
        <div className="rounded-md border border-dashed border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-6 text-sm text-[var(--color-gh-muted)]">
          No discovery dataset is available yet. Run <code className="rounded bg-[var(--color-gh-bg)] px-1 py-0.5">python scripts/discover_similar.py</code>{' '}
          to generate the topic-based suggestions.
        </div>
      )}

      {status === 'ready' && entries.length === 0 && (
        <div className="rounded-md border border-dashed border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-6 text-sm text-[var(--color-gh-muted)]">
          The discovery pipeline ran successfully, but no suggestions were produced for the current dataset.
        </div>
      )}

        {status === 'ready' && entries.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-gh-muted)]">
            <p>
              Showing {formatCount(entries.length)} discovery threads.
            </p>
            <p>
              {dataset?.public_source_repo_count !== undefined
                ? `${formatCount(dataset.public_source_repo_count)} public source repos in the published copy.`
                : 'Published copy is generated from the public subset.'}
            </p>
          </div>

          <div className="space-y-4">
            {entries.map((entry, index) => (
              <DiscoverSuggestions key={entry.source.full_name} entry={entry} rank={index + 1} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3 text-xs text-[var(--color-gh-muted)]">
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Suggestions are filtered to repos you have not already starred.
            </span>
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Public site data excludes non-public source repos and non-public suggestions.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
