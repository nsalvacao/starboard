import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { ViewMode } from '../types';

export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewMode, setViewMode, filters, setFilter, searchQuery, setSearchQuery } = useStore();

  // Read from URL on mount
  useEffect(() => {
    const nav = searchParams.get('nav');
    if (nav && ['all', 'watch', 'discover', 'compare', 'cleanup'].includes(nav)) {
      if (nav !== viewMode) setViewMode(nav as ViewMode);
    }

    const q = searchParams.get('q');
    if (q !== null && q !== searchQuery) setSearchQuery(q);

    const categories = searchParams.get('categories');
    if (categories) {
      if (categories !== filters.category.join(',')) setFilter('category', categories.split(','));
    }

  }, [searchParams, setViewMode, setSearchQuery, setFilter, viewMode, searchQuery, filters.category]); // Sync when URL changes externally

  // Write to URL on state change
  useEffect(() => {
    const newParams = new URLSearchParams();
    
    if (viewMode !== 'all') newParams.set('nav', viewMode);
    if (searchQuery) newParams.set('q', searchQuery);
    if (filters.category.length > 0) newParams.set('categories', filters.category.join(','));
    
    if (searchParams.toString() !== newParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [viewMode, searchQuery, filters.category, setSearchParams, searchParams]);
}
