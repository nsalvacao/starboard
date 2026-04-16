import { Activity, Eye, LayoutGrid, Trash2 } from 'lucide-react';
import type { Repository } from '../../types';

interface StatsStripProps {
  repos: Repository[];
}

export function StatsStrip({ repos }: StatsStripProps) {
  const visibleCount = repos.length;
  const watchCount = repos.filter((repo) => repo.watch_candidate).length;
  const cleanupCount = repos.filter((repo) => repo.cleanup_candidate).length;
  const avgDaysSincePush =
    repos.length === 0
      ? 0
      : Math.round(repos.reduce((acc, repo) => acc + repo.days_since_push, 0) / repos.length);

  const items = [
    {
      label: 'Visible',
      value: visibleCount.toLocaleString(),
      icon: LayoutGrid,
      accent: 'text-[var(--color-gh-accent)]',
    },
    {
      label: 'Watch',
      value: watchCount.toLocaleString(),
      icon: Eye,
      accent: 'text-[var(--color-gh-success)]',
    },
    {
      label: 'Cleanup',
      value: cleanupCount.toLocaleString(),
      icon: Trash2,
      accent: 'text-[var(--color-gh-danger)]',
    },
    {
      label: 'Avg Push Age',
      value: `${avgDaysSincePush}d`,
      icon: Activity,
      accent: 'text-white',
    },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-[var(--color-gh-muted)]">{item.label}</span>
            <item.icon className={`w-4 h-4 ${item.accent}`} />
          </div>
          <p className={`mt-2 text-xl font-semibold ${item.accent}`}>{item.value}</p>
        </div>
      ))}
    </section>
  );
}
