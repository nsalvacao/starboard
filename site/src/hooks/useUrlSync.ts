import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { ViewMode } from '../types';
import {
  parseCsvParam,
  parseSortParam,
  serializeCsvParam,
  serializeSortParam,
} from '../lib/urlState';

const VALID_MODES: ViewMode[] = ['all', 'watch', 'discover', 'compare', 'cleanup', 'analytics'];

export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    viewMode,
    setViewMode,
    filters,
    setFilter,
    searchQuery,
    setSearchQuery,
    sortCriteria,
    setSortCriteria,
  } = useStore();
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

    setFilter('category', parseCsvParam(searchParams.get('categories')));
    setFilter('language', parseCsvParam(searchParams.get('languages')));
    setFilter('topics', parseCsvParam(searchParams.get('topics')));

    setSortCriteria(parseSortParam(searchParams.get('sort')));
  }, [searchParams, setViewMode, setSearchQuery, setFilter, setSortCriteria]);

  // Write to URL on state change
  useEffect(() => {
    const newParams = new URLSearchParams();

    if (viewMode !== 'all') newParams.set('nav', viewMode);
    if (searchQuery) newParams.set('q', searchQuery);
    const categories = serializeCsvParam(filters.category);
    if (categories) newParams.set('categories', categories);

    const languages = serializeCsvParam(filters.language);
    if (languages) newParams.set('languages', languages);

    const topics = serializeCsvParam(filters.topics);
    if (topics) newParams.set('topics', topics);

    const sort = serializeSortParam(sortCriteria);
    if (sort) newParams.set('sort', sort);

    const current = new URLSearchParams(window.location.search);
    if (current.toString() !== newParams.toString()) {
      writingRef.current = true;
      setSearchParams(newParams, { replace: true });
    }
  }, [
    viewMode,
    searchQuery,
    filters.category,
    filters.language,
    filters.topics,
    sortCriteria,
    setSearchParams,
  ]);
}
