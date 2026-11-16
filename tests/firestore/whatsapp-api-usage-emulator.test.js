import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFirestoreStore } from '../../services/whatsapp-api/src/firestoreStore.js';
import { saveUsage } from '../../services/whatsapp-api/src/usage.js';

/** Etapa 5, item 3, no Firestore de verdade: incrementos concorrentes do consumo por cliente. */
const requireFromApi = createRequire(new URL('../../services/whatsapp-api/package.json', import.meta.url));
const { initializeApp, deleteApp } = requireFromApi('firebase-admin/app');
const { getFirestore } = requireFromApi('firebase-admin/firestore');

const PROJECT_ID = 'finance-control-whatsapp-api-usage';
const UID = 'uid-alice';
const NOW = new Date('2026-11-16T15:00:00Z');
let app;
let db;
let store;

async function clearEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
}

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT_ID }, 'whatsapp-api-usage');
  db = getFirestore(app);
  store = createFirestoreStore(db);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(clearEmulator);

describe('whatsapp-api no Firestore: consumo por cliente', () => {
  it('soma chamadas simultaneas sem perder nenhuma', async () => {
    const call = (route) => ({ messages: 0, tool_calls: 1, writes: 0, records_read: 3, routes: { [route]: 1 } });
    await Promise.all([
      saveUsage(store, UID, { messages: 1, tool_calls: 0, writes: 0, records_read: 0, routes: {} }, { now: NOW }),
      ...Array.from({ length: 8 }, () => saveUsage(store, UID, call('resumo'), { now: NOW })),
      saveUsage(store, UID, call('orcamento/definir'), { now: NOW })
    ]);
    const usage = await store.getUsage(UID, '2026-11');
    expect(usage).toMatchObject({ uid: UID, month: '2026-11', messages: 1, tool_calls: 9, records_read: 27 });
    expect(usage.by_route).toEqual({ resumo: 8, orcamento_definir: 1 });
    expect(usage.by_day['16']).toEqual({ messages: 1, tool_calls: 9, records_read: 27 });
  });

  it('fica dentro de users/{uid}: entra na exportacao e sai na exclusao da conta', async () => {
    await saveUsage(store, UID, { messages: 1, tool_calls: 1, writes: 0, records_read: 1, routes: { resumo: 1 } }, { now: NOW });
    const exported = await store.exportAccountData(UID);
    expect(exported.dados_da_conta.usage.map((item) => item.id)).toEqual(['2026-11']);
    await store.purgeAccountData(UID, {});
    expect(await store.getUsage(UID, '2026-11')).toBeNull();
  });
});
