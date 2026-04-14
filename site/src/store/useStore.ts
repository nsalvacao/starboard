import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Repository, ViewMode, Preferences } from '../types';

interface AppState {
  // Data
  repos: Repository[];
  isLoading: boolean;
  error: string | null;
  fetchRepos: () => Promise<void>;

  // UI State
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  filters: {
    category: string[];
    language: string[];
    status: string[];
  };
  setFilter: (key: keyof AppState['filters'], values: string[]) => void;
  clearFilters: () => void;

  // Preferences
  preferences: Preferences;
  setPreferences: (prefs: Partial<Preferences>) => void;

  // Selection & Compare
  selectedRepos: string[];
  toggleSelection: (repoId: string) => void;
  clearSelection: () => void;
}

let _fetchInFlight = false;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      repos: [],
      isLoading: true,
      error: null,
      fetchRepos: async () => {
        if (_fetchInFlight) return;
        _fetchInFlight = true;
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}data/stars.json`);
          if (!res.ok) throw new Error(`Failed to fetch stars data: ${res.status} ${res.statusText}`);
          const data = await res.json();
          set({ repos: data, isLoading: false, error: null });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stars data';
          set({ error: errorMessage, isLoading: false });
        } finally {
          _fetchInFlight = false;
        }
      },

      viewMode: 'all',
      setViewMode: (mode) => set({ viewMode: mode }),

      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      filters: { category: [], language: [], status: [] },
      setFilter: (key, values) =>
        set((state) => ({
          filters: { ...state.filters, [key]: values },
        })),
      clearFilters: () =>
        set({ filters: { category: [], language: [], status: [] } }),

      preferences: { theme: 'dark', density: 'normal' },
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      selectedRepos: [],
      toggleSelection: (repoId) =>
        set((state) => {
          const sel = state.selectedRepos;
          if (sel.includes(repoId)) return { selectedRepos: sel.filter((id) => id !== repoId) };
          if (sel.length >= 6) return {}; // max 6 slots for comparison
          return { selectedRepos: [...sel, repoId] };
        }),
      clearSelection: () => set({ selectedRepos: [] }),
    }),
    {
      name: 'starboard-storage',
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
);
