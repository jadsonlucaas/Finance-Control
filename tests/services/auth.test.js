import { describe, expect, it } from 'vitest';
import { normalizeAuthError } from '../../src/services/authErrors.js';

describe('auth service', () => {
  it('normalizes known Firebase auth errors', () => {
    expect(normalizeAuthError({ code: 'auth/invalid-email' })).toBe('Informe um email válido.');
    expect(normalizeAuthError({ code: 'auth/invalid-credential' })).toBe('Email ou senha inválidos.');
    expect(normalizeAuthError({ code: 'auth/weak-password' })).toBe('A senha precisa ter pelo menos 6 caracteres.');
  });

  it('returns a generic message for unknown errors', () => {
    expect(normalizeAuthError({ code: 'auth/other' })).toBe('Não foi possível concluir a autenticação.');
    expect(normalizeAuthError(null)).toBe('Não foi possível concluir a autenticação.');
  });
});
