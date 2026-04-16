import type { SortCriterion, SortDirection, SortKey } from '../types';

const VALID_SORT_KEYS: SortKey[] = [
  'full_name',
  'llm_category',
  'llm_summary',
  'language',
  'stargazers_count',
  'forks_count',
  'days_since_push',
  'starred_at',
];

function isSortKey(value: string): value is SortKey {
  return VALID_SORT_KEYS.includes(value as SortKey);
}

function isSortDirection(value: string): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeCsvParam(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.join(',');
}

export function parseSortParam(value: string | null): SortCriterion[] {
  if (!value) return [];

  const entries = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  const parsed: SortCriterion[] = [];
  for (const entry of entries) {
    const [key, direction] = entry.split(':');
    if (!key || !direction) continue;
    if (!isSortKey(key) || !isSortDirection(direction)) continue;
    parsed.push({ key, direction });
  }

  return parsed;
}

export function serializeSortParam(criteria: SortCriterion[]): string | null {
  if (criteria.length === 0) return null;
  return criteria.map((criterion) => `${criterion.key}:${criterion.direction}`).join(',');
}
