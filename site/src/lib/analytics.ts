import type { Repository } from '../types';

export interface HistoryRepoSnapshot {
  full_name: string;
  stargazers_count: number;
  forks_count: number;
}

export interface HistorySnapshot {
  date: string;
  repos: HistoryRepoSnapshot[];
}

export interface BucketCount {
  label: string;
  count: number;
}

export interface TrendingDelta {
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  star_delta: number;
  fork_delta: number;
}

export interface PortfolioHealthScore {
  score: number;
  freshness: number;
  enrichmentCoverage: number;
  maintenanceHealth: number;
  metadataDepth: number;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function roundPercent(value: number): number {
  return Math.round(clampPercent(value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function bucketCounts<T>(
  items: T[],
  getLabel: (item: T) => string | null | undefined,
  topN = 6,
  otherLabel = 'Other'
): BucketCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = getLabel(item);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const kept = sorted.slice(0, topN);
  const remainder = sorted.slice(topN).reduce((sum, [, count]) => sum + count, 0);

  return [
    ...kept.map(([label, count]) => ({ label, count })),
    ...(remainder > 0 ? [{ label: otherLabel, count: remainder }] : []),
  ];
}

export function calculateTrendingDelta(
  current: HistorySnapshot,
  previous: HistorySnapshot | null | undefined
): TrendingDelta[] {
  const previousByName = new Map(
    (previous?.repos || []).map((repo) => [repo.full_name, repo] as const)
  );

  return current.repos
    .map((repo) => {
      const prior = previousByName.get(repo.full_name);
      return {
        full_name: repo.full_name,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        star_delta: repo.stargazers_count - (prior?.stargazers_count || 0),
        fork_delta: repo.forks_count - (prior?.forks_count || 0),
      };
    })
    .sort(
      (a, b) =>
        b.star_delta - a.star_delta ||
        b.fork_delta - a.fork_delta ||
        a.full_name.localeCompare(b.full_name)
    );
}

export function calculatePortfolioHealthScore(repos: Repository[]): PortfolioHealthScore {
  if (repos.length === 0) {
    return {
      score: 0,
      freshness: 0,
      enrichmentCoverage: 0,
      maintenanceHealth: 0,
      metadataDepth: 0,
    };
  }

  const freshness = roundPercent(
    average(
      repos.map((repo) => {
        const age = Number.isFinite(repo.days_since_push) ? repo.days_since_push : 365;
        return 100 - Math.min(100, (Math.max(0, age) / 365) * 100);
      })
    )
  );

  const enrichmentCoverage = roundPercent(
    (repos.filter((repo) => repo.llm_status === 'ok').length / repos.length) * 100
  );

  const maintenanceHealth = roundPercent(
    (repos.filter((repo) => !repo.archived && !repo.stale).length / repos.length) * 100
  );

  const metadataDepth = roundPercent(
    average(
      repos.map((repo) => {
        const present = [
          repo.license_spdx,
          repo.latest_release,
          repo.readme_excerpt,
          repo.contributor_count,
          repo.commit_activity_52w,
          repo.community_health,
        ].filter((value) => value !== null && value !== undefined);
        return (present.length / 6) * 100;
      })
    )
  );

  const score = roundPercent(
    average([freshness, enrichmentCoverage, maintenanceHealth, metadataDepth])
  );

  return {
    score,
    freshness,
    enrichmentCoverage,
    maintenanceHealth,
    metadataDepth,
  };
}
