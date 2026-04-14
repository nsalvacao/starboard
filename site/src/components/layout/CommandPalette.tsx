import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Command } from 'lucide-react';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { setViewMode } = useStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // CMD/CTRL + K to open palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      
      // '/' to focus search globally
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search')?.focus();
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={() => setIsOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[var(--color-gh-border)]">
          <Command className="w-4 h-4 text-[var(--color-gh-muted)] mr-3" />
          <input 
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-[var(--color-gh-muted)]"
            placeholder="Type a command or navigate..."
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          <div className="text-xs font-semibold text-[var(--color-gh-muted)] px-3 mb-2 mt-2 uppercase tracking-wider">Navigation</div>
          {[
            { label: 'Go to All Repos', mode: 'all' as const },
            { label: 'Go to Watch', mode: 'watch' as const },
            { label: 'Go to Discover', mode: 'discover' as const },
            { label: 'Go to Compare', mode: 'compare' as const },
            { label: 'Go to Cleanup', mode: 'cleanup' as const },
          ].filter(item => item.label.toLowerCase().includes(query.toLowerCase())).map((item) => (
            <button
               key={item.mode}
               onClick={() => {
                 setViewMode(item.mode);
                 setIsOpen(false);
                 setQuery('');
               }}
               className="w-full flex items-center px-3 py-2 text-sm text-[var(--color-gh-text)] rounded-md hover:bg-[var(--color-gh-accent)] hover:text-white transition-colors text-left"
             >
               {item.label}
             </button>
           ))}
        </div>
      </div>
    </>
  );
}
