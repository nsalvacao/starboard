import { BarChart3, Globe2, Layers3, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Repository } from '../../types';
import { useStore } from '../../store/useStore';
import { ExportButton } from '../layout/ExportButton';
import {
  bucketCounts,
  buildTimelineSeries,
  buildTrendingDeltas,
  calculatePortfolioHealthScore,
  normalizeHistorySnapshots,
  selectHistoryWindow,
  type AnalyticsScope,
  type AnalyticsWindow,
  type HistorySnapshot,
} from '../../lib/analytics';
import { AnalyticsTimelineChart } from './AnalyticsTimelineChart';
import { AnalyticsBreakdownChart } from './AnalyticsBreakdownChart';
import { AnalyticsHealthScore } from './AnalyticsHealthScore';
import { AnalyticsTrendingPanel } from './AnalyticsTrendingPanel';

const WINDOW_OPTIONS: { value: AnalyticsWindow; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

const SCOPE_OPTIONS: { value: AnalyticsScope; label: string }[] = [
  { value: 'visible', label: 'Visible' },
  { value: 'portfolio', label: 'Portfolio' },
];

function isSnapshotPayload(value: unknown): value is HistorySnapshot[] {
  return Array.isArray(value);
}

function formatInteger(value: number): string {
  return value.toLocaleString();
}

function formatRepoCount(count: number): string {
  return `${count} repo${count === 1 ? '' : 's'}`;
}

interface AnalyticsWorkspaceProps {
  repos: Repository[];
  visibleRepos: Repository[];
}

export function AnalyticsWorkspace({ repos, visibleRepos }: AnalyticsWorkspaceProps) {
  const viewMode = useStore((state) => state.viewMode);
  const [scope, setScope] = useState<AnalyticsScope>('visible');
  const [timeWindow, setTimeWindow] = useState<AnalyticsWindow>('30d');
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/history.json`);
        if (!response.ok) {
          throw new Error(`Failed to load history: ${response.status} ${response.statusText}`);
        }

        const payload: unknown = await response.json();
        if (!isSnapshotPayload(payload)) {
          throw new Error('History payload was not an array');
        }

        if (!cancelled) {
          setHistory(normalizeHistorySnapshots(payload));
        }
      } catch (error) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(error instanceof Error ? error.message : 'Failed to load history');
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const scopeRepos = scope === 'visible' ? visibleRepos : repos;
  const scopeRepoNames = useMemo(
    () => new Set(scopeRepos.map((repo) => repo.full_name)),
    [scopeRepos]
  );
  const historyWindow = useMemo(() => selectHistoryWindow(history, timeWindow), [history, timeWindow]);
  const timeline = useMemo(
    () => buildTimelineSeries(historyWindow, scopeRepoNames),
    [historyWindow, scopeRepoNames]
  );
  const trending = useMemo(
    () => buildTrendingDeltas(history, scopeRepoNames, timeWindow),
    [history, scopeRepoNames, timeWindow]
  );
  const portfolioScore = useMemo(
    () => calculatePortfolioHealthScore(scopeRepos),
    [scopeRepos]
  );
  const categoryBreakdown = useMemo(
    () => bucketCounts(scopeRepos, (repo) => repo.llm_category, 6),
    [scopeRepos]
  );
  const languageBreakdown = useMemo(
    () => bucketCounts(scopeRepos, (repo) => repo.language, 6),
    [scopeRepos]
  );
  const positiveTrending = trending.filter((item) => item.star_delta > 0 || item.fork_delta > 0).slice(0, 5);
  const negativeTrending = [...trending]
    .filter((item) => item.star_delta < 0 || item.fork_delta < 0)
    .sort((a, b) => a.star_delta - b.star_delta || a.fork_delta - b.fork_delta || a.full_name.localeCompare(b.full_name))
    .slice(0, 5);

  const latestPoint = timeline[timeline.length - 1] || null;
  const latestSnapshot = historyWindow[historyWindow.length - 1] || null;
  const scopeLabel = scope === 'visible' ? 'visible set' : 'portfolio';

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="rounded-lg border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-gh-muted)]">
              <BarChart3 className="h-3.5 w-3.5 text-[var(--color-gh-accent)]" />
              Analytics
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-gh-strong)]">Portfolio overview</h1>
            <p className="max-w-3xl text-sm text-[var(--color-gh-muted)]">
              Compare growth, health and topic mix across the currently visible repositories or the full
              starred portfolio.
            </p>
          </div>

          <ExportButton repos={scopeRepos} viewMode={viewMode} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">
              <Layers3 className="h-3.5 w-3.5" />
              Scope
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setScope(option.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    scope === option.value
                      ? 'border-[var(--color-gh-accent)] bg-[var(--color-gh-accent)]/15 text-[var(--color-gh-accent)]'
                      : 'border-[var(--color-gh-border)] bg-[var(--color-gh-card)] text-[var(--color-gh-muted)] hover:border-[var(--color-gh-muted)] hover:text-[var(--color-gh-strong)]'
                  }`}
                  aria-pressed={scope === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">
              <Globe2 className="h-3.5 w-3.5" />
              Window
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {WINDOW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeWindow(option.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    timeWindow === option.value
                      ? 'border-[var(--color-gh-accent)] bg-[var(--color-gh-accent)]/15 text-[var(--color-gh-accent)]'
                      : 'border-[var(--color-gh-border)] bg-[var(--color-gh-card)] text-[var(--color-gh-muted)] hover:border-[var(--color-gh-muted)] hover:text-[var(--color-gh-strong)]'
                  }`}
                  aria-pressed={timeWindow === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">Repos</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--color-gh-strong)]">
              {formatInteger(scopeRepos.length)}
            </div>
            <p className="mt-1 text-sm text-[var(--color-gh-muted)]">
              {scope === 'visible' ? 'Matches current filters and search.' : 'All loaded public starred repos.'}
            </p>
          </div>

          <div className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">Snapshots</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--color-gh-strong)]">
              {formatInteger(history.length)}
            </div>
            <p className="mt-1 text-sm text-[var(--color-gh-muted)]">
              {historyLoading
                ? 'Loading public daily history.'
                : latestSnapshot
                  ? `Latest snapshot ${latestSnapshot.date}.`
                  : 'No snapshots available yet.'}
            </p>
          </div>
        </div>

        {historyError && (
          <div className="mt-4 rounded-md border border-[var(--color-gh-danger)] bg-[var(--color-gh-danger)]/10 p-3 text-sm text-[var(--color-gh-danger)]">
            {historyError}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AnalyticsTimelineChart
          points={timeline}
          scopeLabel={scopeLabel}
          windowLabel={timeWindow === 'all' ? 'all time' : timeWindow}
        />
        <AnalyticsHealthScore score={portfolioScore} scopeLabel={scopeLabel} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AnalyticsBreakdownChart
          title="Category mix"
          subtitle="Top categories with the remainder grouped into Other."
          data={categoryBreakdown}
        />
        <AnalyticsBreakdownChart
          title="Language mix"
          subtitle="Top languages in the selected scope."
          data={languageBreakdown}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AnalyticsTrendingPanel
          title="Trending up"
          subtitle={`Biggest positive deltas over the last ${timeWindow === 'all' ? 'available history' : timeWindow}.`}
          items={positiveTrending}
          direction="up"
        />
        <AnalyticsTrendingPanel
          title="Trending down"
          subtitle={`Biggest negative deltas over the last ${timeWindow === 'all' ? 'available history' : timeWindow}.`}
          items={negativeTrending}
          direction="down"
        />
      </section>

      {!historyLoading && timeline.length === 0 && (
        <div className="rounded-md border border-dashed border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-4 text-sm text-[var(--color-gh-muted)]">
          No timeline data is available for this scope yet.
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] px-4 py-3 text-sm text-[var(--color-gh-muted)]">
        <span>
          {formatRepoCount(scopeRepos.length)} in scope · {formatInteger(historyWindow.length)} snapshots in window ·
          {latestPoint ? ` ${latestPoint.stars.toLocaleString()} stars tracked.` : ' no star data yet.'}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--color-gh-success)]">
          <Sparkles className="h-3.5 w-3.5" />
          Health score {portfolioScore.score}
        </span>
      </div>
    </div>
  );
}
