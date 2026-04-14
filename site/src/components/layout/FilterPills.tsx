import { useStore } from '../../store/useStore';
import { X, Filter, ChevronDown } from 'lucide-react';
import { useMemo } from 'react';

export function FilterPills() {
  const { viewMode, filters, setFilter, clearFilters, repos } = useStore();

  const categories = useMemo(() => Array.from(new Set(repos.map(r => r.llm_category).filter((c): c is string => Boolean(c)))), [repos]);
  const languages = useMemo(() => Array.from(new Set(repos.map(r => r.language).filter((l): l is string => Boolean(l)))), [repos]);

  const toggleArrayItem = (arr: string[], item: string) => 
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  // Hide extensive filters if we are in a non-table view
  if (viewMode === 'discover') return null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-lg shadow-sm">
      <div className="flex items-center gap-2 text-sm text-[var(--color-gh-muted)] mr-2">
        <Filter className="w-4 h-4" />
        <span className="font-medium">Filter</span>
      </div>

      {/* Category Dropdown/Pill */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-gh-bg)] border border-[var(--color-gh-border)] rounded-md text-sm hover:border-[var(--color-gh-muted)] transition-colors">
          Category 
          {filters.category.length > 0 && <span className="bg-[var(--color-gh-accent)] text-white text-xs px-1.5 rounded-full">{filters.category.length}</span>}
          <ChevronDown className="w-3 h-3 text-[var(--color-gh-muted)]" />
        </button>
        <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="p-2 space-y-1">
            {categories.map(c => (
              <label key={c} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--color-gh-hover)] rounded cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={filters.category.includes(c)}
                  onChange={() => setFilter('category', toggleArrayItem(filters.category, c))}
                  className="rounded border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-[var(--color-gh-accent)] focus:ring-[var(--color-gh-accent)]"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Language Dropdown/Pill */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-gh-bg)] border border-[var(--color-gh-border)] rounded-md text-sm hover:border-[var(--color-gh-muted)] transition-colors">
          Language 
          {filters.language.length > 0 && <span className="bg-[var(--color-gh-accent)] text-white text-xs px-1.5 rounded-full">{filters.language.length}</span>}
          <ChevronDown className="w-3 h-3 text-[var(--color-gh-muted)]" />
        </button>
        <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="p-2 space-y-1">
            {languages.map(l => (
              <label key={l} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--color-gh-hover)] rounded cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={filters.language.includes(l)}
                  onChange={() => setFilter('language', toggleArrayItem(filters.language, l))}
                  className="rounded border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-[var(--color-gh-accent)] focus:ring-[var(--color-gh-accent)]"
                />
                {l}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {(filters.category.length > 0 || filters.language.length > 0 || filters.status.length > 0) && (
        <button 
          onClick={clearFilters}
          className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-gh-danger)] hover:bg-[var(--color-gh-danger)]/10 rounded transition-colors"
        >
          <X className="w-3 h-3" />
          Clear rules
        </button>
      )}
    </div>
  );
}
