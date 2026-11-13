import { describe, expect, it, vi } from 'vitest';

const setDoc = vi.fn(async () => {});
vi.mock('firebase/firestore', () => ({
  doc: (db, collection, id) => ({ path: `${collection}/${id}` }),
  getDoc: vi.fn(),
  setDoc: (...args) => setDoc(...args)
}));

const { createAccountOnboardingService, validateSignupDetails } = await import('../../src/services/accountOnboarding.js');

describe('cadastro grava pais e WhatsApp', () => {
  it('aceita o resultado ja validado do formulario (bug: o cadastro nao gravava)', async () => {
    const service = createAccountOnboardingService({}, { now: () => '2026-11-07T15:00:00.000Z' });
    const checked = validateSignupDetails({ name: 'Luana Raulino', country: 'BR', phone: '+5592981327903', consent: true });
    const saved = await service.saveSignupDetails('uid-1', checked.value);
    expect(saved).toMatchObject({ uid: 'uid-1', country: 'BR', whatsapp_phone: '+5592981327903', whatsapp_consent: true, consent_at: '2026-11-07T15:00:00.000Z' });
    expect(setDoc).toHaveBeenCalledWith({ path: 'user_onboarding/uid-1' }, saved, { merge: true });
  });

  it('tambem aceita os campos crus do formulario', async () => {
    const service = createAccountOnboardingService({});
    const saved = await service.saveSignupDetails('uid-2', { name: 'Ana', country: 'ES', phone: '637 21 02 15', consent: false });
    expect(saved).toMatchObject({ whatsapp_phone: '+34637210215', whatsapp_consent: false });
    expect(saved.consent_at).toBeUndefined();
  });

  it('grava idioma/moeda/fuso sugeridos no cadastro e ignora valores fora da lista', async () => {
    const service = createAccountOnboardingService({});
    const checked = validateSignupDetails({ name: 'Ana', country: 'BR', phone: '92 98132-7903', consent: true });
    const saved = await service.saveSignupDetails('uid-3', { locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Manaus', ...checked.value });
    expect(saved).toMatchObject({ country: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Manaus' });
    const ignored = await service.saveSignupDetails('uid-4', { ...checked.value, locale: 'en-US', time_zone: 'UTC' });
    expect(ignored).not.toHaveProperty('locale');
    expect(ignored).not.toHaveProperty('time_zone');
  });
});
