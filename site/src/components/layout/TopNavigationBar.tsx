import { useStore } from '../../store/useStore';
import { Search, GitMerge, LayoutGrid, Eye, Sparkles, Trash2, GitCompare } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ViewMode } from '../../types';

export function TopNavigationBar() {
  const { viewMode, setViewMode, searchQuery, setSearchQuery, repos } = useStore();

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'all', label: 'All Repos', icon: <LayoutGrid className="w-4 h-4" />, count: repos.length },
    { id: 'watch', label: 'Watch', icon: <Eye className="w-4 h-4" />, count: repos.filter(r => r.watch_candidate).length },
    { id: 'discover', label: 'Discover', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'cleanup', label: 'Cleanup', icon: <Trash2 className="w-4 h-4" />, count: repos.filter(r => r.cleanup_candidate).length },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--color-gh-border)] bg-[var(--color-gh-bg)]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-white" />
            <span className="font-bold text-lg tracking-tight text-white hidden sm:block">Starboard</span>
          </div>

          {/* Nav Tabs */}
          <nav className="flex overflow-x-auto no-scrollbar items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === tab.id 
                    ? "bg-[var(--color-gh-hover)] text-white" 
                    : "text-[var(--color-gh-muted)] hover:text-white hover:bg-[var(--color-gh-hover)]/50"
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <span className="bg-[var(--color-gh-border)] text-xs px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Search & Actions */}
          <div className="flex-1 md:flex-none flex justify-end items-center gap-4 hidden sm:flex">
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-gh-muted)] group-focus-within:text-[var(--color-gh-accent)]" />
              <input
                id="search"
                type="text"
                placeholder="Search repos, summaries... (Press / to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--color-gh-bg)] border border-[var(--color-gh-border)] rounded-md pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-[var(--color-gh-accent)] focus:ring-1 focus:ring-[var(--color-gh-accent)] transition-all placeholder-[var(--color-gh-muted)] text-[var(--color-gh-text)]"
              />
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
