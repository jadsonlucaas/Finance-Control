import { describe, expect, it } from 'vitest';
import {
  defaultPreferencesForCountry,
  normalizeWhatsAppPhone,
  resolveUserPreferences,
  SUPPORTED_TIME_ZONES,
  validatePreferences,
  validateSignupDetails
} from '../../src/services/accountOnboarding.js';

describe('cadastro: pais e WhatsApp', () => {
  it('completa o DDI do pais quando o usuario digita so o numero local', () => {
    expect(normalizeWhatsAppPhone('(11) 99999-8888', 'BR')).toBe('+5511999998888');
    expect(normalizeWhatsAppPhone('637 21 02 15', 'ES')).toBe('+34637210215');
    expect(normalizeWhatsAppPhone('+34 637 210 215', 'BR')).toBe('+34637210215');
    expect(normalizeWhatsAppPhone('5511999998888', 'BR')).toBe('+5511999998888');
    expect(normalizeWhatsAppPhone('123', 'BR')).toBe('');
  });

  it('valida nome, pais e telefone e devolve o formato gravado', () => {
    expect(validateSignupDetails({ name: ' Ana  Paula ', country: 'BR', phone: '11 99999-8888', consent: true }))
      .toEqual({ ok: true, value: { name: 'Ana Paula', country: 'BR', whatsapp_phone: '+5511999998888', whatsapp_consent: true } });
    expect(validateSignupDetails({ name: 'A', country: 'BR', phone: '11999998888' }).ok).toBe(false);
    expect(validateSignupDetails({ name: 'Ana', country: 'US', phone: '11999998888' }).error).toMatch(/país/);
    expect(validateSignupDetails({ name: 'Ana', country: 'BR', phone: '99' }).error).toMatch(/WhatsApp/);
  });
});

describe('perfil: idioma, moeda, pais e fuso', () => {
  it('conta antiga sem preferencias usa os padroes do pais', () => {
    expect(resolveUserPreferences({ country: 'BR' })).toEqual({ country: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo' });
    expect(resolveUserPreferences({ country: 'ES' })).toEqual({ country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' });
    expect(resolveUserPreferences({ country: 'PT' })).toEqual({ country: 'PT', locale: 'pt-BR', currency: 'EUR', time_zone: 'Europe/Lisbon' });
    expect(resolveUserPreferences(null)).toEqual({ country: 'BR', ...defaultPreferencesForCountry('BR') });
  });

  it('preferencias escolhidas sao independentes do pais; valores desconhecidos caem no padrao', () => {
    expect(resolveUserPreferences({ country: 'ES', locale: 'pt-BR', currency: 'BRL', time_zone: 'Atlantic/Canary' }))
      .toEqual({ country: 'ES', locale: 'pt-BR', currency: 'BRL', time_zone: 'Atlantic/Canary' });
    expect(resolveUserPreferences({ country: 'BR', locale: 'en-US', currency: 'USD', time_zone: 'Mars/Base' }))
      .toEqual({ country: 'BR', ...defaultPreferencesForCountry('BR') });
  });

  it('valida cada campo da preferencia', () => {
    const ok = { country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' };
    expect(validatePreferences(ok)).toEqual({ ok: true, value: ok });
    expect(validatePreferences({ ...ok, country: 'US' }).error).toMatch(/país/);
    expect(validatePreferences({ ...ok, locale: 'en' }).error).toMatch(/idioma/);
    expect(validatePreferences({ ...ok, currency: 'USD' }).error).toMatch(/moeda/);
    expect(validatePreferences({ ...ok, time_zone: 'UTC' }).error).toMatch(/fuso/);
  });

  it('todos os fusos aceitos existem no Intl', () => {
    for (const timeZone of SUPPORTED_TIME_ZONES) {
      expect(() => new Intl.DateTimeFormat('en', { timeZone })).not.toThrow();
    }
  });
});
