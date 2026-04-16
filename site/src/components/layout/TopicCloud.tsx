import { useMemo } from 'react';
import { Hash } from 'lucide-react';
import type { Repository } from '../../types';
import { cn } from '../../lib/utils';

interface TopicCloudProps {
  repos: Repository[];
  selectedTopics: string[];
  onToggleTopic: (topic: string) => void;
  onClearTopics: () => void;
}

const MAX_TOPICS = 20;

export function TopicCloud({
  repos,
  selectedTopics,
  onToggleTopic,
  onClearTopics,
}: TopicCloudProps) {
  const topicStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repo of repos) {
      for (const topic of repo.topics || []) {
        counts.set(topic, (counts.get(topic) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_TOPICS);
  }, [repos]);

  if (topicStats.length === 0) return null;

  const maxCount = topicStats[0][1] || 1;

  return (
    <section className="bg-[var(--color-gh-card)] border border-[var(--color-gh-border)] rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-[var(--color-gh-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-gh-strong)]">Topic Cloud</h3>
        </div>
        {selectedTopics.length > 0 && (
          <button
            onClick={onClearTopics}
            className="text-xs text-[var(--color-gh-danger)] hover:bg-[var(--color-gh-danger)]/10 px-2 py-1 rounded"
          >
            Clear topics
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {topicStats.map(([topic, count]) => {
          const isSelected = selectedTopics.includes(topic);
          const ratio = count / maxCount;
          const scaleClass = ratio > 0.66 ? 'text-sm' : ratio > 0.33 ? 'text-xs' : 'text-[11px]';
          return (
            <button
              key={topic}
              onClick={() => onToggleTopic(topic)}
              className={cn(
                'px-2.5 py-1 rounded-md border transition-colors',
                scaleClass,
                isSelected
                  ? 'border-[var(--color-gh-accent)] bg-[var(--color-gh-accent)]/15 text-[var(--color-gh-accent)]'
                  : 'border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-[var(--color-gh-muted)] hover:text-[var(--color-gh-strong)] hover:border-[var(--color-gh-muted)]'
              )}
            >
              {topic} <span className="opacity-80">({count})</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
