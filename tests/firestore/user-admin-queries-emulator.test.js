import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUserAdminService } from '../../src/services/userAdmin.js';

const PROJECT_ID = 'finance-control-user-admin-query-test';
const NOW = '2026-09-05T12:00:00.000Z';

let testEnv;

function profile(index, overrides = {}) {
  const uid = `user-${String(index).padStart(4, '0')}`;
  return {
    uid,
    email: `${uid}@example.test`,
    name: `Usuario ${String(index).padStart(4, '0')}`,
    role: index % 5 === 0 ? 'admin' : index % 17 === 0 ? 'owner' : 'user',
    status: ['active', 'pending', 'inactive', 'active'][index % 4],
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function adminProfile() {
  return {
    uid: 'admin-root',
    email: 'admin-root@example.test',
    role: 'admin',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW
  };
}

async function seedUsers(count = 1000) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/admin-root'), adminProfile());
    for (let offset = 0; offset < count; offset += 400) {
      const batch = writeBatch(db);
      Array.from({ length: Math.min(400, count - offset) }, (_, localIndex) => offset + localIndex)
        .forEach((index) => batch.set(doc(db, `users/user-${String(index).padStart(4, '0')}`), profile(index)));
      await batch.commit();
    }
  });
}

function dbForAdmin() {
  return testEnv.authenticatedContext('admin-root', {
    email: 'admin-root@example.test'
  }).firestore();
}

async function page(service, cursor = '') {
  return service.listUsers({ pageSize: 50, cursor, filters: {} });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('User admin Firestore queries', () => {
  it('pagina 1, 2 e 10 com 50 itens, ordem estavel, cursor opaco e sem repeticao', async () => {
    await seedUsers(1000);
    const service = createUserAdminService(dbForAdmin());
    const first = await page(service);
    const second = await page(service, first.nextCursor);
    let tenth = first;
    for (let index = 1; index < 10; index += 1) {
      tenth = await page(service, tenth.nextCursor);
    }

    expect(first.items).toHaveLength(50);
    expect(second.items).toHaveLength(50);
    expect(tenth.items).toHaveLength(50);
    expect(first.pageInfo.source).toBe('firestore');
    expect(first.pageInfo.searchMode).toBe('local_page');
    expect(first.nextCursor).toBeTruthy();
    expect(first.nextCursor).not.toMatch(/user-|example|DocumentSnapshot|firebase/i);
    expect(second.items.some((item) => first.items.some((previous) => previous.uid === item.uid))).toBe(false);
    expect(tenth.items.some((item) => first.items.some((previous) => previous.uid === item.uid))).toBe(false);
    expect(first.items.map((item) => item.email)).toEqual([...first.items.map((item) => item.email)].sort());
  });

  it('aplica filtros server-side de status, role e status mais role', async () => {
    await seedUsers(1000);
    const service = createUserAdminService(dbForAdmin());
    const active = await service.listUsers({ pageSize: 50, filters: { status: 'active' } });
    const pending = await service.listUsers({ pageSize: 50, filters: { status: 'pending' } });
    const admins = await service.listUsers({ pageSize: 50, filters: { role: 'admin' } });
    const activeAdmins = await service.listUsers({ pageSize: 50, filters: { status: 'active', role: 'admin' } });

    expect(active.items).toHaveLength(50);
    expect(active.items.every((user) => user.status === 'active')).toBe(true);
    expect(pending.items).toHaveLength(50);
    expect(pending.items.every((user) => user.status === 'pending')).toBe(true);
    expect(admins.items).toHaveLength(50);
    expect(admins.items.every((user) => user.role === 'admin')).toBe(true);
    expect(activeAdmins.items.length).toBeGreaterThan(0);
    expect(activeAdmins.items.every((user) => user.status === 'active' && user.role === 'admin')).toBe(true);
    expect(activeAdmins.pageInfo.filters).toEqual({ status: 'active', role: 'admin' });
  });

  it('limita pageSize ao maximo do contrato e cursor muda quando filtro e trocado', async () => {
    await seedUsers(1000);
    const service = createUserAdminService(dbForAdmin());
    const oversized = await service.listUsers({ pageSize: 999, filters: {} });
    const firstActive = await service.listUsers({ pageSize: 50, filters: { status: 'active' } });
    const firstPending = await service.listUsers({ pageSize: 50, filters: { status: 'pending' } });

    expect(oversized.items).toHaveLength(200);
    expect(oversized.pageInfo.limit).toBe(200);
    expect(firstActive.nextCursor).toBeTruthy();
    expect(firstPending.items[0].uid).not.toBe(firstActive.items[0].uid);
  });
});

