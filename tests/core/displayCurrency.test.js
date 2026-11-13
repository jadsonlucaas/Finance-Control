import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currencySymbol,
  formatCompactCurrency,
  formatCurrency,
  getDisplayCurrency,
  setDisplayCurrency
} from '../../src/core/formatters.js';
import { installUserPreferencesRuntime, PREFERENCES_CHANGED_EVENT } from '../../src/services/userPreferencesRuntime.js';
import { getLocale, setLocale } from '../../src/core/i18n.js';

afterEach(async () => {
  setDisplayCurrency('BRL');
  await setLocale('pt-BR');
});

describe('moeda de exibicao', () => {
  it('BRL continua no formato de sempre', () => {
    expect(formatCurrency(1234.5)).toBe('R$ 1.234,50');
    expect(formatCurrency(-0.1)).toBe('R$ -0,10');
    expect(formatCompactCurrency(2500)).toBe('R$ 2,5 mil');
    expect(formatCompactCurrency(3200000)).toBe('R$ 3,2 mi');
    expect(currencySymbol()).toBe('R$');
  });

  it('EUR mostra o simbolo depois do valor, sem converter nada', () => {
    setDisplayCurrency('EUR');
    expect(formatCurrency(1234.5)).toBe('1.234,50 €');
    expect(formatCompactCurrency(2500)).toBe('2,5 mil €');
    expect(formatCompactCurrency(3200000)).toBe('3,2 M €');
    expect(formatCompactCurrency(950)).toBe('950 €');
    expect(currencySymbol()).toBe('€');
  });

  it('moeda desconhecida volta para BRL; da para forcar a moeda numa chamada', () => {
    expect(setDisplayCurrency('USD')).toBe('BRL');
    expect(formatCurrency(10, { currency: 'EUR' })).toBe('10,00 €');
  });
});

function fakeTarget(service) {
  const listeners = {};
  return {
    financeApp: {},
    accountOnboardingSdk: service,
    renderCurrentTab: vi.fn(),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    emit: (type, detail) => (listeners[type] || []).forEach((fn) => fn({ type, detail }))
  };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('preferencias aplicadas no app', () => {
  it('ao entrar, aplica a moeda do usuario e redesenha a aba', async () => {
    const target = fakeTarget({ getMyDetails: vi.fn(async () => ({ country: 'ES', whatsapp_phone: '+34637210215' })) });
    installUserPreferencesRuntime(target);
    target.emit('authStateChanged', { uid: 'u1' });
    await flush();
    expect(getDisplayCurrency()).toBe('EUR');
    expect(target.financeApp.userPreferences).toMatchObject({ country: 'ES', currency: 'EUR' });
    expect(target.renderCurrentTab).toHaveBeenCalledTimes(1);
    // O idioma (es-ES, pelo +34 do telefone cadastrado) chega depois do dicionario e redesenha de novo.
    expect(getLocale()).toBe('es-ES');
    await vi.waitFor(() => expect(target.renderCurrentTab).toHaveBeenCalledTimes(2));
  });

  it('salvar em Configuracoes reaplica; mesma moeda nao redesenha; sair volta para BRL', async () => {
    const target = fakeTarget({ getMyDetails: vi.fn(async () => ({ country: 'BR' })) });
    installUserPreferencesRuntime(target);
    target.emit('authStateChanged', { uid: 'u1' });
    await flush();
    expect(target.renderCurrentTab).not.toHaveBeenCalled();
    target.emit(PREFERENCES_CHANGED_EVENT, { country: 'BR', locale: 'pt-BR', currency: 'EUR', time_zone: 'America/Sao_Paulo' });
    expect(getDisplayCurrency()).toBe('EUR');
    expect(target.renderCurrentTab).toHaveBeenCalledTimes(1);
    target.emit(PREFERENCES_CHANGED_EVENT, { country: 'BR', locale: 'pt-BR', currency: 'EUR', time_zone: 'America/Sao_Paulo' });
    expect(target.renderCurrentTab).toHaveBeenCalledTimes(1);
    target.emit('authStateChanged', null);
    await flush();
    expect(getDisplayCurrency()).toBe('BRL');
  });

  it('erro ao ler as preferencias nao derruba nada: fica no padrao', async () => {
    const report = vi.fn();
    const target = fakeTarget({ getMyDetails: vi.fn(async () => { throw new Error('offline'); }) });
    target.financeApp.resilience = { errorReporter: { report } };
    installUserPreferencesRuntime(target);
    target.emit('authStateChanged', { uid: 'u1' });
    await flush();
    expect(getDisplayCurrency()).toBe('BRL');
    expect(report).toHaveBeenCalled();
  });
});
