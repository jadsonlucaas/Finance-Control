import { describe, expect, it } from 'vitest';
import { readSetting } from '../../../services/whatsapp-api/src/settings.js';

describe('whatsapp-api: leitura de configuracao', () => {
  it('prefere a variavel direta', () => {
    expect(readSetting('KEY', { env: { KEY: ' abc ', KEY_FILE: '/x' }, readFile: () => 'file' })).toBe('abc');
  });

  it('le de arquivo (Docker secret) quando so existe *_FILE', () => {
    const env = { KEY_FILE: '/run/secrets/key' };
    expect(readSetting('KEY', { env, readFile: (path) => (path === '/run/secrets/key' ? 'segredo\n' : '') })).toBe('segredo');
  });

  it('retorna vazio quando nada foi configurado e falha com arquivo vazio ou ilegivel', () => {
    expect(readSetting('KEY', { env: {} })).toBe('');
    expect(() => readSetting('KEY', { env: { KEY_FILE: '/x' }, readFile: () => '  ' })).toThrow(/vazio/);
    expect(() => readSetting('KEY', { env: { KEY_FILE: '/x' }, readFile: () => { throw new Error('ENOENT'); } })).toThrow(/ler KEY_FILE/);
  });
});
