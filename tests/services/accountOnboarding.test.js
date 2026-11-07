import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppPhone, validateSignupDetails } from '../../src/services/accountOnboarding.js';

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
