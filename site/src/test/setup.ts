import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  window.localStorage.clear();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});
