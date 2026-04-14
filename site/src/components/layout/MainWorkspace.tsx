import { useStore } from '../../store/useStore';
import { RepoTable } from '../table/RepoTable';
import { DiscoverEngine } from '../discover/DiscoverEngine';
import { ComparePanel } from '../compare/ComparePanel';
import { Loader2 } from 'lucide-react';

export function MainWorkspace({ isLoading }: { isLoading: boolean }) {
  const { viewMode, error } = useStore();

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
        return <RepoTable />;
    }
  };

  return (
    <>
      {renderView()}
      <ComparePanel />
    </>
  );
}
