import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createAccountDeletionService, hashUid } from '../../../services/whatsapp-api/src/accountDeletion.js';
import { buildRecordsCsv, createDataExportService, toPlain } from '../../../services/whatsapp-api/src/dataExport.js';
import { createChatwootClient } from '../../../services/whatsapp-api/src/chatwoot.js';

const API_KEY = 'test-key-123';
const NOW = new Date('2026-11-14T12:00:00Z');
const NOW_S = Math.floor(NOW.getTime() / 1000);
const ALICE_PHONE = '+5511988887777';
const BOB_PHONE = '+34600111222';
const silent = { info() {}, warn() {}, error() {} };

const PROFILES = {
  'uid-alice': { uid: 'uid-alice', email: 'alice@example.com', role: 'user', status: 'active' },
  'uid-bob': { uid: 'uid-bob', email: 'bob@example.com', role: 'user', status: 'active' }
};
const TOKENS = {
  'token-alice': { uid: 'uid-alice', email: 'alice@example.com', auth_time: NOW_S - 60 },
  'token-bob': { uid: 'uid-bob', email: 'bob@example.com', auth_time: NOW_S - 60 }
};

function setup({ chatwoot = null } = {}) {
  const store = createMemoryStore(
    {
      'uid-alice': [
        { id: 'a1', type: 'saida', amount: 10.5, description: 'Almoço; "especial"', status: 'Pago', competence: '2026-11', category_name: 'Alimentação' },
        { id: 'a2', type: 'entrada', amount: 1000, description: 'Salário', status: 'Recebido', competence: '2026-11' }
      ],
      'uid-bob': [{ id: 'b1', type: 'saida', amount: 99, description: 'Segredo do Bob', competence: '2026-11' }]
    },
    { profiles: structuredClone(PROFILES) }
  );
  store._setOnboarding('uid-alice', { uid: 'uid-alice', name: 'Alice', country: 'BR', whatsapp_phone: ALICE_PHONE });
  store._setOnboarding('uid-bob', { uid: 'uid-bob', name: 'Bob', country: 'ES', whatsapp_phone: BOB_PHONE });
  store._putLink(ALICE_PHONE, { uid: 'uid-alice', telefone: ALICE_PHONE, status: 'active' });
  store._putLink(BOB_PHONE, { uid: 'uid-bob', telefone: BOB_PHONE, status: 'active' });
  store._setNotificationSettings('uid-alice', { uid: 'uid-alice', whatsapp_consent: 'granted' });

  const authUsers = new Map(Object.values(PROFILES).map((p) => [p.uid, { uid: p.uid, email: p.email }]));
  const notFound = () => Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
  const auth = {
    getUser: vi.fn(async (uid) => { if (!authUsers.has(uid)) throw notFound(); return authUsers.get(uid); }),
    deleteUser: vi.fn(async (uid) => { if (!authUsers.delete(uid)) throw notFound(); }),
    revokeRefreshTokens: vi.fn(async () => {})
  };
  const verifyIdToken = vi.fn(async (token) => {
    if (!TOKENS[token]) throw new Error('invalid');
    return TOKENS[token];
  });
  const accountDeletion = createAccountDeletionService({ store, verifyIdToken, auth, stripe: null, chatwoot, now: () => NOW, logger: silent });
  const dataExport = createDataExportService({ store, verifyIdToken, chatwoot, now: () => NOW, logger: silent });
  const app = createApp({ store, resolver: createPhoneResolver(new Map(), { store }), apiKey: API_KEY, accountDeletion, dataExport, logger: silent });
  const call = (body) => app.handle({ method: 'POST', path: '/internal/billing', headers: { authorization: `Bearer ${API_KEY}` }, body });
  return { store, call, authUsers };
}

function fakeChatwoot() {
  return {
    deleteContactsByPhones: vi.fn(async () => 1),
    exportByPhones: vi.fn(async (phones) => ({
      contatos: phones.map((telefone) => ({ nome: 'Contato', telefone })),
      conversas: [{ id: 7, mensagens: [{ de: 'voce', texto: `oi de ${phones[0]}`, em: NOW.toISOString() }] }],
      limite_atingido: false
    }))
  };
}

