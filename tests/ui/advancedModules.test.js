import { describe, expect, it } from 'vitest';
import { hasAdvancedData, isAdvancedTab, resolveAdvancedModules } from '../../src/ui/shell/advancedModules.js';
import { sidebarTabFor } from '../../src/ui/navigationTabs.js';

describe('módulos avançados', () => {
  it('liga sozinho para quem já tem horas, hora extra, DSR, INSS ou IRPF', () => {
    expect(hasAdvancedData([{ type: 'controle_horas' }])).toBe(true);
    expect(hasAdvancedData([{ type: 'entrada', earning_type: 'Hora Extra' }])).toBe(true);
    expect(hasAdvancedData([{ type: 'entrada', earning_type: 'DSR' }])).toBe(true);
    expect(hasAdvancedData([{ type: 'entrada', subcategory: 'INSS (dedução)' }])).toBe(true);
    expect(hasAdvancedData([{ type: 'entrada', earning_type: 'IRPF (dedução)' }])).toBe(true);
  });

  it('fica desligado para contas só com salário e despesas', () => {
    expect(hasAdvancedData([])).toBe(false);
    expect(hasAdvancedData(null)).toBe(false);
    expect(hasAdvancedData([{ type: 'entrada', earning_type: 'Salário' }, { type: 'saida', category: 'DSR' }])).toBe(false);
  });

  it('a escolha salva vence a detecção', () => {
    const withHours = [{ type: 'controle_horas' }];
    expect(resolveAdvancedModules('off', withHours)).toBe(false);
    expect(resolveAdvancedModules('on', [])).toBe(true);
    expect(resolveAdvancedModules('', withHours)).toBe(true);
    expect(resolveAdvancedModules('', [])).toBe(false);
  });

  it('controle de horas é tela avançada', () => {
    expect(isAdvancedTab('controle-horas')).toBe(true);
    expect(isAdvancedTab('saidas')).toBe(false);
  });
});

describe('menu lateral', () => {
  it('Entradas acende Lançamentos e Importação acende Configurações', () => {
    expect(sidebarTabFor('entradas')).toBe('saidas');
    expect(sidebarTabFor('importacao')).toBe('configuracoes');
    expect(sidebarTabFor('orcamentos')).toBe('orcamentos');
  });
});
