import { performance } from 'node:perf_hooks';
import { buildUserAdminReadModel } from '../src/application/readModels/userAdminReadModel.js';
import { resolveUserAdminPermissions } from '../src/application/userAdmin/userAdminPermissions.js';

function fixture(size = 100) {
  return Array.from({ length: size }, (_, index) => ({
    uid: `uid-${String(index).padStart(5, '0')}`,
    email: `usuario-${String(index).padStart(5, '0')}@example.test`,
    name: `Usuario ${index}`,
    role: index % 25 === 0 ? 'admin' : 'user',
    status: index % 11 === 0 ? 'inactive' : index % 7 === 0 ? 'pending' : 'active'
  }));
}

const permissions = resolveUserAdminPermissions({
  profile: { uid: 'admin-a', role: 'admin', status: 'active' }
});

const results = [100, 1000, 5000].map((users) => {
  const start = performance.now();
  const model = buildUserAdminReadModel({
    users: fixture(users),
    currentUser: { uid: 'admin-a' },
    permissions,
    pagination: { limit: 50, orderBy: 'email', direction: 'asc' }
  });
  const elapsedMs = Number((performance.now() - start).toFixed(3));
  return {
    users,
    elapsedMs,
    rendered: model.users.length,
    total: model.summary.total,
    pending: model.summary.byStatus.pending,
    inactive: model.summary.byStatus.inactive
  };
});

console.log(JSON.stringify({ ok: true, wrote: false, results }, null, 2));

