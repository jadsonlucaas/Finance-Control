import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INLINE_HANDLER_PATTERN = /\s(onclick|onchange|onsubmit)\s*=/gi;

describe('index.html inline event handlers', () => {
  it('keeps static HTML events centralized outside inline attributes', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    const matches = [...html.matchAll(INLINE_HANDLER_PATTERN)].map((match) => match[1].toLowerCase());

    expect(matches).toEqual([]);
  });
});
