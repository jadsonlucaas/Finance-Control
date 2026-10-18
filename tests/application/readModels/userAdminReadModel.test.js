import { describe, expect, it } from 'vitest';
import { buildUserAdminReadModel } from '../../../src/application/readModels/userAdminReadModel.js';
import { resolveUserAdminPermissions } from '../../../src/application/userAdmin/userAdminPermissions.js';

const adminPermissions = resolveUserAdminPermissions({
  profile: { uid: 'admin-a', role: 'admin', status: 'active' }
});

const users = [
  { uid: 'admin-a', email: 'admin@example.test', role: 'admin', status: 'active' },
  { uid: 'pending-a', email: 'pendente@example.test', role: 'user', status: 'pending' },
  { uid: 'active-a', email: 'ativo@example.test', role: 'user', status: 'active' },
  { uid: 'inactive-a', email: 'inativo@example.test', role: 'user', status: 'inactive' }
];

describe('buildUserAdminReadModel', () => {
  it('separa acoes de ciclo e bloqueia alteracao do proprio usuario', () => {
    const model = buildUserAdminReadModel({
      users,
      currentUser: { uid: 'admin-a' },
      permissions: adminPermissions
    });

    expect(model.canRead).toBe(true);
    expect(model.users.find((user) => user.uid === 'admin-a').actions.changeRole).toBe(false);
    expect(model.users.find((user) => user.uid === 'pending-a').actions.approve).toBe(true);
    expect(model.users.find((user) => user.uid === 'active-a').actions.deactivate).toBe(true);
    expect(model.users.find((user) => user.uid === 'inactive-a').actions.reactivate).toBe(true);
  });

  it('filtra por status, role e busca sem carregar autoridade no read model', () => {
    const model = buildUserAdminReadModel({
      users,
      currentUser: { uid: 'user-a' },
      permissions: resolveUserAdminPermissions({ profile: { role: 'user', status: 'active' } }),
      filters: { status: 'pending', role: 'user', search: 'pendente' }
    });

    expect(model.canRead).toBe(false);
    expect(model.users.map((user) => user.uid)).toEqual(['pending-a']);
    expect(model.users[0].actions.approve).toBe(false);
  });

  it('pagina localmente quando a fonte nao traz pageInfo do Firestore', () => {
    const many = Array.from({ length: 75 }, (_, index) => ({
      uid: `u-${index}`,
      email: `u-${String(index).padStart(2, '0')}@example.test`,
      role: 'user',
      status: 'active'
    }));
    const model = buildUserAdminReadModel({
      users: many,
      currentUser: { uid: 'admin-a' },
      permissions: adminPermissions,
      pagination: { limit: 50, orderBy: 'email', direction: 'asc' }
    });

    expect(model.users).toHaveLength(50);
    expect(model.pagination.hasMore).toBe(true);
    expect(model.summary.total).toBe(75);
  });
});

