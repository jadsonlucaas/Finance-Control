import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src', 'tests', 'docs'];
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.md', '.css']);
const MOJIBAKE_PATTERN = new RegExp(`[${String.fromCharCode(0x00c3)}${String.fromCharCode(0x00c2)}${String.fromCharCode(0xfffd)}]|${String.fromCharCode(0x00e2)}[€¢€“”’]`);
const QUESTION_MARK = String.fromCharCode(0x003f);
const BROKEN_ACCENT_MARKERS = [
  `${QUESTION_MARK}s`,
  `Par${QUESTION_MARK}metros`,
  `par${QUESTION_MARK}metros`,
  `CONFIGURAÇ${QUESTION_MARK}ES`,
  `${QUESTION_MARK}nico`,
  `Refer${QUESTION_MARK}ncia`
];

function listTextFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return listTextFiles(fullPath);
    return TEXT_EXTENSIONS.has(extname(fullPath)) ? [fullPath] : [];
  });
}

describe('text encoding hygiene', () => {
  it('keeps source text free from common mojibake markers', () => {
    const offenders = ROOTS
      .flatMap(listTextFiles)
      .filter((file) => {
        const content = readFileSync(file, 'utf8');
        return MOJIBAKE_PATTERN.test(content) || BROKEN_ACCENT_MARKERS.some((marker) => content.includes(marker));
      })
      .map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
