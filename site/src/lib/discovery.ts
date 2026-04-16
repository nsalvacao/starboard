export interface DiscoverySuggestion {
  full_name: string;
  html_url: string;
  description: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  visibility?: 'public' | 'private' | 'internal';
  score: number;
  matched_topics: string[];
  query_terms: string[];
}

export interface DiscoverySource {
  full_name: string;
  html_url: string;
  description: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  visibility?: 'public' | 'private' | 'internal';
}

export interface DiscoveryEntry {
  source: DiscoverySource;
  seed_topics: string[];
  expanded_topics: string[];
  queries: string[];
  source_score: number;
  suggestions: DiscoverySuggestion[];
}

export interface DiscoveryDataset {
  generated_at: string;
  source_repo_count: number;
  public_source_repo_count?: number;
  entries: DiscoveryEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDiscoverySource(value: unknown): value is DiscoverySource {
  if (!isRecord(value)) return false;
  return (
    typeof value.full_name === 'string' &&
    typeof value.html_url === 'string' &&
    typeof value.description === 'string' &&
    (typeof value.language === 'string' || value.language === null) &&
    isStringArray(value.topics) &&
    typeof value.stargazers_count === 'number' &&
    Number.isFinite(value.stargazers_count) &&
    typeof value.forks_count === 'number' &&
    Number.isFinite(value.forks_count) &&
    (value.visibility === undefined ||
      value.visibility === 'public' ||
      value.visibility === 'private' ||
      value.visibility === 'internal')
  );
}

function isDiscoverySuggestion(value: unknown): value is DiscoverySuggestion {
  if (!isRecord(value)) return false;
  return (
    typeof value.full_name === 'string' &&
    typeof value.html_url === 'string' &&
    typeof value.description === 'string' &&
    (typeof value.language === 'string' || value.language === null) &&
    isStringArray(value.topics) &&
    typeof value.stargazers_count === 'number' &&
    Number.isFinite(value.stargazers_count) &&
    typeof value.forks_count === 'number' &&
    Number.isFinite(value.forks_count) &&
    (value.visibility === undefined ||
      value.visibility === 'public' ||
      value.visibility === 'private' ||
      value.visibility === 'internal') &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    isStringArray(value.matched_topics) &&
    isStringArray(value.query_terms)
  );
}

function isDiscoveryEntry(value: unknown): value is DiscoveryEntry {
  if (!isRecord(value)) return false;
  return (
    isDiscoverySource(value.source) &&
    isStringArray(value.seed_topics) &&
    isStringArray(value.expanded_topics) &&
    isStringArray(value.queries) &&
    typeof value.source_score === 'number' &&
    Number.isFinite(value.source_score) &&
    Array.isArray(value.suggestions) &&
    value.suggestions.every(isDiscoverySuggestion)
  );
}

export function isDiscoveryDataset(value: unknown): value is DiscoveryDataset {
  if (!isRecord(value)) return false;
  return (
    typeof value.generated_at === 'string' &&
    typeof value.source_repo_count === 'number' &&
    Number.isFinite(value.source_repo_count) &&
    (value.public_source_repo_count === undefined ||
      (typeof value.public_source_repo_count === 'number' &&
        Number.isFinite(value.public_source_repo_count))) &&
    Array.isArray(value.entries) &&
    value.entries.every(isDiscoveryEntry)
  );
}

export function normalizeDiscoveryDataset(dataset: DiscoveryDataset): DiscoveryDataset {
  const entries = [...dataset.entries]
    .sort(
      (a, b) =>
        b.source_score - a.source_score ||
        b.suggestions.length - a.suggestions.length ||
        a.source.full_name.localeCompare(b.source.full_name)
    )
    .map((entry) => ({
      ...entry,
      suggestions: [...entry.suggestions].sort(
        (a, b) =>
          b.score - a.score ||
          b.stargazers_count - a.stargazers_count ||
          a.full_name.localeCompare(b.full_name)
      ),
    }));

  return { ...dataset, entries };
}
