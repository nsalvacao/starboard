import { Download } from 'lucide-react';
import type { Repository } from '../../types';
import type { ViewMode } from '../../types';

interface ExportButtonProps {
  repos: Repository[];
  viewMode: ViewMode;
}

const CSV_COLUMNS = [
  'full_name',
  'language',
  'llm_category',
  'stargazers_count',
  'forks_count',
  'days_since_push',
  'watch_candidate',
  'cleanup_candidate',
  'updated_at',
] as const;

function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

function toCsv(repos: Repository[]): string {
  const header = CSV_COLUMNS.join(',');
  const lines = repos.map((repo) =>
    CSV_COLUMNS.map((column) => csvEscape(repo[column])).join(',')
  );
  return [header, ...lines].join('\n');
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ExportButton({ repos, viewMode }: ExportButtonProps) {
  const baseName = `starboard-${viewMode}-${timestamp()}`;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() =>
          downloadFile(JSON.stringify(repos, null, 2), `${baseName}.json`, 'application/json')
        }
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-xs text-[var(--color-gh-muted)] hover:text-white hover:border-[var(--color-gh-muted)]"
      >
        <Download className="w-3.5 h-3.5" />
        Export JSON
      </button>
      <button
        onClick={() => downloadFile(toCsv(repos), `${baseName}.csv`, 'text/csv;charset=utf-8')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-gh-border)] bg-[var(--color-gh-bg)] text-xs text-[var(--color-gh-muted)] hover:text-white hover:border-[var(--color-gh-muted)]"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
    </div>
  );
}
