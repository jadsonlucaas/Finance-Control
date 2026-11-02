import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') }))
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: firestore.doc,
  documentId: vi.fn(),
  getDoc: firestore.getDoc,
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  setDoc: firestore.setDoc,
  startAfter: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn()
}));

import { createUserAdminService } from '../../src/services/userAdmin.js';

describe('userAdmin login metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'user-1',
        email: 'same@example.test',
        role: 'user',
        status: 'active',
        updated_at: '2026-01-01T00:00:00.000Z'
      })
    });
    firestore.setDoc.mockResolvedValue(undefined);
  });

  it('does not update updated_at or unchanged email on login', async () => {
    const service = createUserAdminService({});
    await service.ensureProfile({ uid: 'user-1', email: 'same@example.test' });

    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc.mock.calls[0][1]).toEqual({
      last_login_at: expect.any(String)
    });
  });

  it('updates email only when Auth email changed', async () => {
    const service = createUserAdminService({});
    await service.ensureProfile({ uid: 'user-1', email: 'new@example.test' });

    expect(firestore.setDoc.mock.calls[0][1]).toEqual({
      email: 'new@example.test',
      last_login_at: expect.any(String)
    });
  });

  it('does not block active access when last_login_at write fails', async () => {
    firestore.setDoc.mockRejectedValue(firebaseError('resource-exhausted'));
    const service = createUserAdminService({});

    await expect(service.ensureProfile({ uid: 'user-1', email: 'same@example.test' }))
      .resolves.toMatchObject({ status: 'active' });
    await Promise.resolve();
  });
});

function firebaseError(code) {
  return Object.assign(new Error('write failed'), { code });
}
