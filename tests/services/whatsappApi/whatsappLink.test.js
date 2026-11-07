import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import {
  hashLinkCode,
  MAX_LINK_FAILURES,
  normalizeLinkCode
} from '../../../services/whatsapp-api/src/links.js';

const API_KEY = 'test-key-123';
const ALICE = 'uid-alice';
const BOB = 'uid-bob';
const PHONE_A = '+34600000001';
const PHONE_B = '+5511900000002';
const ACCOUNT = 3;
const T0 = new Date('2026-11-06T19:00:00Z');

function setup({ legacy = '[]', profiles } = {}) {
  let clock = T0;
  const store = createMemoryStore({
    [ALICE]: [{ id: 'a1', type: 'saida', description: 'Mercado Alice', amount: 100, status: 'Pago', competence: '2026-11' }],
    [BOB]: [{ id: 'b1', type: 'saida', description: 'Segredo Bob', amount: 999, status: 'Pago', competence: '2026-11' }]
  }, {
    profiles: profiles || {
      [ALICE]: { uid: ALICE, status: 'active' },
      [BOB]: { uid: BOB, status: 'active' }
    }
  });
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const app = createApp({
    store,
    resolver: createPhoneResolver(parsePhoneLinks(legacy), { store }),
    apiKey: API_KEY,
    now: () => clock,
    logger
  });
  const call = (route, body) => app.handle({
    method: 'POST',
    path: `/internal/whatsapp/${route}`,
    headers: { 'x-api-key': API_KEY },
    body: { accountId: ACCOUNT, ...body }
  });
  // Simula o Dashboard: o usuario autenticado grava o hash do codigo com validade de 10 minutos.
  const issueCode = (uid, code, { minutes = 10, status = 'pending' } = {}) => {
    store._putLinkCode(hashLinkCode(normalizeLinkCode(code)), {
      owner_uid: uid,
      status,
      created_at: clock.toISOString(),
      expires_at: new Date(clock.getTime() + minutes * 60_000).toISOString()
    });
  };
  const advance = (ms) => { clock = new Date(clock.getTime() + ms); };
  return { store, call, issueCode, advance, logger };
}

