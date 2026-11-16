import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFirestoreStore } from '../../services/whatsapp-api/src/firestoreStore.js';

/**
 * Etapa 5, item 2, contra o Firestore de verdade (emulador): as consultas por mes
 * inicial da whatsapp-api funcionam sem indice composto e devolvem o mesmo
 * conjunto que o store em memoria.
 */
const requireFromApi = createRequire(new URL('../../services/whatsapp-api/package.json', import.meta.url));
const { initializeApp, deleteApp } = requireFromApi('firebase-admin/app');
const { getFirestore } = requireFromApi('firebase-admin/firestore');

const PROJECT_ID = 'finance-control-whatsapp-api-recent-reads';
const UID = 'uid-alice';
let app;
let db;
let store;

const RECORDS = [
  { id: 'atual', type: 'saida', amount: 10, status: 'Pago', competence: '2026-11', due_date: '2026-11-05' },
  { id: 'antigo_pago', type: 'saida', amount: 20, status: 'Pago', competence: '2024-03', due_date: '2024-03-10' },
  { id: 'antigo_aberto', type: 'saida', amount: 30, status: 'Em aberto', competence: '2024-06', due_date: '2024-06-10' },
  { id: 'antigo_status_vazio', type: 'saida', amount: 35, status: '', competence: '2024-07' },
  { id: 'antiga_receita_pendente', type: 'entrada', amount: 40, status: 'Pendente', competence: '2023-01' },
  { id: 'sem_competencia', type: 'saida', amount: 50, status: 'Pago', competence: '', occurred_date: '2026-09-02' },
  { id: 'futura', type: 'saida', amount: 60, status: 'Pago', competence: '2027-02' },
  { id: 'categoria', type: 'categoria', category_name: 'Lazer', competence: '2026-11', status: '' }
];

async function clearEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
}

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT_ID }, 'whatsapp-api-recent-reads');
  db = getFirestore(app);
  store = createFirestoreStore(db);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(async () => {
  await clearEmulator();
  await Promise.all(RECORDS.map(({ id, ...data }) => db.doc(`users/${UID}/finance_records/${id}`).set(data)));
});

describe('whatsapp-api no Firestore: leitura a partir de um mes', () => {
  it('traz o periodo, futuros, sem competencia e contas em aberto antigas; nunca outros tipos', async () => {
    const ids = (await store.listFinanceRecords(UID, { from: '2026-09' })).map((record) => record.id).sort();
    expect(ids).toEqual(['antiga_receita_pendente', 'antigo_aberto', 'antigo_status_vazio', 'atual', 'futura', 'sem_competencia']);
  });

  it('sem from continua lendo todos os lancamentos', async () => {
    const ids = (await store.listFinanceRecords(UID)).map((record) => record.id).sort();
    expect(ids).toEqual(['antiga_receita_pendente', 'antigo_aberto', 'antigo_pago', 'antigo_status_vazio', 'atual', 'futura', 'sem_competencia']);
  });
});
