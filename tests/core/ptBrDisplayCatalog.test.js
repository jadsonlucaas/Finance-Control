import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setLocale, translateText } from '../../src/core/i18n.js';
import { PT_BR } from '../../src/i18n/pt-BR.js';
import { ES_ES } from '../../src/i18n/es-ES.js';
import { accentuate } from '../../scripts/build-pt-br-display-catalog.mjs';

afterEach(async () => { await setLocale('pt-BR'); });

describe('acentuacao dos textos antigos em pt-BR', () => {
  it('corrige textos conhecidos e deixa o resto igual', () => {
    expect(translateText('Saidas pagas')).toBe('Saídas pagas');
    expect(translateText('  Visao estrategica\n')).toBe('  Visão estratégica\n');
    expect(translateText('Criar conta')).toBe('Criar conta');
    expect(translateText('Mercado do mes da Ana')).toBe('Mercado do mes da Ana');
  });

  it('mantem maiusculas e nao troca palavras ambiguas', () => {
    expect(accentuate('VISAO GERAL')).toBe('VISÃO GERAL');
    expect(accentuate('Esta e a saida')).toBe('Esta e a saída');
  });

  it('toda chave do pt-BR e um texto-fonte do es-ES (o espanhol continua traduzindo)', async () => {
    for (const key of Object.keys(PT_BR.messages)) expect(ES_ES.messages[key], key).toBeDefined();
    await setLocale('es-ES');
    expect(translateText('Saidas pagas')).toBe(ES_ES.messages['Saidas pagas']);
  });

  it('arquivo gerado esta em dia com o es-ES', () => {
    expect(() => execFileSync(process.execPath, ['scripts/build-pt-br-display-catalog.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
    expect(readFileSync('src/i18n/pt-BR.js', 'utf8')).toContain('ARQUIVO GERADO');
  });
});
