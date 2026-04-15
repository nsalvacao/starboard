import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Repository } from '../../types';

interface RepoDetailModalProps {
  repo: Repository | null;
  isOpen: boolean;
  onClose: () => void;
}

function boolBadge(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export function RepoDetailModal({ repo, isOpen, onClose }: RepoDetailModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !repo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Repository details for ${repo.full_name}`}
        className="max-w-4xl mx-auto bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-lg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--color-gh-border)]">
          <div>
            <h2 className="text-lg font-semibold text-white">{repo.full_name}</h2>
            <p className="text-sm text-[var(--color-gh-muted)] mt-1">{repo.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-gh-border)] text-[var(--color-gh-muted)] hover:text-white hover:border-[var(--color-gh-muted)]"
            >
              Open Repo
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-gh-border)] text-[var(--color-gh-muted)] hover:text-white hover:border-[var(--color-gh-muted)]"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-white mb-2">Core Metadata</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-[var(--color-gh-bg)] rounded p-3"><span className="text-[var(--color-gh-muted)] block text-xs">Language</span>{repo.language || 'Unknown'}</div>
              <div className="bg-[var(--color-gh-bg)] rounded p-3"><span className="text-[var(--color-gh-muted)] block text-xs">Stars</span>{repo.stargazers_count.toLocaleString()}</div>
              <div className="bg-[var(--color-gh-bg)] rounded p-3"><span className="text-[var(--color-gh-muted)] block text-xs">Forks</span>{repo.forks_count.toLocaleString()}</div>
              <div className="bg-[var(--color-gh-bg)] rounded p-3"><span className="text-[var(--color-gh-muted)] block text-xs">Days Since Push</span>{repo.days_since_push}</div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">LLM Enrichment</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-[var(--color-gh-muted)]">Category:</span> {repo.llm_category || 'Uncategorized'}</p>
              <p><span className="text-[var(--color-gh-muted)]">Summary:</span> {repo.llm_summary || 'N/A'}</p>
              <p><span className="text-[var(--color-gh-muted)]">Watch note:</span> {repo.llm_watch_note || 'N/A'}</p>
              <p><span className="text-[var(--color-gh-muted)]">Model:</span> {repo.llm_model || 'N/A'} ({repo.llm_status || 'unknown'})</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-white mb-2">Phase 1 Extended Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-[var(--color-gh-bg)] rounded p-3">
                <span className="text-[var(--color-gh-muted)] block text-xs mb-1">License</span>
                {repo.license_spdx || 'N/A'}
              </div>
              <div className="bg-[var(--color-gh-bg)] rounded p-3">
                <span className="text-[var(--color-gh-muted)] block text-xs mb-1">Contributors</span>
                {repo.contributor_count ?? 'N/A'}
              </div>
              <div className="bg-[var(--color-gh-bg)] rounded p-3">
                <span className="text-[var(--color-gh-muted)] block text-xs mb-1">Latest Release</span>
                {repo.latest_release ? (
                  <a
                    href={repo.latest_release.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-gh-accent)] hover:underline"
                  >
                    {repo.latest_release.tag} ({repo.latest_release.date})
                  </a>
                ) : (
                  'N/A'
                )}
              </div>
              <div className="bg-[var(--color-gh-bg)] rounded p-3">
                <span className="text-[var(--color-gh-muted)] block text-xs mb-1">Commit Activity (52w)</span>
                {repo.commit_activity_52w ? `${repo.commit_activity_52w.length} weeks captured` : 'N/A'}
              </div>
            </div>
            {repo.community_health && (
              <div className="mt-3 bg-[var(--color-gh-bg)] rounded p-3 text-sm">
                <p><span className="text-[var(--color-gh-muted)]">Community score:</span> {repo.community_health.score}</p>
                <p className="mt-1 text-[var(--color-gh-muted)]">
                  COC {boolBadge(repo.community_health.has_code_of_conduct)} | Contributing {boolBadge(repo.community_health.has_contributing)} | Issue Template {boolBadge(repo.community_health.has_issue_template)} | PR Template {boolBadge(repo.community_health.has_pull_request_template)} | License {boolBadge(repo.community_health.has_license)} | README {boolBadge(repo.community_health.has_readme)}
                </p>
              </div>
            )}
            {repo.readme_excerpt && (
              <div className="mt-3 bg-[var(--color-gh-bg)] rounded p-3 text-sm">
                <p className="text-[var(--color-gh-muted)] text-xs mb-1">README excerpt</p>
                <p>{repo.readme_excerpt}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
