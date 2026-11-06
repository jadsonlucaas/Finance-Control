import { describe, expect, it, vi } from 'vitest';
import { createWhatsAppLinkController, STATUS_POLL_MS } from '../../src/ui/whatsapp/whatsappLinkController.js';
import { createWhatsAppLinkPresenter } from '../../src/ui/whatsapp/whatsappLinkPresenter.js';
import {
  formatLinkCode,
  generateLinkCode,
  hashLinkCode,
  LINK_CODE_ALPHABET,
  maskPhone
} from '../../src/services/whatsappLink.js';

function harness({ statuses = [{ linked: false }], createCode, revoke, confirmRevoke = () => true, uid = 'alice' } = {}) {
  let clock = Date.parse('2026-11-06T19:00:00Z');
  const timers = [];
  const queue = [...statuses];
  const service = {
    getStatus: vi.fn(async () => (queue.length > 1 ? queue.shift() : queue[0])),
    createCode: vi.fn(createCode || (async () => ({ code: 'K7QM3XPA', formatted: 'K7QM-3XPA', expiresAt: new Date(clock + 600_000) }))),
    cancelCode: vi.fn(async () => {}),
    revoke: vi.fn(revoke || (async () => ({ revoked: 1 })))
  };
  const presenter = { render: vi.fn() };
  const controller = createWhatsAppLinkController({
    service,
    presenter,
    uidProvider: () => uid,
    now: () => clock,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
    confirmRevoke
  });
  const runTimer = async () => {
    const timer = timers.shift();
    clock += timer.ms;
    await timer.fn();
  };
  const advance = (ms) => { clock += ms; };
  return { controller, service, presenter, timers, runTimer, advance };
}

describe('whatsapp link: codigo no Dashboard', () => {
  it('gera codigos de 8 caracteres sem caracteres ambiguos e sem vies', () => {
    const code = generateLinkCode();
    expect(code).toMatch(new RegExp(`^[${LINK_CODE_ALPHABET}]{8}$`));
    // Bytes acima do maior multiplo do alfabeto (248..255) sao descartados.
    const bytes = [255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7, 30];
    let call = 0;
    const fixed = generateLinkCode(() => (call++ === 0 ? Uint8Array.from(bytes) : new Uint8Array(16)));
    expect(fixed).toBe('23456789');
    expect(formatLinkCode('K7QM3XPA')).toBe('K7QM-3XPA');
  });

  it('o hash do Dashboard e o mesmo da whatsapp-api', async () => {
    const { hashLinkCode: serverHash } = await import('../../services/whatsapp-api/src/links.js');
    expect(await hashLinkCode('K7QM3XPA')).toBe(serverHash('K7QM3XPA'));
  });

  it('mascara o telefone', () => {
    expect(maskPhone('+34637210215')).toBe('+34 ••• ••• 215');
    expect(maskPhone('+5511900000002')).toBe('+55 ••• ••• 002');
    expect(maskPhone('')).toBe('');
  });
});

describe('whatsapp link: controller', () => {
  it('carrega desvinculado, gera codigo e detecta o vinculo pelo polling', async () => {
    const linked = { linked: true, maskedPhone: '+34 ••• ••• 215', phoneId: '+34637210215', linkedAt: new Date() };
    const { controller, service, runTimer, timers } = harness({ statuses: [{ linked: false }, { linked: false }, linked] });
    await controller.load();
    expect(controller.getState().view).toBe('unlinked');

    await controller.generateCode();
    expect(service.createCode).toHaveBeenCalledWith('alice');
    expect(controller.getState()).toMatchObject({ view: 'code', code: 'K7QM-3XPA' });
    expect(timers[0].ms).toBe(STATUS_POLL_MS);

    await runTimer();
    expect(controller.getState().view).toBe('code');
    await runTimer();
    expect(controller.getState()).toMatchObject({ view: 'linked', maskedPhone: '+34 ••• ••• 215' });
    expect(timers).toHaveLength(0);
  });

  it('para o polling quando o codigo expira', async () => {
    const { controller, runTimer, advance, timers } = harness();
    await controller.load();
    await controller.generateCode();
    advance(600_000);
    await runTimer();
    expect(controller.getState()).toMatchObject({ view: 'unlinked', notice: expect.stringContaining('expirou') });
    expect(timers).toHaveLength(0);
  });

  it('cancelar descarta o codigo pendente', async () => {
    const { controller, service } = harness();
    await controller.load();
    await controller.generateCode();
    await controller.cancelCode();
    expect(service.cancelCode).toHaveBeenCalledWith('alice');
    expect(controller.getState().view).toBe('unlinked');
  });

  it('desvincula so depois de confirmar', async () => {
    const linked = { linked: true, maskedPhone: '+34 ••• ••• 215' };
    let answer = false;
    const { controller, service } = harness({ statuses: [linked], confirmRevoke: () => answer });
    await controller.load();
    await controller.revoke();
    expect(service.revoke).not.toHaveBeenCalled();
    answer = true;
    await controller.revoke();
    expect(service.revoke).toHaveBeenCalledWith('alice');
    expect(controller.getState().view).toBe('unlinked');
  });

  it('mostra erro amigavel sem expor o codigo tecnico', async () => {
    const { controller } = harness({
      createCode: async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); }
    });
    await controller.load();
    await controller.generateCode();
    expect(controller.getState()).toMatchObject({ view: 'unlinked', error: expect.stringContaining('ativa') });
  });
});

describe('whatsapp link: presenter', () => {
  function fakeDocument() {
    const panel = { innerHTML: '' };
    return { panel, documentRef: { getElementById: (id) => (id === 'whatsapp-link-panel' ? panel : null) } };
  }

  it('renderiza cada estado com acoes acessiveis e escapa o conteudo', () => {
    const { panel, documentRef } = fakeDocument();
    const presenter = createWhatsAppLinkPresenter({ documentRef, botNumber: '+34 664 673 172' });

    presenter.render({ view: 'unlinked' });
    expect(panel.innerHTML).toContain('data-whatsapp-link-action="generate"');

    presenter.render({ view: 'code', code: 'K7QM-3XPA', expiresAt: new Date('2026-11-06T19:10:00Z') });
    expect(panel.innerHTML).toContain('K7QM-3XPA');
    expect(panel.innerHTML).toContain('https://wa.me/34664673172?text=K7QM-3XPA');
    expect(panel.innerHTML).toContain('data-whatsapp-link-action="cancel"');

    presenter.render({ view: 'linked', maskedPhone: '<b>+34</b>' });
    expect(panel.innerHTML).toContain('&lt;b&gt;+34&lt;/b&gt;');
    expect(panel.innerHTML).toContain('data-whatsapp-link-action="revoke"');

    presenter.render({ view: 'error', message: 'Falhou' });
    expect(panel.innerHTML).toContain('role="alert"');
  });

  it('sem numero do bot configurado nao mostra o atalho do WhatsApp', () => {
    const { panel, documentRef } = fakeDocument();
    createWhatsAppLinkPresenter({ documentRef }).render({ view: 'code', code: 'K7QM-3XPA', expiresAt: new Date() });
    expect(panel.innerHTML).not.toContain('wa.me');
  });
});
