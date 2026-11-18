import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src', 'tests', 'docs'];
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.md', '.css']);
// UTF-8 lido como Latin-1/Windows-1252: A-til ou A-circunflexo seguidos de um caractere que
// so aparece nesse defeito (ex.: c-cedilha vira A-til + paragrafo). A-til seguido de letra e
// legitimo em maiusculas (NAO, VISAO com til).
const C = (code) => String.fromCharCode(code);
const CP1252_TAIL = '\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014\\u2018-\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122';
const MOJIBAKE_PATTERN = new RegExp(`[${C(0x00c3)}${C(0x00c2)}][${CP1252_TAIL}]|${C(0xfffd)}|${C(0x00e2)}[€¢€“”’]`);
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
  it('detecta acento quebrado e aceita maiusculas com til', () => {
    expect(MOJIBAKE_PATTERN.test(`Sa${C(0x00c3)}${C(0x00ad)}da`)).toBe(true);
    expect(MOJIBAKE_PATTERN.test(`a${C(0x00c3)}${C(0x00a7)}${C(0x00c3)}${C(0x00a3)}o`)).toBe(true);
    expect(MOJIBAKE_PATTERN.test(`CONFIGURA${C(0x00c3)}${C(0x2021)}${C(0x00c3)}${C(0x2022)}ES`)).toBe(true);
    expect(MOJIBAKE_PATTERN.test(`texto ${C(0xfffd)}`)).toBe(true);
    expect(MOJIBAKE_PATTERN.test(`IMPORTA${C(0x00c7)}${C(0x00c3)}O`)).toBe(false);
    expect(MOJIBAKE_PATTERN.test(`N${C(0x00c3)}O e VIS${C(0x00c3)}O GERAL`)).toBe(false);
  });

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
