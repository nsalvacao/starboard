import { useStore } from '../../store/useStore';
import { RepoTable } from '../table/RepoTable';
import { DiscoverEngine } from '../discover/DiscoverEngine';
import { ComparePanel } from '../compare/ComparePanel';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useUrlSync } from '../../hooks/useUrlSync';
import { getVisibleRepos } from '../../lib/repoSelectors';
import { StatsStrip } from './StatsStrip';
import { TopicCloud } from './TopicCloud';
import { ExportButton } from './ExportButton';
import { RepoDetailModal } from './RepoDetailModal';

export function MainWorkspace({ isLoading }: { isLoading: boolean }) {
  useUrlSync();
  const {
    repos,
    viewMode,
    filters,
    setFilter,
    searchQuery,
    sortCriteria,
    activeRepoFullName,
    closeRepoModal,
    error,
  } = useStore();

  const visibleRepos = useMemo(
    () =>
      getVisibleRepos({
        repos,
        viewMode,
        searchQuery,
        filters,
        sortCriteria,
      }),
    [repos, viewMode, searchQuery, filters, sortCriteria]
  );

  const activeRepo = useMemo(
    () => repos.find((repo) => repo.full_name === activeRepoFullName) || null,
    [repos, activeRepoFullName]
  );

  const toggleTopic = (topic: string) => {
    const nextTopics = filters.topics.includes(topic)
      ? filters.topics.filter((item) => item !== topic)
      : [...filters.topics, topic];
    setFilter('topics', nextTopics);
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center border border-[var(--color-gh-danger)] bg-[var(--color-gh-danger)]/10 rounded-lg p-8 text-center text-[var(--color-gh-danger)]">
        <p>Failed to load repositories: {error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--color-gh-muted)]">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-[var(--color-gh-accent)]" />
        <p>Loading your GitHub Stars...</p>
      </div>
    );
  }

  const renderView = () => {
    switch (viewMode) {
      case 'discover':
        return <DiscoverEngine />;
      case 'compare':
      case 'all':
      case 'cleanup':
      case 'watch':
      default:
        return (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="flex flex-col gap-3">
              <StatsStrip repos={visibleRepos} />
              <div className="flex justify-end">
                <ExportButton repos={visibleRepos} viewMode={viewMode} />
              </div>
            </div>
            <TopicCloud
              repos={visibleRepos}
              selectedTopics={filters.topics}
              onToggleTopic={toggleTopic}
              onClearTopics={() => setFilter('topics', [])}
            />
            <RepoTable repos={visibleRepos} />
          </div>
        );
    }
  };

  return (
    <>
      {renderView()}
      <ComparePanel />
      <RepoDetailModal repo={activeRepo} isOpen={Boolean(activeRepo)} onClose={closeRepoModal} />
    </>
  );
}
