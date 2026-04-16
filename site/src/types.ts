export interface Repository {
  full_name: string;
  html_url: string;
  description: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  fork: boolean;
  default_branch: string;
  pushed_at: string;
  updated_at: string;
  starred_at: string;
  days_since_push: number;
  recent_star: boolean;
  recent_activity: boolean;
  stale: boolean;
  watch_candidate: boolean;
  cleanup_candidate: boolean;
  visibility?: 'public' | 'private' | 'internal';
  license_spdx?: string | null;
  latest_release?: { tag: string; date: string; url: string } | null;
  readme_excerpt?: string | null;
  contributor_count?: number | null;
  commit_activity_52w?: number[] | null;
  community_health?: {
    score: number;
    has_code_of_conduct: boolean;
    has_contributing: boolean;
    has_issue_template: boolean;
    has_pull_request_template: boolean;
    has_license: boolean;
    has_readme: boolean;
  } | null;
  cached_pushed_at?: string | null;
  llm_category: string | null;
  llm_summary: string | null;
  llm_watch_note: string | null;
  llm_model: string | null;
  llm_status: 'ok' | 'failed' | null;
  llm_enriched_at: string | null;
  llm_content_hash: string | null;
}

export type Theme = 'dark' | 'light';
export type ViewMode = 'all' | 'watch' | 'discover' | 'cleanup' | 'compare';
export type SortDirection = 'asc' | 'desc';
export type SortKey =
  | 'full_name'
  | 'llm_category'
  | 'llm_summary'
  | 'language'
  | 'stargazers_count'
  | 'forks_count'
  | 'days_since_push'
  | 'starred_at';

export interface SortCriterion {
  key: SortKey;
  direction: SortDirection;
}

export interface Preferences {
  theme: Theme;
  density: 'compact' | 'normal' | 'comfortable';
}
