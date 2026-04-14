import { useStore } from '../../store/useStore';
import { X, ExternalLink, Activity, Info, GitCompare } from 'lucide-react';
import { useMemo } from 'react';

export function ComparePanel() {
  const { viewMode, selectedRepos, toggleSelection, clearSelection, repos } = useStore();

  const selectedData = useMemo(() => {
    return selectedRepos.map(id => repos.find(r => r.full_name === id)).filter(Boolean);
  }, [selectedRepos, repos]);

  if (viewMode !== 'compare' && selectedRepos.length === 0) return null;

  // We mount the panel if we're in compare mode, OR if we have selected repos to compare.
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="max-w-7xl mx-auto w-full pointer-events-auto bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] shadow-2xl rounded-t-xl overflow-hidden flex flex-col transition-transform duration-300 transform translate-y-0">
        <div className="px-6 py-3 border-b border-[var(--color-gh-border)] flex items-center justify-between bg-gradient-to-r from-[var(--color-gh-hover)] to-[var(--color-gh-card)]">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[var(--color-gh-accent)]" />
            <h3 className="font-semibold text-white">Compare Models</h3>
            <span className="text-xs font-medium text-[var(--color-gh-muted)] bg-[var(--color-gh-bg)] px-2 py-0.5 rounded-full ring-1 ring-[var(--color-gh-border)]">
              {selectedRepos.length} / 6 selected
            </span>
          </div>
          <button 
            onClick={clearSelection}
            className="text-xs font-semibold text-[var(--color-gh-muted)] hover:text-white hover:bg-[var(--color-gh-bg)] px-3 py-1 rounded transition-colors"
          >
            Clear All & Close
          </button>
        </div>

        <div className="p-6 bg-[var(--color-gh-bg)] backdrop-blur-xl flex flex-col max-h-[60vh] overflow-auto">
          {selectedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-gh-muted)]">
              <Info className="w-8 h-8 mb-4 opacity-50" />
              <p>No repositories selected. Go to All Repos and check some boxes.</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
              {selectedData.map((repo) => (
                <div key={repo!.full_name} className="flex-none w-80 snap-start bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-xl relative overflow-hidden group">
                  <button 
                    onClick={() => toggleSelection(repo!.full_name)}
                    className="absolute top-3 right-3 text-[var(--color-gh-muted)] hover:text-white bg-[var(--color-gh-bg)]/80 hover:bg-[var(--color-gh-danger)] rounded p-1 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="p-5 flex flex-col h-full border-t-2 border-t-blue-500">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={`https://github.com/${repo!.full_name.split('/')[0]}.png?size=32`} alt="" className="w-6 h-6 rounded-md" />
                      <a href={repo!.html_url} target="_blank" rel="noreferrer" className="font-bold text-[var(--color-gh-accent)] hover:underline truncate">
                        {repo!.full_name.split('/')[1]}
                      </a>
                      <a href={repo!.html_url} target="_blank" rel="noreferrer" className="text-[var(--color-gh-muted)] hover:text-white">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p className="text-sm text-[var(--color-gh-muted)] mb-4 line-clamp-3 flex-1">{repo!.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-[var(--color-gh-border)]">
                      <div className="bg-[var(--color-gh-bg)] p-2 rounded flex flex-col">
                        <span className="text-xs text-[var(--color-gh-muted)] uppercase tracking-wider mb-1">Stars</span>
                        <span className="font-semibold text-yellow-500">{repo!.stargazers_count.toLocaleString()}</span>
                      </div>
                      <div className="bg-[var(--color-gh-bg)] p-2 rounded flex flex-col">
                        <span className="text-xs text-[var(--color-gh-muted)] uppercase tracking-wider mb-1">Activity</span>
                        <span className="font-semibold text-white flex items-center gap-1">
                          <Activity className="w-3 h-3 text-green-400" /> {repo!.days_since_push}d ago
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