describe('exportacao de dados', () => {
  it('devolve so os dados da propria conta, com CSV e conversas do Chatwoot', async () => {
    const chatwoot = fakeChatwoot();
    const { call } = setup({ chatwoot });
    const res = await call({ acao: 'exportar_dados', idToken: 'token-alice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ formato: 'finance-control-export', versao: 1, conta: { uid: 'uid-alice', email: 'alice@example.com' } });
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('Segredo do Bob');
    expect(json).not.toContain('uid-bob');
    expect(json).not.toContain(BOB_PHONE);
    expect(res.body.secoes.dados_da_conta.finance_records.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
    expect(res.body.secoes.cadastro.name).toBe('Alice');
    expect(res.body.secoes.whatsapp.vinculos).toHaveLength(1);
    expect(chatwoot.exportByPhones).toHaveBeenCalledWith([ALICE_PHONE]);
    expect(res.body.secoes.conversas_whatsapp.situacao).toBe('ok');
    expect(res.body.lancamentos_csv.split('\r\n')[0]).toBe('id;tipo;descricao;valor;status;categoria;macro_categoria;competencia;vencimento;data;pago_em;pessoa;forma_pagamento;parcela;arquivado');
    expect(res.body.lancamentos_csv).toContain('"Almoço; ""especial"""');
    expect(res.body.lancamentos_csv).toContain(';10,50;');
  });

  it('sem token valido ou sem Chatwoot', async () => {
    const { call } = setup();
    expect((await call({ acao: 'exportar_dados' })).status).toBe(401);
    expect((await call({ acao: 'exportar_dados', idToken: 'falso' })).status).toBe(401);
    const res = await call({ acao: 'exportar_dados', idToken: 'token-bob', locale: 'es-ES' });
    expect(res.body.secoes.conversas_whatsapp).toEqual({ situacao: 'nao_configurado' });
    expect(res.body.lancamentos_csv.split('\r\n')[0]).toMatch(/^id;tipo;descripcion;importe;/);
    expect(res.body.lancamentos_csv).toContain(';gasto;');
  });

  it('Chatwoot fora do ar nao impede a exportacao', async () => {
    const chatwoot = { exportByPhones: vi.fn(async () => { throw new Error('down'); }) };
    const { call } = setup({ chatwoot });
    const res = await call({ acao: 'exportar_dados', idToken: 'token-alice' });
    expect(res.status).toBe(200);
    expect(res.body.secoes.conversas_whatsapp).toEqual({ situacao: 'indisponivel' });
  });

  it('limita a 3 exportacoes por 10 minutos por conta', async () => {
    const { call } = setup();
    for (let i = 0; i < 3; i += 1) expect((await call({ acao: 'exportar_dados', idToken: 'token-alice' })).status).toBe(200);
    const blocked = await call({ acao: 'exportar_dados', idToken: 'token-alice' });
    expect(blocked.status).toBe(429);
    expect((await call({ acao: 'exportar_dados', idToken: 'token-bob' })).status).toBe(200);
  });

  it('converte datas do Firestore', () => {
    expect(toPlain({ at: { toDate: () => NOW }, list: [new Date(NOW)] })).toEqual({ at: NOW.toISOString(), list: [NOW.toISOString()] });
    expect(buildRecordsCsv([{ id: 'x', type: 'outro' }]).split('\r\n')).toHaveLength(1);
  });
});

describe('exclusao de conta apaga o Chatwoot', () => {
  it('apaga os contatos com o telefone da conta e registra', async () => {
    const chatwoot = fakeChatwoot();
    const { call, store } = setup({ chatwoot });
    const res = await call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'alice@example.com' });
    expect(res.status).toBe(200);
    expect(chatwoot.deleteContactsByPhones).toHaveBeenCalledWith([ALICE_PHONE]);
    expect(store._accountDeletion(hashUid('uid-alice'))).toMatchObject({ chatwoot: 'ok', chatwoot_contacts_deleted: 1 });
    // Bob continua intacto.
    expect(await store.getUserProfile('uid-bob')).not.toBeNull();
  });

  it('falha no Chatwoot bloqueia a conta e nao apaga nada; nova tentativa conclui', async () => {
    const chatwoot = fakeChatwoot();
    chatwoot.deleteContactsByPhones.mockRejectedValueOnce(Object.assign(new Error('x'), { chatwoot: { status: 502 } }));
    const { call, store } = setup({ chatwoot });
    const first = await call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'alice@example.com' });
    expect(first.status).toBe(503);
    expect(first.body.erro.codigo).toBe('CHATWOOT_UNAVAILABLE');
    expect((await store.getUserProfile('uid-alice')).status).toBe('inactive');
    expect(store._hasUserData('uid-alice')).toBe(true);
    const second = await call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'alice@example.com' });
    expect(second.status).toBe(200);
    expect(store._hasUserData('uid-alice')).toBe(false);
  });

  it('sem Chatwoot configurado a exclusao segue e o registro diz isso', async () => {
    const { call, store } = setup();
    expect((await call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'alice@example.com' })).status).toBe(200);
    expect(store._accountDeletion(hashUid('uid-alice'))).toMatchObject({ chatwoot: 'nao_configurado' });
  });
});

