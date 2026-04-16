import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsTimelinePoint } from '../../lib/analytics';

interface AnalyticsTimelineChartProps {
  points: AnalyticsTimelinePoint[];
  scopeLabel: string;
  windowLabel: string;
}

function formatAxisDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

export function AnalyticsTimelineChart({
  points,
  scopeLabel,
  windowLabel,
}: AnalyticsTimelineChartProps) {
  const latest = points[points.length - 1] || null;

  return (
    <section className="rounded-lg border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-4 shadow-sm min-h-[22rem]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-gh-strong)]">Star timeline</h2>
          <p className="text-sm text-[var(--color-gh-muted)]">
            {scopeLabel} over the last {windowLabel}
          </p>
        </div>
        {latest && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2 py-1 text-[var(--color-gh-muted)]">
              {latest.repos} repos
            </span>
            <span className="rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2 py-1 text-[var(--color-gh-muted)]">
              {latest.stars.toLocaleString()} stars
            </span>
            <span className="rounded-full border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] px-2 py-1 text-[var(--color-gh-muted)]">
              {latest.forks.toLocaleString()} forks
            </span>
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="flex h-[18rem] items-center justify-center rounded-md border border-dashed border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-sm text-[var(--color-gh-muted)]">
          No history snapshots yet.
        </div>
      ) : (
        <div className="h-[18rem]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gh-border)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                stroke="var(--color-gh-muted)"
                tick={{ fill: 'var(--color-gh-muted)', fontSize: 12 }}
              />
              <YAxis
                stroke="var(--color-gh-muted)"
                tick={{ fill: 'var(--color-gh-muted)', fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-gh-card)',
                  border: '1px solid var(--color-gh-border)',
                  borderRadius: '8px',
                  color: 'var(--color-gh-text)',
                }}
                labelFormatter={(label) => `Date: ${formatAxisDate(String(label))}`}
              />
              <Line
                type="monotone"
                dataKey="stars"
                name="Stars"
                stroke="var(--color-gh-accent)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="forks"
                name="Forks"
                stroke="var(--color-gh-success)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
