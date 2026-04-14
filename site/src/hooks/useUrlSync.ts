import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { ViewMode } from '../types';

const VALID_MODES: ViewMode[] = ['all', 'watch', 'discover', 'compare', 'cleanup'];

export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewMode, setViewMode, filters, setFilter, searchQuery, setSearchQuery } = useStore();
  const writingRef = useRef(false);

  // Read from URL — only reacts to actual URL changes (back/forward, external navigation)
  useEffect(() => {
    // Skip if the URL change originated from our own write effect
    if (writingRef.current) {
      writingRef.current = false;
      return;
    }

    const nav = searchParams.get('nav');
    if (nav && VALID_MODES.includes(nav as ViewMode)) {
      setViewMode(nav as ViewMode);
    } else {
      setViewMode('all');
    }

    const q = searchParams.get('q');
    setSearchQuery(q ?? '');

    const categories = searchParams.get('categories');
    setFilter('category', categories ? categories.split(',') : []);

    const languages = searchParams.get('languages');
    setFilter('language', languages ? languages.split(',') : []);

  }, [searchParams, setViewMode, setSearchQuery, setFilter]);

  // Write to URL on state change
  useEffect(() => {
    const newParams = new URLSearchParams();

    if (viewMode !== 'all') newParams.set('nav', viewMode);
    if (searchQuery) newParams.set('q', searchQuery);
    if (filters.category.length > 0) newParams.set('categories', filters.category.join(','));
    if (filters.language.length > 0) newParams.set('languages', filters.language.join(','));

    const current = new URLSearchParams(window.location.search);
    if (current.toString() !== newParams.toString()) {
      writingRef.current = true;
      setSearchParams(newParams, { replace: true });
    }
  }, [viewMode, searchQuery, filters.category, filters.language, setSearchParams]);
}
