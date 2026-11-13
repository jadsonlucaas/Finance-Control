import { describe, expect, it, vi } from 'vitest';
import { browserLocaleContext, suggestPreferences } from '../../src/core/userPreferences.js';
import { installSignupSuggestions } from '../../src/ui/auth/signupSuggestions.js';

describe('sugestao inicial de pais, idioma e fuso', () => {
  it('navegador em Manaus, em portugues: Brasil, pt-BR, BRL e fuso de Manaus', () => {
    expect(suggestPreferences({ languages: ['pt-BR'], timeZone: 'America/Manaus' }))
      .toEqual({ country: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Manaus' });
  });

  it('DDI do telefone vale mais que o navegador', () => {
    expect(suggestPreferences({ phone: '+34 637 21 02 15', languages: ['pt-BR'], timeZone: 'America/Sao_Paulo' }).country).toBe('ES');
    expect(suggestPreferences({ phone: '+351 912 345 678' }).country).toBe('PT');
    // Sem "+", o numero e local: nao da para saber o pais por ele.
    expect(suggestPreferences({ phone: '34 99999 0000', timeZone: 'America/Sao_Paulo' }).country).toBe('BR');
  });

  it('pais escolhido pela pessoa sempre vale; idioma e fuso continuam vindo do navegador', () => {
    expect(suggestPreferences({ country: 'BR', phone: '+34 600', languages: ['es-ES'], timeZone: 'Europe/Madrid' }))
      .toEqual({ country: 'BR', locale: 'es-ES', currency: 'BRL', time_zone: 'Europe/Madrid' });
  });

  it('fuso ou idioma fora da lista caem no padrao do pais', () => {
    expect(suggestPreferences({ languages: ['es'], timeZone: 'America/Mexico_City' }))
      .toEqual({ country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' });
    expect(suggestPreferences({ languages: ['en-US'], timeZone: 'UTC' }))
      .toEqual({ country: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo' });
    expect(suggestPreferences({ languages: ['pt-PT'] }).country).toBe('PT');
  });

  it('le o navegador sem quebrar quando faltam dados', () => {
    expect(browserLocaleContext({ navigator: { languages: ['es-ES', 'es'] } }).languages).toEqual(['es-ES', 'es']);
    expect(browserLocaleContext({ navigator: { language: 'pt-BR' } }).languages).toEqual(['pt-BR']);
    expect(browserLocaleContext({}).languages).toEqual([]);
  });
});

function fakeSignupPage() {
  const listeners = {};
  const country = { id: 'auth-country', value: 'BR' };
  const phone = { id: 'auth-phone', value: '' };
  const documentRef = {
    documentElement: { dataset: {} },
    getElementById: (id) => ({ 'auth-country': country, 'auth-phone': phone }[id] || null),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }
  };
  const fire = (type, target) => (listeners[type] || []).forEach((fn) => fn({ target }));
  return { documentRef, country, phone, fire };
}

describe('tela de cadastro', () => {
  it('pre-seleciona o pais pelo navegador e acompanha o DDI ate a pessoa escolher', () => {
    const page = fakeSignupPage();
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'Europe/Madrid' }) });
    installSignupSuggestions({ document: page.documentRef, navigator: { languages: ['es-ES'] } });
    spy.mockRestore();
    expect(page.country.value).toBe('ES');

    page.phone.value = '+55 11 99999-8888';
    page.fire('input', page.phone);
    expect(page.country.value).toBe('BR');

    page.country.value = 'PT';
    page.fire('change', page.country);
    page.phone.value = '+34 600 000 000';
    page.fire('input', page.phone);
    expect(page.country.value).toBe('PT');
  });
});
