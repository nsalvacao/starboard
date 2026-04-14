import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { CommandPalette } from './components/layout/CommandPalette';
import { TopNavigationBar } from './components/layout/TopNavigationBar';
import { FilterPills } from './components/layout/FilterPills';
import { MainWorkspace } from './components/layout/MainWorkspace';

function App() {
  const fetchRepos = useStore((state) => state.fetchRepos);
  const isLoading = useStore((state) => state.isLoading);
  const preferences = useStore((state) => state.preferences);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  useEffect(() => {
    // Apply density config to body if needed, and class 'dark' for tailwind if we were to support light mode
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

  return (
    <div className="min-h-screen bg-[var(--color-gh-bg)] text-[var(--color-gh-text)] flex flex-col font-sans">
      <TopNavigationBar />
      
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        <FilterPills />
        <MainWorkspace isLoading={isLoading} />
      </div>

      <CommandPalette />
    </div>
  );
}

export default App;
