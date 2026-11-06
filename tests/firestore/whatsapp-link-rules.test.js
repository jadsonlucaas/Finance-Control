import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createWhatsAppLinkService, hashLinkCode } from '../../src/services/whatsappLink.js';

const PROJECT_ID = 'finance-control-whatsapp-link-test';
const NOW = '2026-11-06T00:00:00.000Z';
const ALICE = 'alice';
const BOB = 'bob';
const PENDING = 'pending-user';
const PHONE_A = '+34600000001';
const PHONE_B = '+5511900000002';

let testEnv;

function profile(uid, status = 'active') {
  return { uid, email: `${uid}@example.test`, role: 'user', status, created_at: NOW, updated_at: NOW };
}

function dbFor(uid) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

function serviceFor(uid) {
  return createWhatsAppLinkService(dbFor(uid), { subtle: webcrypto.subtle });
}

function minutesFromNow(minutes) {
  return Timestamp.fromMillis(Date.now() + minutes * 60_000);
}

function codeData(uid, overrides = {}) {
  return { owner_uid: uid, status: 'pending', created_at: serverTimestamp(), expires_at: minutesFromNow(10), ...overrides };
}

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (context) => fn(context.firestore()));
}

// Simula a whatsapp-api (Admin SDK): grava o vinculo sem passar pelas regras.
async function seedLink(phone, uid, status = 'active') {
  await seed((db) => setDoc(doc(db, 'whatsapp_links', phone), {
    uid, telefone: phone, chatwoot_account_id: '3', status, linked_at: NOW, link_method: 'whatsapp_code', schema_version: 1
  }));
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'users', ALICE), profile(ALICE));
    await setDoc(doc(db, 'users', BOB), profile(BOB));
    await setDoc(doc(db, 'users', PENDING), profile(PENDING, 'pending'));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Rules - codigo de vinculo do WhatsApp', () => {
  it('usuario ativo gera o proprio codigo pelo servico do Dashboard e so o hash fica salvo', async () => {
    const result = await serviceFor(ALICE).createCode(ALICE);
    expect(result.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    const codeId = await hashLinkCode(result.code, webcrypto.subtle);
    let stored;
    await seed(async (db) => { stored = (await getDoc(doc(db, 'whatsapp_link_codes', codeId))).data(); });
    expect(stored).toMatchObject({ owner_uid: ALICE, status: 'pending' });
    expect(JSON.stringify(stored)).not.toContain(result.code);
  });

  it('gerar um codigo novo descarta o pendente anterior', async () => {
    const service = serviceFor(ALICE);
    const first = await service.createCode(ALICE);
    await service.createCode(ALICE);
    const firstId = await hashLinkCode(first.code, webcrypto.subtle);
    let exists;
    await seed(async (db) => { exists = (await getDoc(doc(db, 'whatsapp_link_codes', firstId))).exists(); });
    expect(exists).toBe(false);
  });

  it('nao cria codigo para outra conta, sem login ou com conta pendente', async () => {
    const id = 'a'.repeat(64);
    await assertFails(setDoc(doc(dbFor(ALICE), 'whatsapp_link_codes', id), codeData(BOB)));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'whatsapp_link_codes', id), codeData(ALICE)));
    await assertFails(setDoc(doc(dbFor(PENDING), 'whatsapp_link_codes', id), codeData(PENDING)));
  });

  it('exige id de hash, status pending, data do servidor e validade de no maximo 15 minutos', async () => {
    const db = dbFor(ALICE);
    await assertFails(setDoc(doc(db, 'whatsapp_link_codes', 'K7QM3XPA'), codeData(ALICE)));
    await assertFails(setDoc(doc(db, 'whatsapp_link_codes', 'b'.repeat(64)), codeData(ALICE, { status: 'used' })));
    await assertFails(setDoc(doc(db, 'whatsapp_link_codes', 'c'.repeat(64)), codeData(ALICE, { expires_at: minutesFromNow(60) })));
    await assertFails(setDoc(doc(db, 'whatsapp_link_codes', 'd'.repeat(64)), codeData(ALICE, { expires_at: minutesFromNow(-1) })));
    await assertFails(setDoc(doc(db, 'whatsapp_link_codes', 'e'.repeat(64)), codeData(ALICE, { created_at: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(doc(db, 'whatsapp_link_codes', 'f'.repeat(64)), codeData(ALICE, { uid: BOB })));
    await assertSucceeds(setDoc(doc(db, 'whatsapp_link_codes', '1'.repeat(64)), codeData(ALICE)));
  });

  it('nao le, altera nem apaga codigo de outra conta, e ninguem marca codigo como usado', async () => {
    const id = '2'.repeat(64);
    await assertSucceeds(setDoc(doc(dbFor(ALICE), 'whatsapp_link_codes', id), codeData(ALICE)));
    await assertFails(getDoc(doc(dbFor(BOB), 'whatsapp_link_codes', id)));
    await assertFails(getDocs(query(collection(dbFor(BOB), 'whatsapp_link_codes'), where('owner_uid', '==', ALICE))));
    await assertFails(deleteDoc(doc(dbFor(BOB), 'whatsapp_link_codes', id)));
    await assertFails(setDoc(doc(dbFor(BOB), 'whatsapp_link_codes', id), codeData(BOB)));
    await assertFails(updateDoc(doc(dbFor(ALICE), 'whatsapp_link_codes', id), { status: 'used' }));
    await assertSucceeds(getDoc(doc(dbFor(ALICE), 'whatsapp_link_codes', id)));
  });
});

describe('Firestore Rules - vinculo do WhatsApp', () => {
  it('cada conta ve apenas o proprio vinculo, com telefone mascarado no servico', async () => {
    await seedLink(PHONE_A, ALICE);
    await seedLink(PHONE_B, BOB);
    const status = await serviceFor(ALICE).getStatus(ALICE);
    expect(status).toMatchObject({ linked: true, phoneId: PHONE_A });
    expect(status.maskedPhone).toBe('+34 ••• ••• 001');
    expect((await serviceFor(BOB).getStatus(BOB)).phoneId).toBe(PHONE_B);

    await assertFails(getDoc(doc(dbFor(ALICE), 'whatsapp_links', PHONE_B)));
    await assertFails(getDocs(query(collection(dbFor(ALICE), 'whatsapp_links'), where('uid', '==', BOB))));
    await assertFails(getDocs(collection(dbFor(ALICE), 'whatsapp_links')));
  });

  it('usuario nao cria vinculo direto pelo cliente (so a whatsapp-api grava)', async () => {
    await assertFails(setDoc(doc(dbFor(ALICE), 'whatsapp_links', PHONE_A), {
      uid: ALICE, telefone: PHONE_A, chatwoot_account_id: '3', status: 'active', linked_at: NOW
    }));
  });

  it('usuario revoga o proprio vinculo e nao revoga nem reativa o de outra conta', async () => {
    await seedLink(PHONE_A, ALICE);
    await seedLink(PHONE_B, BOB);
    expect(await serviceFor(ALICE).revoke(ALICE)).toEqual({ revoked: 1 });
    expect((await serviceFor(ALICE).getStatus(ALICE)).linked).toBe(false);

    const bobLink = doc(dbFor(ALICE), 'whatsapp_links', PHONE_B);
    await assertFails(updateDoc(bobLink, { status: 'revoked', revoked_at: serverTimestamp(), revoked_by: 'user' }));
    const ownLink = doc(dbFor(ALICE), 'whatsapp_links', PHONE_A);
    await assertFails(updateDoc(ownLink, { status: 'active' }));
    await assertFails(deleteDoc(ownLink));
  });

  it('revogacao so troca status, data e autor', async () => {
    await seedLink(PHONE_A, ALICE);
    const ref = doc(dbFor(ALICE), 'whatsapp_links', PHONE_A);
    await assertFails(updateDoc(ref, { status: 'revoked', revoked_at: serverTimestamp(), revoked_by: 'user', uid: BOB }));
    await assertFails(updateDoc(ref, { status: 'revoked', revoked_at: serverTimestamp(), revoked_by: 'admin' }));
    await assertFails(updateDoc(ref, { uid: BOB }));
    await assertSucceeds(updateDoc(ref, { status: 'revoked', revoked_at: serverTimestamp(), revoked_by: 'user' }));
  });

  it('tentativas de vinculo sao privadas do servidor', async () => {
    await assertFails(getDoc(doc(dbFor(ALICE), 'whatsapp_link_attempts', 'abc')));
    await assertFails(setDoc(doc(dbFor(ALICE), 'whatsapp_link_attempts', 'abc'), { failures: 0 }));
  });
});
