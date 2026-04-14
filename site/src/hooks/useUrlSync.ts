import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { ViewMode } from '../types';

export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewMode, setViewMode, filters, setFilter, searchQuery, setSearchQuery } = useStore();

  // Read from URL — sync state when URL changes externally
  useEffect(() => {
    const validModes: ViewMode[] = ['all', 'watch', 'discover', 'compare', 'cleanup'];
    const nav = searchParams.get('nav');
    if (nav && validModes.includes(nav as ViewMode)) {
      if (nav !== viewMode) setViewMode(nav as ViewMode);
    } else if (viewMode !== 'all') {
      setViewMode('all');
    }

    const q = searchParams.get('q');
    if (q !== null) {
      if (q !== searchQuery) setSearchQuery(q);
    } else if (searchQuery) {
      setSearchQuery('');
    }

    const categories = searchParams.get('categories');
    if (categories) {
      if (categories !== filters.category.join(',')) setFilter('category', categories.split(','));
    } else if (filters.category.length > 0) {
      setFilter('category', []);
    }

  }, [searchParams, setViewMode, setSearchQuery, setFilter, viewMode, searchQuery, filters.category]);

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
