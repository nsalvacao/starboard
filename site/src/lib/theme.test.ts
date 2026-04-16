import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme';

describe('applyTheme', () => {
  it('syncs the document theme attributes', () => {
    applyTheme('light');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
