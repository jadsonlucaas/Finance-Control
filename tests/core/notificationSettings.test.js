import { describe, expect, it } from 'vitest';
import { isWhatsAppAlertAllowed, resolveNotificationSettings, validateNotificationPreferences } from '../../src/core/notificationSettings.js';

describe('preferencias de notificacao', () => {
  it('sem documento: tudo ligado, 3 dias, 9h e sem consentimento', () => {
    expect(resolveNotificationSettings(null)).toMatchObject({
      due_soon_enabled: true, due_soon_days: 3, overdue_enabled: true, budget_enabled: true, monthly_summary_enabled: true, send_hour: 9, whatsapp_consent: 'none'
    });
  });

  it('ignora valores fora do aceito', () => {
    expect(resolveNotificationSettings({ due_soon_days: 5, send_hour: 3, whatsapp_consent: 'sim', budget_enabled: 'nao' }))
      .toMatchObject({ due_soon_days: 3, send_hour: 9, whatsapp_consent: 'none', budget_enabled: true });
  });

  it('converte o horario do consentimento (Timestamp do Firestore) para ISO', () => {
    const at = { toDate: () => new Date('2026-11-14T10:00:00.000Z') };
    expect(resolveNotificationSettings({ whatsapp_consent_at: at }).whatsapp_consent_at).toBe('2026-11-14T10:00:00.000Z');
  });

  it('valida o formulario', () => {
    const ok = { due_soon_enabled: true, due_soon_days: 7, overdue_enabled: false, budget_enabled: true, monthly_summary_enabled: false, send_hour: 21 };
    expect(validateNotificationPreferences(ok)).toEqual({ ok: true, value: ok });
    expect(validateNotificationPreferences({ ...ok, send_hour: 22 }).ok).toBe(false);
    expect(validateNotificationPreferences({ ...ok, due_soon_days: 2 }).ok).toBe(false);
    expect(validateNotificationPreferences({ ...ok, budget_enabled: 1 }).ok).toBe(false);
  });

  it('WhatsApp so com consentimento e com o tipo ligado', () => {
    expect(isWhatsAppAlertAllowed(null, 'overdue')).toBe(false);
    expect(isWhatsAppAlertAllowed({ whatsapp_consent: 'granted' }, 'overdue')).toBe(true);
    expect(isWhatsAppAlertAllowed({ whatsapp_consent: 'granted', overdue_enabled: false }, 'overdue')).toBe(false);
    expect(isWhatsAppAlertAllowed({ whatsapp_consent: 'revoked' }, 'budget')).toBe(false);
    expect(isWhatsAppAlertAllowed({ whatsapp_consent: 'granted' }, 'outro')).toBe(false);
  });
});
