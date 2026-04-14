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
  llm_category: string;
  llm_summary: string;
  llm_watch_note: string;
  llm_model: string;
  llm_status: 'ok' | 'failed' | null;
  llm_enriched_at: string;
  llm_content_hash: string;
}

export type ViewMode = 'all' | 'watch' | 'discover' | 'cleanup' | 'compare';

export interface Preferences {
  theme: 'dark' | 'light';
  density: 'compact' | 'normal' | 'comfortable';
}