describe('whatsapp-api: codigo de vinculo', () => {
  it('normaliza o codigo e recusa caracteres ambiguos', () => {
    expect(normalizeLinkCode(' k7qm-3xpa ')).toBe('K7QM3XPA');
    expect(normalizeLinkCode('K7QM 3XPA')).toBe('K7QM3XPA');
    expect(normalizeLinkCode('K7QM-3XP0')).toBe('');
    expect(normalizeLinkCode('K7QM-3XP')).toBe('');
    expect(normalizeLinkCode('')).toBe('');
  });

  it('vincula o telefone verificado ao dono do codigo e passa a resolver as consultas', async () => {
    const { store, call, issueCode } = setup();
    expect((await call('vinculo/status', { telefone: PHONE_A })).body).toEqual({ vinculado: false, motivo: 'PHONE_NOT_LINKED' });
    expect((await call('resumo', { telefone: PHONE_A })).status).toBe(403);

    issueCode(ALICE, 'K7QM3XPA');
    const linked = await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'k7qm-3xpa' });
    expect(linked.status).toBe(200);
    expect(linked.body).toEqual({ vinculado: true, ja_vinculado: false });
    expect(store._links()).toEqual([expect.objectContaining({ uid: ALICE, telefone: PHONE_A, status: 'active', chatwoot_account_id: '3' })]);
    expect(store._linkCode(hashLinkCode('K7QM3XPA')).status).toBe('used');
    expect(store._dump(ALICE).audit.map((entry) => entry.event_type)).toContain('whatsapp.link_created');

    expect((await call('vinculo/status', { telefone: PHONE_A })).body).toMatchObject({ vinculado: true });
    const list = await call('lancamentos', { telefone: PHONE_A });
    expect(list.body.lancamentos.map((item) => item.descricao)).toEqual(['Mercado Alice']);
  });

  it('nao aceita o mesmo codigo duas vezes', async () => {
    const { call, issueCode } = setup();
    issueCode(ALICE, 'K7QM3XPA');
    expect((await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' })).status).toBe(200);
    const again = await call('vinculo/confirmar', { telefone: PHONE_B, codigo: 'K7QM3XPA' });
    expect(again.status).toBe(400);
    expect(again.body.erro.codigo).toBe('LINK_CODE_INVALID');
  });

  it('recusa codigo expirado, desconhecido ou mal formatado com a mesma resposta', async () => {
    const { call, issueCode, advance } = setup();
    issueCode(ALICE, 'K7QM3XPA', { minutes: 10 });
    advance(10 * 60_000 + 1);
    for (const codigo of ['K7QM3XPA', 'ZZZZ2222', 'abc']) {
      const res = await call('vinculo/confirmar', { telefone: PHONE_A, codigo });
      expect(res.status).toBe(400);
      expect(res.body.erro.codigo).toBe('LINK_CODE_INVALID');
    }
  });

  it('bloqueia o telefone apos tentativas invalidas e libera depois da janela', async () => {
    const { call, issueCode, advance } = setup();
    for (let index = 0; index < MAX_LINK_FAILURES; index += 1) {
      expect((await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'ZZZZ2222' })).status).toBe(400);
    }
    issueCode(ALICE, 'K7QM3XPA');
    const blocked = await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.erro.codigo).toBe('LINK_TOO_MANY_ATTEMPTS');

    advance(60 * 60_000 + 1);
    issueCode(ALICE, 'K7QM3XPA');
    expect((await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' })).status).toBe(200);
  });

  it('nao deixa uma conta tomar o telefone ja vinculado a outra', async () => {
    const { store, call, issueCode } = setup();
    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });

    issueCode(BOB, 'B0BB2222'.replace('0', '9'));
    const taken = await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'B9BB2222' });
    expect(taken.status).toBe(409);
    expect(taken.body.erro.codigo).toBe('PHONE_LINKED_OTHER_ACCOUNT');
    expect(store._links()).toEqual([expect.objectContaining({ uid: ALICE, telefone: PHONE_A, status: 'active' })]);
    expect(store._linkCode(hashLinkCode('B9BB2222')).status).toBe('pending');

    const list = await call('lancamentos', { telefone: PHONE_A });
    expect(list.body.lancamentos.map((item) => item.descricao)).not.toContain('Segredo Bob');
  });

  it('reconfirmar o mesmo telefone na mesma conta e idempotente', async () => {
    const { store, call, issueCode } = setup();
    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    issueCode(ALICE, 'M4MA4444');
    const again = await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'M4MA4444' });
    expect(again.body).toEqual({ vinculado: true, ja_vinculado: true });
    expect(store._links()).toHaveLength(1);
  });

  it('vincular um telefone novo revoga o anterior da mesma conta', async () => {
    const { store, call, issueCode } = setup();
    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    issueCode(ALICE, 'M4MA4444');
    await call('vinculo/confirmar', { telefone: PHONE_B, codigo: 'M4MA4444' });
    const byPhone = Object.fromEntries(store._links().map((link) => [link.telefone, link]));
    expect(byPhone[PHONE_A]).toMatchObject({ status: 'revoked', revoked_by: 'relink' });
    expect(byPhone[PHONE_B]).toMatchObject({ status: 'active', uid: ALICE });
    expect((await call('resumo', { telefone: PHONE_A })).body.erro.codigo).toBe('PHONE_NOT_LINKED');
  });

  it('revogacao corta o acesso na proxima mensagem, inclusive confirmacoes pendentes', async () => {
    const { store, call, issueCode } = setup();
    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    const prepared = await call('acoes/preparar', { telefone: PHONE_A, acao: 'registrar_receita', dados: { descricao: 'Venda', valor: 10 } });
    expect(prepared.status).toBe(200);

    store._revokeLink(PHONE_A);
    expect((await call('vinculo/status', { telefone: PHONE_A })).body.vinculado).toBe(false);
    const confirm = await call('acoes/confirmar', { telefone: PHONE_A });
    expect(confirm.status).toBe(403);
    expect(confirm.body.erro.codigo).toBe('PHONE_NOT_LINKED');
    expect(store._dump(ALICE).records.map((record) => record.description)).not.toContain('Venda');
  });

  it('nao vincula nem atende conta inativa', async () => {
    const { store, call, issueCode } = setup({
      profiles: { [ALICE]: { uid: ALICE, status: 'pending' }, [BOB]: { uid: BOB, status: 'active' } }
    });
    issueCode(ALICE, 'K7QM3XPA');
    const res = await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    expect(res.status).toBe(403);
    expect(res.body.erro.codigo).toBe('ACCOUNT_NOT_ACTIVE');
    expect(store._links()).toEqual([]);

    store._setProfile(ALICE, { uid: ALICE, status: 'active' });
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    store._setProfile(ALICE, { uid: ALICE, status: 'inactive' });
    expect((await call('resumo', { telefone: PHONE_A })).body.erro.codigo).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('exige a mesma conta do Chatwoot usada no vinculo', async () => {
    const { call, issueCode } = setup();
    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    const other = await call('resumo', { telefone: PHONE_A, accountId: 9 });
    expect(other.status).toBe(403);
    expect(other.body.erro.codigo).toBe('ACCOUNT_MISMATCH');
  });

  it('o vinculo gravado tem prioridade sobre a reserva manual', async () => {
    const legacy = JSON.stringify([{ telefone: PHONE_A, uid: BOB, chatwootAccountId: '3' }]);
    const { call, issueCode } = setup({ legacy });
    let list = await call('lancamentos', { telefone: PHONE_A });
    expect(list.body.lancamentos.map((item) => item.descricao)).toEqual(['Segredo Bob']);

    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    list = await call('lancamentos', { telefone: PHONE_A });
    expect(list.body.lancamentos.map((item) => item.descricao)).toEqual(['Mercado Alice']);
  });

  it('valida telefone e conta e nao registra o codigo nos logs', async () => {
    const { call, issueCode, logger } = setup();
    expect((await call('vinculo/confirmar', { telefone: 'abc', codigo: 'K7QM3XPA' })).body.erro.codigo).toBe('INVALID_PHONE');
    expect((await call('vinculo/confirmar', { telefone: PHONE_A, accountId: 'x', codigo: 'K7QM3XPA' })).body.erro.codigo).toBe('INVALID_ACCOUNT');
    issueCode(ALICE, 'K7QM3XPA');
    await call('vinculo/confirmar', { telefone: PHONE_A, codigo: 'K7QM3XPA' });
    const logs = logger.info.mock.calls.map(([line]) => line).join('\n');
    expect(logs).not.toContain('K7QM3XPA');
    expect(logs).not.toContain('600000001');
  });
});
