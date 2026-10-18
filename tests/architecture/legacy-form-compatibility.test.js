import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacy form compatibility', () => {
  it('does not assume the removed installment checkbox exists', () => {
    const legacyFormSource = readFileSync(resolve('src/legacy/inline/part-03.js'), 'utf8');

    expect(legacyFormSource).not.toContain("document.getElementById('form-installment-check').checked");
    expect(legacyFormSource).toContain("document.getElementById('form-expense-type')");
  });
});
