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

export type AnalyticsScope = 'visible' | 'portfolio';
export type AnalyticsWindow = '7d' | '30d' | '90d' | 'all';

export interface AnalyticsTimelinePoint {
  date: string;
  stars: number;
  forks: number;
  repos: number;
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

type MetadataField =
  | 'license_spdx'
  | 'latest_release'
  | 'readme_excerpt'
  | 'contributor_count'
  | 'commit_activity_52w'
  | 'community_health';

const METADATA_FIELDS: MetadataField[] = [
  'license_spdx',
  'latest_release',
  'readme_excerpt',
  'contributor_count',
  'commit_activity_52w',
  'community_health',
];

const WINDOW_DAYS: Record<Exclude<AnalyticsWindow, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function parseSnapshotDate(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function sumField<T>(items: T[], getter: (item: T) => number): number {
  return items.reduce((sum, item) => sum + getter(item), 0);
}

export function normalizeHistorySnapshots(history: HistorySnapshot[]): HistorySnapshot[] {
  const byDate = new Map<string, HistorySnapshot>();
  for (const snapshot of history) {
    byDate.set(snapshot.date, snapshot);
  }

  return [...byDate.values()].sort((a, b) => parseSnapshotDate(a.date) - parseSnapshotDate(b.date));
}

export function selectHistoryWindow(
  history: HistorySnapshot[],
  window: AnalyticsWindow
): HistorySnapshot[] {
  const normalized = normalizeHistorySnapshots(history);
  if (window === 'all' || normalized.length === 0) return normalized;

  const latest = normalized[normalized.length - 1];
  const latestDate = parseSnapshotDate(latest.date);
  const cutoff = latestDate - WINDOW_DAYS[window] * 24 * 60 * 60 * 1000;

  return normalized.filter((snapshot) => parseSnapshotDate(snapshot.date) >= cutoff);
}

export function buildTimelineSeries(
  history: HistorySnapshot[],
  scopeRepoNames?: Set<string>
): AnalyticsTimelinePoint[] {
  return normalizeHistorySnapshots(history).map((snapshot) => {
    const repos = scopeRepoNames
      ? snapshot.repos.filter((repo) => scopeRepoNames.has(repo.full_name))
      : snapshot.repos;

    return {
      date: snapshot.date,
      stars: sumField(repos, (repo) => repo.stargazers_count),
      forks: sumField(repos, (repo) => repo.forks_count),
      repos: repos.length,
    };
  });
}

export function buildTrendingDeltas(
  history: HistorySnapshot[],
  scopeRepoNames?: Set<string>,
  window: AnalyticsWindow = '30d'
): TrendingDelta[] {
  const windowHistory = selectHistoryWindow(history, window);
  if (windowHistory.length < 2) return [];

  const latest = windowHistory[windowHistory.length - 1];
  const baseline = windowHistory[0];
  const latestRepos = scopeRepoNames
    ? latest.repos.filter((repo) => scopeRepoNames.has(repo.full_name))
    : latest.repos;
  const baselineByName = new Map(
    baseline.repos.map((repo) => [repo.full_name, repo] as const)
  );

  return latestRepos
    .map((repo) => {
      const previous = baselineByName.get(repo.full_name);
      return {
        full_name: repo.full_name,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        star_delta: repo.stargazers_count - (previous?.stargazers_count || 0),
        fork_delta: repo.forks_count - (previous?.forks_count || 0),
      };
    })
    .sort(
      (a, b) =>
        b.star_delta - a.star_delta ||
        b.fork_delta - a.fork_delta ||
        a.full_name.localeCompare(b.full_name)
    );
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
        const presentCount = METADATA_FIELDS.filter((field) => {
          const value = repo[field];
          return value !== null && value !== undefined;
        }).length;
        return (presentCount / METADATA_FIELDS.length) * 100;
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
