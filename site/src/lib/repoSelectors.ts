import type { Repository, SortCriterion, SortDirection, SortKey, ViewMode } from '../types';

interface RepoFilters {
  category: string[];
  language: string[];
  status: string[];
  topics: string[];
}

interface SelectorInput {
  repos: Repository[];
  viewMode: ViewMode;
  searchQuery: string;
  filters: RepoFilters;
  sortCriteria: SortCriterion[];
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const normalizedA = a.toLowerCase();
  const normalizedB = b.toLowerCase();
  const result = normalizedA.localeCompare(normalizedB);
  return direction === 'asc' ? result : -result;
}

function compareNumbers(a: number, b: number, direction: SortDirection): number {
  const result = a - b;
  return direction === 'asc' ? result : -result;
}

function compareRepoByCriterion(a: Repository, b: Repository, criterion: SortCriterion): number {
  const { key, direction } = criterion;
  switch (key) {
    case 'full_name':
      return compareStrings(a.full_name, b.full_name, direction);
    case 'llm_category':
      return compareStrings(a.llm_category || '', b.llm_category || '', direction);
    case 'llm_summary':
      return compareStrings(a.llm_summary || '', b.llm_summary || '', direction);
    case 'language':
      return compareStrings(a.language || '', b.language || '', direction);
    case 'stargazers_count':
      return compareNumbers(a.stargazers_count, b.stargazers_count, direction);
    case 'forks_count':
      return compareNumbers(a.forks_count, b.forks_count, direction);
    case 'days_since_push':
      return compareNumbers(a.days_since_push, b.days_since_push, direction);
    case 'starred_at':
      return compareStrings(a.starred_at || '', b.starred_at || '', direction);
    default:
      return 0;
  }
}

export function cycleSortDirection(
  current: SortDirection | null
): SortDirection | null {
  if (current === null) return 'desc';
  if (current === 'desc') return 'asc';
  return null;
}

export function updateSortCriteria(
  current: SortCriterion[],
  key: SortKey,
  isMultiSort: boolean
): SortCriterion[] {
  const existingIndex = current.findIndex((criterion) => criterion.key === key);
  const existing = existingIndex >= 0 ? current[existingIndex] : null;
  const nextDirection = cycleSortDirection(existing?.direction || null);

  if (!isMultiSort) {
    if (nextDirection === null) return [];
    return [{ key, direction: nextDirection }];
  }

  if (existingIndex === -1) {
    if (nextDirection === null) return current;
    return [...current, { key, direction: nextDirection }];
  }

  if (nextDirection === null) {
    return current.filter((criterion) => criterion.key !== key);
  }

  return current.map((criterion, index) =>
    index === existingIndex ? { ...criterion, direction: nextDirection } : criterion
  );
}

export function getVisibleRepos({
  repos,
  viewMode,
  searchQuery,
  filters,
  sortCriteria,
}: SelectorInput): Repository[] {
  const filteredRepos = repos.filter((repo) => {
    if (viewMode === 'watch' && !repo.watch_candidate) return false;
    if (viewMode === 'cleanup' && !repo.cleanup_candidate) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchTarget = [
        repo.full_name,
        repo.description || '',
        repo.llm_summary || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!searchTarget.includes(q)) return false;
    }

    if (
      filters.category.length > 0 &&
      (!repo.llm_category || !filters.category.includes(repo.llm_category))
    ) {
      return false;
    }

    if (
      filters.language.length > 0 &&
      (!repo.language || !filters.language.includes(repo.language))
    ) {
      return false;
    }

    if (filters.topics.length > 0) {
      const topicSet = new Set(repo.topics || []);
      const hasAnySelectedTopic = filters.topics.some((topic) => topicSet.has(topic));
      if (!hasAnySelectedTopic) return false;
    }

    return true;
  });

  if (sortCriteria.length === 0) return filteredRepos;

  const withOriginalIndex = filteredRepos.map((repo, index) => ({ repo, index }));

  withOriginalIndex.sort((a, b) => {
    for (const criterion of sortCriteria) {
      const result = compareRepoByCriterion(a.repo, b.repo, criterion);
      if (result !== 0) return result;
    }

    const fallback = compareStrings(a.repo.full_name, b.repo.full_name, 'asc');
    if (fallback !== 0) return fallback;

    return a.index - b.index;
  });

  return withOriginalIndex.map((item) => item.repo);
}
