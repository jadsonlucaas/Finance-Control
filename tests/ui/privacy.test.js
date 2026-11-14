import { describe, expect, it, vi } from 'vitest';
import { installPrivacyUi, renderPrivacyPanel } from '../../src/ui/account/privacyUi.js';
import { installLegalConsentGate, renderLegalConsentGate } from '../../src/ui/legal/legalConsentGate.js';
import { PRIVACY_VERSION, resolveLegalConsent, TERMS_VERSION } from '../../src/core/legalConsent.js';
import { ES_ES } from '../../src/i18n/es-ES.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const current = (extra = {}) => resolveLegalConsent({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, accepted_at: '2026-11-14T12:00:00.000Z', source: 'signup', ...extra });

function fakeWindow() {
  const elements = new Map();
  const listeners = {};
  const windowListeners = {};
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { id, innerHTML: '', remove() { elements.delete(id); }, querySelector: () => null });
    return elements.get(id);
  };
  const target = {
    document: {
      documentElement: { dataset: {} },
      body: { appendChild: (node) => elements.set(node.id, node) },
      createElement: () => ({ id: '', innerHTML: '', remove() { elements.delete(this.id); }, querySelector: () => null }),
      getElementById: (id) => elements.get(id) || (id === 'privacy-panel' ? element(id) : null),
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }
    },
    financeApp: {},
    addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); },
    dispatchEvent: vi.fn()
  };
  const click = (closestAction, attr) => {
    const event = { target: { closest: (selector) => (selector === attr ? { dataset: closestAction } : null) } };
    (listeners.click || []).forEach((fn) => fn(event));
  };
  const emit = (type, detail) => (windowListeners[type] || []).forEach((fn) => fn({ detail }));
  return { target, elements, click, emit };
}

describe('painel "Privacidade e dados"', () => {
  it('mostra documentos aceitos com data, historico e autorizacoes', () => {
    const html = renderPrivacyPanel({
      consent: current(),
      history: [{ at: '2026-11-14T12:00:00.000Z', source: 'signup', terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION }],
      alertsConsent: 'granted',
      signupConsent: true,
      timeZone: 'America/Manaus'
    });
    expect(html).toContain('data-legal-status="current"');
    expect(html).toMatch(/Aceitos em 14\/11\/2026,? 08:00\./);
    expect(html).toContain('Histórico de aceites');
    expect(html).toContain('data-privacy-alerts="granted"');
    expect(html).toContain('Aceitas no cadastro');
    expect(html).not.toContain('data-privacy-action="accept"');
    expect(html).not.toContain('data-privacy-action="export"');
  });

  it('versao antiga pede novo aceite; exportar aparece quando o servico existe', () => {
    const html = renderPrivacyPanel({ consent: resolveLegalConsent({ terms_version: 'termos-antigo', privacy_version: PRIVACY_VERSION }), exportEnabled: true });
    expect(html).toContain('Há uma nova versão para aceitar.');
    expect(html).toContain('data-privacy-action="accept"');
    expect(html).toContain('data-privacy-action="export"');
  });

  it('carrega e registra novo aceite pelo servico', async () => {
    const { target, elements, click } = fakeWindow();
    target.authSdk = { getCurrentUser: () => ({ uid: 'alice' }) };
    const legalService = {
      getMyConsent: vi.fn(async () => resolveLegalConsent(null)),
      listMyHistory: vi.fn(async () => []),
      accept: vi.fn(async () => current({ source: 'dashboard' }))
    };
    installPrivacyUi(target, { legalService, notificationService: { getMySettings: async () => ({ whatsapp_consent: 'revoked' }) }, onboardingService: { getMyDetails: async () => null } });
    await flush();
    expect(elements.get('privacy-panel').innerHTML).toContain('Ainda não aceitos nesta conta.');
    expect(elements.get('privacy-panel').innerHTML).toContain('data-privacy-alerts="revoked"');
    click({ privacyAction: 'accept' }, '[data-privacy-action]');
    await flush();
    expect(legalService.accept).toHaveBeenCalledWith('alice', expect.objectContaining({ source: 'dashboard' }));
    expect(elements.get('privacy-panel').innerHTML).toContain('Aceite registrado.');
  });

  it('textos traduzidos para espanhol', () => {
    expect(ES_ES.messages['Privacidade e dados']).toBe('Privacidad y datos');
    expect(ES_ES.messages['Aceite os Termos de Uso e a Política de Privacidade para criar a conta.']).toMatch(/^Acepta/);
  });
});

describe('aviso de aceite ao entrar', () => {
  it('abre sem aceite, fecha ao aceitar e nao abre com versao atual', async () => {
    const { target, elements, click, emit } = fakeWindow();
    const service = { getMyConsent: vi.fn(async () => resolveLegalConsent(null)), accept: vi.fn(async () => current()) };
    const gate = installLegalConsentGate(target, { service });
    emit('financeAccessActive', { uid: 'alice' });
    await flush();
    expect(gate.getState().open).toBe(true);
    expect(gate.getState().updated).toBe(false);
    expect(elements.get('legal-consent-gate').innerHTML).toContain('Para continuar, leia e aceite');
    click({ legalAction: 'accept' }, '[data-legal-action]');
    await flush();
    expect(service.accept).toHaveBeenCalledWith('alice', expect.objectContaining({ source: 'dashboard' }));
    expect(gate.getState().open).toBe(false);
    expect(elements.has('legal-consent-gate')).toBe(false);

    service.getMyConsent.mockResolvedValue(current());
    emit('financeAccessActive', { uid: 'alice' });
    await flush();
    expect(gate.getState().open).toBe(false);
  });

  it('versao antiga mostra "Atualizamos"; falha de leitura nao bloqueia o app', async () => {
    expect(renderLegalConsentGate({ updated: true })).toContain('Atualizamos os Termos');
    const { target, emit } = fakeWindow();
    const gate = installLegalConsentGate(target, { service: { getMyConsent: vi.fn(async () => { throw new Error('offline'); }) } });
    emit('financeAccessActive', { uid: 'alice' });
    await flush();
    expect(gate.getState().open).toBe(false);
  });
});
