import { describe, expect, it } from 'vitest';
import {
  defaultPreferencesForCountry,
  normalizeWhatsAppPhone,
  resolveUserPreferences,
  SUPPORTED_TIME_ZONES,
  validatePreferences,
  validateSignupDetails
} from '../../src/services/accountOnboarding.js';
import { localeForPhone } from '../../src/core/userPreferences.js';

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
  it('conta antiga sem preferencias usa os padroes do pais; idioma pelo telefone', () => {
    expect(resolveUserPreferences({ country: 'BR', whatsapp_phone: '+5592981327903' })).toEqual({ country: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo' });
    expect(resolveUserPreferences({ country: 'ES', whatsapp_phone: '+34637210215' })).toEqual({ country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' });
    expect(resolveUserPreferences({ country: 'PT', whatsapp_phone: '+351912345678' })).toEqual({ country: 'PT', locale: 'pt-BR', currency: 'EUR', time_zone: 'Europe/Lisbon' });
    expect(resolveUserPreferences(null)).toEqual({ country: 'BR', ...defaultPreferencesForCountry('BR') });
  });

  it('preferencias escolhidas sao independentes do pais; valores desconhecidos caem no padrao', () => {
    expect(resolveUserPreferences({ country: 'ES', whatsapp_phone: '+34637210215', currency: 'BRL', time_zone: 'Atlantic/Canary' }))
      .toEqual({ country: 'ES', locale: 'es-ES', currency: 'BRL', time_zone: 'Atlantic/Canary' });
    expect(resolveUserPreferences({ country: 'BR', locale: 'en-US', currency: 'USD', time_zone: 'Mars/Base' }))
      .toEqual({ country: 'BR', ...defaultPreferencesForCountry('BR') });
  });

  it('idioma vem so do DDI do telefone cadastrado, nunca de uma escolha salva', () => {
    expect(localeForPhone('+34 637 210 215')).toBe('es-ES');
    expect(localeForPhone('34637210215')).toBe('es-ES');
    expect(localeForPhone('+55 92 98132-7903')).toBe('pt-BR');
    expect(localeForPhone('+351 912 345 678')).toBe('pt-BR');
    expect(localeForPhone('+1 555 0100')).toBe('pt-BR');
    expect(localeForPhone('')).toBe('pt-BR');
    // locale salvo antigo e ignorado; o telefone manda.
    expect(resolveUserPreferences({ country: 'BR', locale: 'es-ES', whatsapp_phone: '+5592981327903' }).locale).toBe('pt-BR');
    expect(resolveUserPreferences({ country: 'BR', locale: 'pt-BR', whatsapp_phone: '+34637210215' }).locale).toBe('es-ES');
    // Sem telefone na conta, usa o numero alternativo (ex.: o da conversa no WhatsApp).
    expect(resolveUserPreferences(null, { fallbackPhone: '+34637210215' }).locale).toBe('es-ES');
    expect(resolveUserPreferences({ whatsapp_phone: '+5511999998888' }, { fallbackPhone: '+34637210215' }).locale).toBe('pt-BR');
  });

  it('valida cada campo da preferencia (idioma nao e campo)', () => {
    const ok = { country: 'ES', currency: 'EUR', time_zone: 'Europe/Madrid' };
    expect(validatePreferences(ok)).toEqual({ ok: true, value: ok });
    expect(validatePreferences({ ...ok, locale: 'pt-BR' })).toEqual({ ok: true, value: ok });
    expect(validatePreferences({ ...ok, country: 'US' }).error).toMatch(/país/);
    expect(validatePreferences({ ...ok, currency: 'USD' }).error).toMatch(/moeda/);
    expect(validatePreferences({ ...ok, time_zone: 'UTC' }).error).toMatch(/fuso/);
  });

  it('todos os fusos aceitos existem no Intl', () => {
    for (const timeZone of SUPPORTED_TIME_ZONES) {
      expect(() => new Intl.DateTimeFormat('en', { timeZone })).not.toThrow();
    }
  });
});
