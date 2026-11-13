import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, onLocaleChange, setLocale, translateText } from '../../src/core/i18n.js';
import { ES_ES } from '../../src/i18n/es-ES.js';

afterEach(() => setLocale('pt-BR'));

describe('idioma da interface', () => {
  it('pt-BR e o padrao e nao traduz nada', () => {
    expect(getLocale()).toBe('pt-BR');
    expect(translateText('Criar conta')).toBe('Criar conta');
  });

  it('es-ES traduz frases conhecidas, mantem espacos e deixa o resto como esta', () => {
    setLocale('es-ES');
    expect(translateText('Criar conta')).toBe('Crear cuenta');
    expect(translateText('\n   Voltar para o login  ')).toBe('\n   Volver al inicio de sesión  ');
    expect(translateText('Mercado do mês')).toBe('Mercado do mês');
    expect(translateText('   ')).toBe('   ');
  });

  it('idioma desconhecido volta para pt-BR e avisa quem esta ouvindo', () => {
    const seen = [];
    const off = onLocaleChange((locale) => seen.push(locale));
    setLocale('es-ES');
    setLocale('en-US');
    off();
    expect(seen).toEqual(['es-ES', 'pt-BR']);
  });

  it('nenhuma traducao vazia e nenhuma traducao que tambem seja chave (evita traduzir duas vezes)', () => {
    const keys = new Set(Object.keys(ES_ES.messages));
    for (const [source, translated] of Object.entries(ES_ES.messages)) {
      expect(translated.trim(), source).not.toBe('');
      if (translated !== source) expect(keys.has(translated), `${source} -> ${translated}`).toBe(false);
    }
  });
});
