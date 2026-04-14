import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { ExternalLink, Star, ChevronRight } from 'lucide-react';

export function DiscoverEngine() {
  const { repos } = useStore();

  // Recommend unarchived, non-stale repos with interesting LLM categories 
  // that have been recently starred by the user.
  const topCategories = useMemo(() => {
    const counts = repos.filter(r => r.recent_star && r.llm_category).reduce((acc, r) => {
      acc[r.llm_category] = (acc[r.llm_category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 2);
  }, [repos]);

  const topicExpansion = useMemo(() => {
    const candidates = repos
      .filter(r => 
        !r.archived && 
        !r.stale && 
        r.llm_category && 
        topCategories.includes(r.llm_category) &&
        !r.recent_star
      );
      
    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    
    return candidates.slice(0, 5);
  }, [repos, topCategories]);

  const trending = useMemo(() => {
    return repos
      .filter(r => !r.archived && r.days_since_push < 30 && r.stargazers_count > 500)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5);
  }, [repos]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Discover Engine</h2>
          <p className="text-sm text-[var(--color-gh-muted)] mt-1">Smart recommendations based on your starred network, calculated entirely in memory.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Expansion Card */}
        <div className="bg-[var(--color-gh-card)] min-h-[400px] border border-[var(--color-gh-border)] rounded-xl p-6 shadow-sm flex flex-col transition-all hover:shadow-lg">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-1">Topic Expansion</h3>
            <p className="text-sm text-[var(--color-gh-muted)]">
              {topCategories.length > 0
                ? <>Because you recently starred {topCategories.join(' and ')}.</>
                : <>Recommendations based on recent activity and repository metadata.</>}
            </p>
          </div>
          <div className="flex-1 space-y-4">
             {topicExpansion.map((repo) => (
                <div key={repo.full_name} className="group p-4 bg-[var(--color-gh-bg)] border border-[var(--color-gh-border)] rounded-lg hover:border-[var(--color-gh-accent)] transition-colors">
                  <div className="flex items-start justify-between">
                    <a href={repo.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-[var(--color-gh-accent)] hover:underline truncate mr-4">
                      {repo.full_name.split('/')[1]} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <span className="flex-none bg-[var(--color-gh-hover)] text-[var(--color-gh-text)] text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                      <Star className="w-3 h-3 text-yellow-500" /> {(repo.stargazers_count / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-gh-muted)] mt-2 line-clamp-2">{repo.llm_summary || repo.description}</p>
                </div>
             ))}
             {topicExpansion.length === 0 && (
               <div className="flex flex-col items-center justify-center py-8 text-[var(--color-gh-muted)]">
                 <p className="text-sm italic">Not enough starred repos with AI analysis to expand topics.</p>
               </div>
             )}
          </div>
        </div>

        {/* Trending Card */}
        <div className="bg-[var(--color-gh-card)] min-h-[400px] border border-[var(--color-gh-border)] rounded-xl p-6 shadow-sm flex flex-col transition-all hover:shadow-lg">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-1">High Velocity</h3>
            <p className="text-sm text-[var(--color-gh-muted)]">Massively starred repos with commits in the last 30 days.</p>
          </div>
          <div className="flex-1 space-y-4">
             {trending.map((repo) => (
                <div key={repo.full_name} className="group p-4 bg-[var(--color-gh-bg)] border border-[var(--color-gh-border)] rounded-lg hover:border-[var(--color-gh-accent)] transition-colors flex items-center">
                  <div className="flex-1 min-w-0 pr-4">
                    <a href={repo.html_url} target="_blank" rel="noreferrer" className="font-semibold text-white hover:text-[var(--color-gh-accent)] truncate block transition-colors">
                      {repo.full_name}
                    </a>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-gh-muted)]">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" /> {repo.stargazers_count.toLocaleString()}</span>
                      <span className="w-1 h-1 bg-[var(--color-gh-border)] rounded-full"></span>
                      <span className="truncate">{repo.language || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="flex-none">
                    <ChevronRight className="w-5 h-5 text-[var(--color-gh-muted)] group-hover:text-white transition-colors group-hover:translate-x-1" />
                  </div>
                </div>
             ))}
             {trending.length === 0 && (
               <div className="flex flex-col items-center justify-center py-8 text-[var(--color-gh-muted)]">
                 <p className="text-sm italic">No recent very high star repos found.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
