import { Gauge, Sparkles } from 'lucide-react';
import type { PortfolioHealthScore } from '../../lib/analytics';

interface AnalyticsHealthScoreProps {
  score: PortfolioHealthScore;
  scopeLabel: string;
}

const METRICS = [
  { key: 'freshness', label: 'Freshness' },
  { key: 'enrichmentCoverage', label: 'Enrichment' },
  { key: 'maintenanceHealth', label: 'Maintenance' },
  { key: 'metadataDepth', label: 'Metadata' },
] as const;

export function AnalyticsHealthScore({ score, scopeLabel }: AnalyticsHealthScoreProps) {
  return (
    <section className="rounded-lg border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-4 shadow-sm min-h-[20rem]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-gh-strong)]">Portfolio health</h2>
          <p className="text-sm text-[var(--color-gh-muted)]">{scopeLabel} score blend</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-3 py-1 text-xs text-[var(--color-gh-muted)]">
          <Gauge className="h-3.5 w-3.5 text-[var(--color-gh-accent)]" />
          Weighted average
        </div>
      </div>

      <div className="flex items-end gap-4 border-b border-[var(--color-gh-border)] pb-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)]">
          <div className="text-center">
            <div className="text-3xl font-semibold text-[var(--color-gh-strong)]">{score.score}</div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">score</div>
          </div>
        </div>
        <div className="flex-1 text-sm text-[var(--color-gh-muted)]">
          <p className="text-[var(--color-gh-text)]">
            {score.score >= 80
              ? 'This slice looks healthy and well covered.'
              : score.score >= 50
                ? 'This slice is usable, but there is room to harden it.'
                : 'This slice needs more enrichment before it is comfortable to rely on.'}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-gh-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-gh-success)]" />
            <span>Freshness, enrichment, maintenance and metadata are blended equally.</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {METRICS.map((metric) => {
          const value = score[metric.key];
          return (
            <div key={metric.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-gh-text)]">{metric.label}</span>
                <span className="text-[var(--color-gh-muted)]">{value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-gh-bg)]">
                <div
                  className="h-full rounded-full bg-[var(--color-gh-accent)]"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
