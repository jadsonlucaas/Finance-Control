import { describe, expect, it, vi } from 'vitest';
import {
  installUserPreferencesUi,
  PREFERENCES_CHANGED_EVENT,
  renderUserPreferencesPanel
} from '../../src/ui/account/userPreferencesUi.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// DOM minimo: o projeto nao usa jsdom nos testes de UI.
function fakeWindow() {
  const elements = new Map();
  const listeners = {};
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { id, value: '', innerHTML: '' });
    return elements.get(id);
  };
  const documentRef = {
    documentElement: { dataset: {} },
    getElementById: (id) => element(id),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }
  };
  const windowListeners = {};
  const target = {
    document: documentRef,
    financeApp: {},
    addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); },
    dispatchEvent: (event) => (windowListeners[event.type] || []).forEach((fn) => fn(event)),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  };
  const submit = () => {
    const event = { target: { closest: (selector) => (selector === '[data-user-preferences-form]' ? {} : null) }, preventDefault: vi.fn() };
    (listeners.submit || []).forEach((fn) => fn(event));
    return event;
  };
  return { target, element, submit };
}

function setup(service) {
  const fake = fakeWindow();
  const ui = installUserPreferencesUi(fake.target, { service, uidProvider: () => 'uid-1' });
  return { ...fake, ui, panel: () => fake.element('user-preferences-panel').innerHTML };
}

describe('painel "Idioma, moeda e região"', () => {
  it('mostra os quatro campos com a preferencia atual marcada e escapa mensagens', () => {
    const html = renderUserPreferencesPanel({
      preferences: { country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Atlantic/Canary' },
      error: '<b>x</b>'
    });
    for (const id of ['user-pref-country', 'user-pref-locale', 'user-pref-currency', 'user-pref-time-zone']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('<option value="ES" selected>');
    expect(html).toContain('data-locale="es-ES"');
    expect(html).not.toContain('name="locale"');
    expect(html).toContain('O idioma segue o número de WhatsApp vinculado');
    expect(html).toContain('<option value="EUR" selected>');
    expect(html).toContain('<option value="Atlantic/Canary" selected>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('carregando mostra skeleton; sem cadastro mostra aviso e nao mostra o formulario', () => {
    expect(renderUserPreferencesPanel({ loading: true })).toContain('aria-busy="true"');
    const html = renderUserPreferencesPanel({ needsSignup: true });
    expect(html).toContain('Complete seu cadastro');
    expect(html).not.toContain('data-user-preferences-form');
  });

  it('conta antiga sem preferencias abre com os padroes do pais e publica as preferencias', async () => {
    const service = { getMyDetails: vi.fn(async () => ({ country: 'ES', whatsapp_phone: '+34637210215' })), saveMyPreferences: vi.fn() };
    const { target, panel } = setup(service);
    const listener = vi.fn();
    target.addEventListener(PREFERENCES_CHANGED_EVENT, listener);
    await flush();
    expect(panel()).toContain('data-locale="es-ES"');
    expect(panel()).toContain('<option value="Europe/Madrid" selected>');
    const expected = { country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' };
    expect(target.financeApp.userPreferences).toEqual(expected);
    expect(service.getMyDetails).toHaveBeenCalledWith('uid-1');
  });

  it('salva o que foi escolhido, cada campo independente', async () => {
    const draft = { country: 'BR', currency: 'EUR', time_zone: 'America/Manaus' };
    const saved = { ...draft, locale: 'pt-BR' };
    const service = { getMyDetails: vi.fn(async () => ({ country: 'BR' })), saveMyPreferences: vi.fn(async () => saved) };
    const { target, element, submit, panel } = setup(service);
    const listener = vi.fn();
    target.addEventListener(PREFERENCES_CHANGED_EVENT, listener);
    await flush();
    element('user-pref-country').value = 'BR';
    element('user-pref-currency').value = 'EUR';
    element('user-pref-time-zone').value = 'America/Manaus';
    const event = submit();
    expect(event.preventDefault).toHaveBeenCalled();
    await flush();
    expect(service.saveMyPreferences).toHaveBeenCalledWith('uid-1', draft);
    expect(panel()).toContain('Preferências salvas.');
    expect(target.financeApp.userPreferences).toEqual(saved);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ detail: saved }));
  });

  it('erro ao salvar aparece no painel e mantem a escolha do usuario', async () => {
    const service = {
      getMyDetails: vi.fn(async () => ({ country: 'BR' })),
      saveMyPreferences: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'unavailable' }); })
    };
    const { element, submit, panel } = setup(service);
    await flush();
    element('user-pref-country').value = 'BR';
    element('user-pref-currency').value = 'EUR';
    element('user-pref-time-zone').value = 'America/Sao_Paulo';
    submit();
    await flush();
    expect(panel()).toContain('role="alert"');
    expect(panel()).toContain('Sem conexão');
    expect(panel()).toContain('<option value="EUR" selected>');
  });

  it('conta sem cadastro: aviso em vez do formulario', async () => {
    const { panel } = setup({ getMyDetails: vi.fn(async () => null), saveMyPreferences: vi.fn() });
    await flush();
    expect(panel()).toContain('Complete seu cadastro');
    expect(panel()).not.toContain('data-user-preferences-form');
  });
});
