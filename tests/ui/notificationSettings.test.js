import { describe, expect, it, vi } from 'vitest';
import { installNotificationSettingsUi, renderNotificationSettingsPanel, WHATSAPP_CONSENT_TEXT } from '../../src/ui/account/notificationSettingsUi.js';
import { resolveNotificationSettings } from '../../src/core/notificationSettings.js';
import { ES_ES } from '../../src/i18n/es-ES.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeWindow() {
  const elements = new Map();
  const listeners = {};
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { id, value: '', checked: false, innerHTML: '' });
    return elements.get(id);
  };
  const target = {
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => element(id),
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }
    },
    financeApp: {},
    addEventListener() {}
  };
  const fire = (type, closest) => {
    const event = { target: { closest }, preventDefault: vi.fn() };
    (listeners[type] || []).forEach((fn) => fn(event));
  };
  return { target, element, fire };
}

describe('painel "Notificações"', () => {
  it('mostra os quatro alertas, antecedencia 1/3/7, horario 07-21 e o texto do consentimento', () => {
    const html = renderNotificationSettingsPanel({ settings: resolveNotificationSettings({ due_soon_days: 7, budget_enabled: false, send_hour: 20 }) });
    for (const key of ['due_soon_enabled', 'overdue_enabled', 'budget_enabled', 'monthly_summary_enabled']) expect(html).toContain(`id="notif-${key}"`);
    expect(html).toMatch(/id="notif-budget_enabled" name="budget_enabled" class="mt-0.5">/);
    expect(html).toContain('<option value="7" selected>7 dias antes</option>');
    expect(html).toContain('<option value="20" selected>20:00</option>');
    expect(html).toContain('<option value="7">07:00</option>');
    expect(html).not.toContain('06:00');
    expect(html).not.toContain('22:00');
    expect(html).toContain('data-notification-action="grant"');
    expect(html).toContain('Alertas no WhatsApp ainda não autorizados.');
  });

  it('com consentimento mostra a data e o botao de revogar', () => {
    const html = renderNotificationSettingsPanel({
      settings: resolveNotificationSettings({ whatsapp_consent: 'granted', whatsapp_consent_at: '2026-11-14T12:00:00.000Z' }),
      timeZone: 'America/Manaus'
    });
    expect(html).toContain('data-consent-status="granted"');
    expect(html).toMatch(/14\/11\/2026,? 08:00/);
    expect(html).toContain('data-notification-action="revoke"');
  });

  it('salva o formulario e concede/revoga pelo servico', async () => {
    const { target, element, fire } = fakeWindow();
    const service = {
      getMySettings: vi.fn(async () => resolveNotificationSettings(null)),
      savePreferences: vi.fn(async (_uid, draft) => resolveNotificationSettings(draft)),
      setWhatsAppConsent: vi.fn(async (_uid, granted) => resolveNotificationSettings({ whatsapp_consent: granted ? 'granted' : 'revoked' }))
    };
    const ui = installNotificationSettingsUi(target, { service, uidProvider: () => 'uid-1' });
    await flush();
    element('notif-due_soon_enabled').checked = true;
    element('notif-overdue_enabled').checked = false;
    element('notif-budget_enabled').checked = true;
    element('notif-monthly_summary_enabled').checked = true;
    element('notif-due_soon_days').value = '1';
    element('notif-send_hour').value = '8';
    fire('submit', (selector) => (selector === '[data-notification-settings-form]' ? {} : null));
    await flush();
    expect(service.savePreferences).toHaveBeenCalledWith('uid-1', {
      due_soon_enabled: true, overdue_enabled: false, budget_enabled: true, monthly_summary_enabled: true, due_soon_days: 1, send_hour: 8
    });
    expect(ui.getState().notice).toBe('Preferências salvas.');

    fire('click', () => ({ dataset: { notificationAction: 'grant' } }));
    await flush();
    expect(service.setWhatsAppConsent).toHaveBeenLastCalledWith('uid-1', true);
    expect(ui.getState().settings.whatsapp_consent).toBe('granted');
    fire('click', () => ({ dataset: { notificationAction: 'revoke' } }));
    await flush();
    expect(service.setWhatsAppConsent).toHaveBeenLastCalledWith('uid-1', false);
    expect(element('notification-settings-panel').innerHTML).toContain('data-notification-action="grant"');
  });

  it('erro ao salvar aparece sem quebrar o painel', async () => {
    const { target, fire } = fakeWindow();
    const service = {
      getMySettings: vi.fn(async () => resolveNotificationSettings(null)),
      savePreferences: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); }),
      setWhatsAppConsent: vi.fn()
    };
    const ui = installNotificationSettingsUi(target, { service, uidProvider: () => 'uid-1' });
    await flush();
    fire('submit', () => ({}));
    await flush();
    expect(ui.getState()).toMatchObject({ saving: false, error: 'Não foi possível salvar. Tente de novo em instantes.' });
  });

  it('tem traducao para espanhol do texto de consentimento', () => {
    expect(ES_ES.messages[WHATSAPP_CONSENT_TEXT]).toMatch(/^Autorizo el envío/);
  });
});
