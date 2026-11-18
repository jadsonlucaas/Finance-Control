import { describe, expect, it } from 'vitest';
import { avatarInitial, bottomTabFor, normalizeSearch } from '../../src/ui/shell/appShell.js';

describe('casco do app', () => {
  it('saidas e entradas acendem o mesmo item da barra inferior', () => {
    expect(bottomTabFor('entradas')).toBe('saidas');
    expect(bottomTabFor('saidas')).toBe('saidas');
    expect(bottomTabFor('configuracoes')).toBe('configuracoes');
  });

  it('avatar usa a inicial do e-mail', () => {
    expect(avatarInitial('jadson@example.com')).toBe('J');
    expect(avatarInitial('')).toBe('?');
  });

  it('busca do menu ignora acentos e maiusculas', () => {
    expect(normalizeSearch('  Orçamentos ')).toBe('orcamentos');
    expect(normalizeSearch('IMPORTAÇÃO')).toBe('importacao');
  });
});
