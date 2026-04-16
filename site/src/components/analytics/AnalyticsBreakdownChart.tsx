import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BucketCount } from '../../lib/analytics';

interface AnalyticsBreakdownChartProps {
  title: string;
  subtitle: string;
  data: BucketCount[];
}

export function AnalyticsBreakdownChart({
  title,
  subtitle,
  data,
}: AnalyticsBreakdownChartProps) {
  return (
    <section className="rounded-lg border border-[var(--color-gh-border)] bg-[var(--color-gh-card)] p-4 shadow-sm min-h-[20rem]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[var(--color-gh-strong)]">{title}</h2>
        <p className="text-sm text-[var(--color-gh-muted)]">{subtitle}</p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[15rem] items-center justify-center rounded-md border border-dashed border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-sm text-[var(--color-gh-muted)]">
          No repos match this scope.
        </div>
      ) : (
        <div className="h-[15rem]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gh-border)" />
              <XAxis
                type="number"
                allowDecimals={false}
                stroke="var(--color-gh-muted)"
                tick={{ fill: 'var(--color-gh-muted)', fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                stroke="var(--color-gh-muted)"
                tick={{ fill: 'var(--color-gh-muted)', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-gh-card)',
                  border: '1px solid var(--color-gh-border)',
                  borderRadius: '8px',
                  color: 'var(--color-gh-text)',
                }}
              />
              <Bar dataKey="count" fill="var(--color-gh-accent)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
