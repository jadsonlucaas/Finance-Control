import { describe, expect, it, vi } from 'vitest';
import { billingErrorMessage, createBillingCheckoutService } from '../../src/services/billingCheckout.js';

describe('checkout pelo servidor (Dashboard)', () => {
  it('envia so a acao e o ID token, como requisicao simples', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ url: 'https://checkout.stripe.test/1' }) }));
    const service = createBillingCheckoutService({ endpoint: 'https://hook.test/billing', getIdToken: async () => 'tok', fetchImpl });
    expect(await service.startCheckout()).toEqual({ url: 'https://checkout.stripe.test/1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://hook.test/billing');
    expect(init.headers['content-type']).toMatch(/^text\/plain/);
    expect(JSON.parse(init.body)).toEqual({ acao: 'checkout', idToken: 'tok' });
  });

  it('traduz erros do servidor e fica desligado sem endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ erro: { codigo: 'ONBOARDING_REQUIRED' } }) }));
    const service = createBillingCheckoutService({ endpoint: 'https://hook.test/billing', getIdToken: async () => 'tok', fetchImpl });
    const error = await service.openPortal().catch((e) => e);
    expect(error.code).toBe('ONBOARDING_REQUIRED');
    expect(billingErrorMessage(error)).toMatch(/país e WhatsApp/);
    expect(createBillingCheckoutService({ getIdToken: async () => 'tok' }).enabled).toBe(false);
  });
});