describe('cliente do Chatwoot', () => {
  const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

  it('so existe com URL, conta numerica e token', () => {
    expect(createChatwootClient({ baseUrl: 'https://cw.test', accountId: '3', token: '' })).toBeNull();
    expect(createChatwootClient({ baseUrl: 'https://cw.test', accountId: 'abc', token: 't' })).toBeNull();
  });

  it('apaga so contatos com o telefone exato, usando o header com hifen', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (init.method === 'GET') return json({ payload: [{ id: 1, phone_number: '+5511988887777' }, { id: 2, phone_number: '+55119888877771' }] });
      return json({}, 200);
    });
    const client = createChatwootClient({ baseUrl: 'https://cw.test/', accountId: '3', token: 'tok', fetchImpl });
    expect(await client.deleteContactsByPhones(['+55 11 98888-7777'])).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://cw.test/api/v1/accounts/3/contacts/search?q=%2B5511988887777', expect.objectContaining({ headers: expect.objectContaining({ 'api-access-token': 'tok' }) }));
    expect(fetchImpl).toHaveBeenCalledWith('https://cw.test/api/v1/accounts/3/contacts/1', expect.objectContaining({ method: 'DELETE' }));
    expect(fetchImpl).not.toHaveBeenCalledWith('https://cw.test/api/v1/accounts/3/contacts/2', expect.anything());
  });

  it('exporta mensagens publicas paginando, sem notas privadas', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes('/contacts/search')) return json({ payload: [{ id: 1, name: 'Alice', phone_number: '+5511988887777' }] });
      if (url.endsWith('/contacts/1/conversations')) return json({ payload: [{ id: 9, status: 'open', created_at: NOW_S }] });
      if (url.endsWith('/conversations/9/messages')) {
        return json({ payload: [
          { id: 11, content: 'resposta', message_type: 1, created_at: NOW_S + 2 },
          { id: 12, content: 'nota interna', message_type: 1, private: true, created_at: NOW_S + 3 }
        ] });
      }
      if (url.endsWith('/conversations/9/messages?before=11')) return json({ payload: [{ id: 10, content: 'gastei 20', message_type: 0, created_at: NOW_S + 1 }] });
      return json({ payload: [] });
    });
    const client = createChatwootClient({ baseUrl: 'https://cw.test', accountId: '3', token: 'tok', fetchImpl });
    const result = await client.exportByPhones(['+5511988887777']);
    expect(result.contatos).toEqual([{ nome: 'Alice', telefone: '+5511988887777', email: '' }]);
    expect(result.conversas[0].mensagens.map((m) => [m.de, m.texto])).toEqual([['voce', 'gastei 20'], ['assistente', 'resposta']]);
  });
});
