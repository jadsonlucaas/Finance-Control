import { describe, expect, it } from 'vitest';
import { installSettingsPanelCards, matchSettingsPanel } from '../../src/ui/settings/settingsPanelCards.js';

function panelWithTitle(text) {
  return { querySelector: (selector) => (selector === 'h3' ? { textContent: text } : null) };
}

describe('settingsPanelCards', () => {
  it('reconhece os painéis de parametrização pelo título', () => {
    expect(matchSettingsPanel(panelWithTitle('Usuários do sistema'))?.key).toBe('usuarios');
    expect(matchSettingsPanel(panelWithTitle('  Parâmetros INSS e IRRF ')).key).toBe('inss-irrf');
    expect(matchSettingsPanel(panelWithTitle('Pessoas'))?.key).toBe('pessoas');
    expect(matchSettingsPanel(panelWithTitle('Categorias Macro'))?.key).toBe('categorias-macro');
    expect(matchSettingsPanel(panelWithTitle('Categorias Personalizadas'))?.key).toBe('categorias');
    expect(matchSettingsPanel(panelWithTitle('Configuração de Tipos de H.E.'))?.key).toBe('tipos-he');
    expect(matchSettingsPanel(panelWithTitle('Outras Fontes de Renda'))?.key).toBe('fontes-renda');
    expect(matchSettingsPanel(panelWithTitle('Regras fixas percentuais'))?.key).toBe('regras-percentuais');
  });

  it('deixa de fora painéis que não são parametrização', () => {
    expect(matchSettingsPanel(panelWithTitle('Histórico'))).toBeNull();
    expect(matchSettingsPanel({ querySelector: () => null })).toBeNull();
  });

  it('instala uma vez no namespace financeApp', () => {
    const target = { document: {}, financeApp: {} };
    const first = installSettingsPanelCards(target);
    expect(typeof first.apply).toBe('function');
    expect(installSettingsPanelCards(target)).toBe(first);
    expect(installSettingsPanelCards({})).toBeNull();
  });
});
