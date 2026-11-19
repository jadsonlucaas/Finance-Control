import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('../../src/core/i18n.js', () => ({
  onLocaleChange: () => () => {},
  translateText: (text) => (text === 'Controle Financeiro' ? 'Control Financiero' : text)
}));
import { DEFAULT_APP_NAME, applyAppName, resolveAppName } from '../../src/core/brand.js';

describe('brand', () => {
  it('usa o nome provisório quando VITE_APP_NAME não existe', () => {
    expect(resolveAppName({})).toBe(DEFAULT_APP_NAME);
    expect(resolveAppName({ VITE_APP_NAME: '   ' })).toBe(DEFAULT_APP_NAME);
  });

  it('usa VITE_APP_NAME quando definido', () => {
    expect(resolveAppName({ VITE_APP_NAME: '  Nova   Marca ' })).toBe('Nova Marca');
  });

  it('aplica o nome traduzido no título e nos elementos marcados', () => {
    const marked = [{ textContent: '' }];
    const appTitle = { textContent: '' };
    const target = {
      document: {
        title: '',
        querySelectorAll: () => marked,
        getElementById: (id) => (id === 'app-title' ? appTitle : null)
      }
    };
    expect(applyAppName(target, 'Controle Financeiro')).toBe('Control Financiero');
    expect(target.document.title).toBe('Control Financiero');
    expect(marked[0].textContent).toBe('Control Financiero');
    expect(appTitle.textContent).toBe('Control Financiero');
  });
});
