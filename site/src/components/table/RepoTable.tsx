import { useStore } from '../../store/useStore';
import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, GitFork, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Repository, SortKey } from '../../types';
import { updateSortCriteria } from '../../lib/repoSelectors';

interface RepoTableProps {
  repos: Repository[];
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  className?: string;
  onSort: (key: SortKey, isMultiSort: boolean) => void;
}

function SortableHeader({ label, sortKey, className, onSort }: SortableHeaderProps) {
  const sortCriteria = useStore((state) => state.sortCriteria);
  const activeIndex = sortCriteria.findIndex((criterion) => criterion.key === sortKey);
  const activeCriterion = activeIndex >= 0 ? sortCriteria[activeIndex] : null;

  return (
    <button
      onClick={(event) => onSort(sortKey, event.shiftKey)}
      className={cn(
        'inline-flex items-center gap-1 hover:text-white transition-colors text-left',
        className
      )}
      title="Click to sort, Shift+Click for multi-sort"
    >
      <span>{label}</span>
      {activeCriterion ? (
        activeCriterion.direction === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      )}
      {activeIndex >= 0 && (
        <span className="text-[10px] px-1 rounded bg-[var(--color-gh-border)]">{activeIndex + 1}</span>
      )}
    </button>
  );
}

export function RepoTable({ repos }: RepoTableProps) {
  const {
    selectedRepos,
    toggleSelection,
    openRepoModal,
    sortCriteria,
    setSortCriteria,
  } = useStore();

  const filteredRepos = useMemo(() => repos, [repos]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredRepos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 75,
    overscan: 10,
  });

  const onSort = (key: SortKey, isMultiSort: boolean) => {
    setSortCriteria(updateSortCriteria(sortCriteria, key, isMultiSort));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[auto_2fr_1fr_1fr_100px_100px] gap-4 p-4 border-b border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-xs font-semibold text-[var(--color-gh-muted)] uppercase tracking-wider">
        <div className="w-8 flex items-center justify-center">
          <input type="checkbox" 
            checked={filteredRepos.length > 0 && filteredRepos.slice(0, 6).every(r => selectedRepos.includes(r.full_name))}
            onChange={(e) => {
              if (e.target.checked) {
                filteredRepos.slice(0, 6).forEach(r => {
                  if (!selectedRepos.includes(r.full_name)) toggleSelection(r.full_name);
                });
              } else {
                filteredRepos.slice(0, 6).forEach(r => {
                  if (selectedRepos.includes(r.full_name)) toggleSelection(r.full_name);
                });
              }
            }}
            title="Select first 6 repositories"
            aria-label="Select first 6 repositories"
            className="rounded border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-[var(--color-gh-accent)] focus:ring-[var(--color-gh-accent)]" 
          />
        </div>
        <SortableHeader label="Repository" sortKey="full_name" onSort={onSort} />
        <SortableHeader label="Category & Lang" sortKey="llm_category" onSort={onSort} />
        <div className="hidden lg:block">
          <SortableHeader label="Summary" sortKey="language" onSort={onSort} />
        </div>
        <div className="text-right">
          <SortableHeader label="Stats" sortKey="stargazers_count" className="justify-end w-full" onSort={onSort} />
        </div>
        <div className="text-right">
          <SortableHeader label="Activity" sortKey="days_since_push" className="justify-end w-full" onSort={onSort} />
        </div>
      </div>

      {/* Virtual Table Body */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const repo = filteredRepos[virtualItem.index];
            return (
              <div
                key={repo.full_name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="grid grid-cols-[auto_2fr_1fr_1fr_100px_100px] gap-4 p-4 items-center border-b border-[var(--color-gh-border)] hover:bg-[var(--color-gh-hover)] transition-colors group cursor-pointer"
                onClick={() => openRepoModal(repo.full_name)}
              >
                <div className="w-8 flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={selectedRepos.includes(repo.full_name)}
                    onChange={(event) => {
                      event.stopPropagation();
                      toggleSelection(repo.full_name);
                    }}
                    aria-label={`Select ${repo.full_name} for comparison`}
                    className="rounded border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] focus:ring-[var(--color-gh-accent)]" 
                  />
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://github.com/${repo.full_name.split('/')[0]}.png?size=20`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full"
                    />
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-[var(--color-gh-accent)] hover:underline truncate"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {repo.full_name}
                    </a>
                  </div>
                  <div className="text-xs text-[var(--color-gh-muted)] truncate mt-1">{repo.description}</div>
                </div>

                <div className="min-w-0 flex flex-col gap-1">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full w-fit", 
                    repo.llm_category === 'AI/ML' ? 'bg-purple-900/30 text-purple-400 border border-purple-800' :
                    'bg-[var(--color-gh-border)] text-white'
                  )}>
                    {repo.llm_category || 'Uncategorized'}
                  </span>
                  {repo.language && <div className="text-xs text-[var(--color-gh-muted)] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span> {repo.language}
                  </div>}
                </div>

                <div className="hidden lg:block text-xs text-[var(--color-gh-muted)] line-clamp-2 pr-4 italic">
                  {repo.llm_summary || "Waiting for LLM enrichment..."}
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <div className="text-xs text-[var(--color-gh-text)] flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" /> {repo.stargazers_count.toLocaleString()}
                  </div>
                  <div className="text-xs text-[var(--color-gh-muted)] flex items-center gap-1">
                    <GitFork className="w-3 h-3" /> {repo.forks_count.toLocaleString()}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <div className="text-xs text-[var(--color-gh-text)] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {repo.days_since_push}d
                  </div>
                  {repo.cleanup_candidate && (
                    <div className="text-xs text-[var(--color-gh-danger)] mt-1 font-medium bg-[var(--color-gh-danger)]/10 px-1.5 py-0.5 rounded">
                      Cleanup
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
