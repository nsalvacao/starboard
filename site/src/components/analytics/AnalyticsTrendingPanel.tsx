import { ArrowDownRight, ArrowUpRight, GitFork, Star } from 'lucide-react';
import type { TrendingDelta } from '../../lib/analytics';

interface AnalyticsTrendingPanelProps {
  title: string;
  subtitle: string;
  items: TrendingDelta[];
  direction: 'up' | 'down';
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function AnalyticsTrendingPanel({
  title,
  subtitle,
  items,
  direction,
}: AnalyticsTrendingPanelProps) {
  const icon = direction === 'up' ? ArrowUpRight : ArrowDownRight;
  const tone =
    direction === 'up'
      ? 'text-[var(--color-gh-success)]'
      : 'text-[var(--color-gh-danger)]';

  return (
    <section className="rounded-lg border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-4 shadow-sm min-h-[18rem]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-gh-strong)]">{title}</h2>
          <p className="text-sm text-[var(--color-gh-muted)]">{subtitle}</p>
        </div>
        {items.length > 0 && (
          <div className={`rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-3 py-1 text-xs ${tone}`}>
            {items.length} repos
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex h-[12rem] items-center justify-center rounded-md border border-dashed border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-sm text-[var(--color-gh-muted)]">
          No movement in this window yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = icon;
            const starTone = item.star_delta >= 0 ? 'text-[var(--color-gh-success)]' : 'text-[var(--color-gh-danger)]';
            const forkTone = item.fork_delta >= 0 ? 'text-[var(--color-gh-success)]' : 'text-[var(--color-gh-danger)]';

            return (
              <article
                key={item.full_name}
                className="rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--color-gh-strong)]">{item.full_name}</h3>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-gh-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Star className={`h-3 w-3 ${starTone}`} />
                        {formatDelta(item.star_delta)} stars
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <GitFork className={`h-3 w-3 ${forkTone}`} />
                        {formatDelta(item.fork_delta)} forks
                      </span>
                    </p>
                  </div>
                  <Icon className={`h-4 w-4 ${tone}`} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
