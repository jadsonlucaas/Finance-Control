import { describe, expect, it, vi } from 'vitest';
import {
  createPlanChooserModel,
  priceLabel,
  readCheckoutReturn,
  renderPlanChooser,
  stripCheckoutReturn
} from '../../src/ui/billing/planChooserModel.js';
import { validateSignupDetails } from '../../src/services/accountOnboarding.js';

const DETAILS = { name: 'Luana', country: 'BR', whatsapp_phone: '+5592981327903', whatsapp_consent: true };

function harness({ details = DETAILS, checkout = async () => ({ url: 'https://checkout.stripe.test/1' }), form = {} } = {}) {
  const renders = [];
  // Como no navegador: cada render recria os campos vazios.
  let liveForm = { ...form };
  const navigate = vi.fn();
  const onboarding = {
    getMyDetails: vi.fn(async () => details),
    saveSignupDetails: vi.fn(async (uid, value) => ({ uid, ...value }))
  };
  const billing = { enabled: true, startCheckout: vi.fn(checkout), errorMessage: () => 'Falhou.' };
  const model = createPlanChooserModel({
    onboarding,
    billing,
    validate: validateSignupDetails,
    getUid: () => 'uid-luana',
    navigate,
    render: (state) => { renders.push(state); liveForm = {}; },
    readForm: () => liveForm
  });
  return { model, onboarding, billing, navigate, renders, last: () => renders.at(-1), type: (value = form) => { liveForm = { ...value }; } };
}

describe('escolha de plano', () => {
  it('mostra Gratuito e Premium com o preco do pais', async () => {
    const { model, last } = harness();
    await model.open();
    const html = renderPlanChooser(last());
    expect(html).toContain('Continuar no Gratuito');
    expect(html).toContain('Testar 7 dias grátis');
    expect(html).toContain('R$ 24,90/mês');
    expect(html).not.toContain('data-plan-details-form');
    expect(priceLabel('PT')).toBe('€ 5,90/mês');
  });

  it('Premium leva direto ao checkout do Stripe quando o cadastro esta completo', async () => {
    const { model, navigate, onboarding } = harness();
    await model.open();
    await model.choosePremium();
    expect(onboarding.saveSignupDetails).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://checkout.stripe.test/1');
  });

  it('conta sem pais/WhatsApp completa os dados no proprio modal antes do checkout', async () => {
    const { model, navigate, onboarding, last, type } = harness({
      details: null,
      form: { name: 'Luana', country: 'BR', phone: '92 98132-7903', consent: true }
    });
    await model.open();
    expect(renderPlanChooser(last())).toContain('data-plan-details-form');
    type(); // usuario digita depois que o modal abriu
    await model.choosePremium();
    expect(onboarding.saveSignupDetails).toHaveBeenCalledWith('uid-luana', expect.objectContaining({ country: 'BR', whatsapp_phone: '+5592981327903' }));
    expect(navigate).toHaveBeenCalled();
  });

  it('dados invalidos nao abrem o checkout', async () => {
    const { model, navigate, billing, last, type } = harness({ details: null, form: { name: 'Lu', country: 'BR', phone: '12' } });
    await model.open();
    type();
    await model.choosePremium();
    expect(billing.startCheckout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(last().error).toMatch(/telefone/);
    // O que foi digitado continua nos campos depois do erro.
    expect(renderPlanChooser(last())).toContain('value="Lu"');
  });

  it('quem ja assina ve o aviso em vez de outro checkout; erro do servidor aparece no modal', async () => {
    const already = harness({ checkout: async () => ({ jaAssinante: true }) });
    await already.model.open();
    await already.model.choosePremium();
    expect(already.last().mode).toBe('already');
    expect(already.navigate).not.toHaveBeenCalled();

    const failing = harness({ checkout: async () => { throw Object.assign(new Error('x'), { code: 'HTTP_500' }); } });
    await failing.model.open();
    await failing.model.choosePremium();
    expect(failing.last()).toMatchObject({ pending: false, error: 'Falhou.' });
  });

  it('Gratuito so fecha', async () => {
    const { model, billing, last } = harness();
    await model.open();
    model.chooseFree();
    expect(last().open).toBe(false);
    expect(billing.startCheckout).not.toHaveBeenCalled();
  });

  it('espera o cadastro terminar de gravar antes de ler os dados', async () => {
    let finish;
    const signup = new Promise((resolve) => { finish = resolve; });
    const { model, onboarding } = harness();
    const opening = model.open({ waitFor: signup });
    expect(onboarding.getMyDetails).not.toHaveBeenCalled();
    finish();
    await opening;
    expect(onboarding.getMyDetails).toHaveBeenCalled();
  });

  it('volta do Stripe: le e limpa ?assinatura', () => {
    expect(readCheckoutReturn('?assinatura=sucesso')).toBe('sucesso');
    expect(readCheckoutReturn('?assinatura=outra')).toBe('');
    expect(stripCheckoutReturn('https://app.test/?assinatura=sucesso#/configuracoes')).toBe('/#/configuracoes');
    expect(renderPlanChooser({ open: true, mode: 'success' })).toContain('Vincular meu WhatsApp');
    expect(renderPlanChooser({ open: true, mode: 'canceled' })).toContain('Nada foi cobrado');
  });
});
