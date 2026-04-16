import { describe, expect, it } from 'vitest';
import {
  parseCsvParam,
  parseSortParam,
  serializeCsvParam,
  serializeSortParam,
} from './urlState';

describe('urlState csv helpers', () => {
  it('parses csv query params', () => {
    expect(parseCsvParam('ai,mcp,cli')).toEqual(['ai', 'mcp', 'cli']);
    expect(parseCsvParam('')).toEqual([]);
    expect(parseCsvParam(null)).toEqual([]);
  });

  it('serializes csv query params', () => {
    expect(serializeCsvParam(['ai', 'mcp'])).toBe('ai,mcp');
    expect(serializeCsvParam([])).toBeNull();
  });
});

describe('urlState sort helpers', () => {
  it('parses valid sort entries and ignores invalid ones', () => {
    expect(parseSortParam('stargazers_count:desc,bad:nope,language:asc')).toEqual([
      { key: 'stargazers_count', direction: 'desc' },
      { key: 'language', direction: 'asc' },
    ]);
  });

  it('serializes sort entries', () => {
    expect(
      serializeSortParam([
        { key: 'stargazers_count', direction: 'desc' },
        { key: 'language', direction: 'asc' },
      ])
    ).toBe('stargazers_count:desc,language:asc');

    expect(serializeSortParam([])).toBeNull();
  });
});
