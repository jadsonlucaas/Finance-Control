import { describe, expect, it, vi } from 'vitest';
import { createUserAdminController } from '../../src/ui/admin/userAdminController.js';

function controllerFixture(options = {}) {
  const render = vi.fn();
  const updateUser = vi.fn(async (uid, payload) => ({ isOk: true, uid, payload }));
  const listUsers = vi.fn(async () => options.users || [
    { uid: 'pending-a', email: 'pending@example.test', role: 'user', status: 'pending' }
  ]);
  const controller = createUserAdminController({
    document: {},
    presenter: { render },
    readSource: { listUsers },
    actions: { updateUser },
    authContext: () => ({
      currentUser: { uid: 'admin-a' },
      profile: { uid: 'admin-a', role: 'admin', status: 'active' }
    }),
    confirm: () => true,
    notify: vi.fn(),
    consoleRef: { error: vi.fn() }
  });
  return { controller, render, updateUser, listUsers };
}

describe('createUserAdminController', () => {
  it('carrega usuarios com consulta paginada e filtros explicitos', async () => {
    const { controller, listUsers } = controllerFixture();

    await controller.updateFilters({ status: 'pending', role: 'user' });

    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({
      filters: {
        status: 'pending',
        role: 'user'
      },
      pageSize: 50,
      orderBy: 'email',
      direction: 'asc'
    }));
  });

  it('impede duplo disparo para o mesmo usuario enquanto existe update pendente', async () => {
    let resolveUpdate;
    const updateUser = vi.fn(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const render = vi.fn();
    const controller = createUserAdminController({
      document: {},
      presenter: { render },
      readSource: {
        listUsers: vi.fn(async () => [
          { uid: 'pending-a', email: 'pending@example.test', role: 'user', status: 'pending' }
        ])
      },
      actions: { updateUser },
      authContext: () => ({
        currentUser: { uid: 'admin-a' },
        profile: { uid: 'admin-a', role: 'admin', status: 'active' }
      }),
      notify: vi.fn(),
      consoleRef: { error: vi.fn() }
    });

    await controller.refresh();
    const first = controller.setStatus('pending-a', 'active');
    await Promise.resolve();
    const second = await controller.setStatus('pending-a', 'active');
    resolveUpdate({ isOk: true });
    await first;

    expect(second).toMatchObject({ isOk: false, code: 'USER_ADMIN_ACTION_IGNORED' });
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it('preserva estado visual anterior quando o update falha', async () => {
    const { controller, render, updateUser } = controllerFixture();
    updateUser.mockRejectedValueOnce(new Error('NETWORK_DOWN'));

    await controller.refresh();
    await controller.setStatus('pending-a', 'active');

    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({
      users: [expect.objectContaining({ uid: 'pending-a', status: 'pending' })]
    }));
  });

  it('mantem historico de cursor para voltar pagina e reseta ao trocar filtro', async () => {
    const users = Array.from({ length: 75 }, (_, index) => ({
      uid: `user-${index}`,
      email: `user-${String(index).padStart(2, '0')}@example.test`,
      role: 'user',
      status: 'active'
    }));
    const { controller } = controllerFixture({ users });

    const first = await controller.refresh();
    const second = await controller.nextPage();
    const previous = await controller.previousPage();
    await controller.updateFilters({ status: 'active' });

    expect(first.users[0].uid).toBe('user-0');
    expect(second.users[0].uid).toBe('user-50');
    expect(previous.users[0].uid).toBe('user-0');
    expect(controller.getState().cursorHistory).toEqual([]);
  });

  it('mostra e alterna o acesso cortesia ao WhatsApp, inclusive para o proprio admin', async () => {
    const render = vi.fn();
    let grants = { 'admin-a': { status: 'revoked' } };
    const setAssistantComp = vi.fn(async (uid, active) => {
      grants = { ...grants, [uid]: { status: active ? 'active' : 'revoked' } };
    });
    const controller = createUserAdminController({
      document: {},
      presenter: { render },
      readSource: {
        listUsers: vi.fn(async () => [
          { uid: 'admin-a', email: 'admin@example.test', role: 'owner', status: 'active' },
          { uid: 'juan', email: 'juan@example.test', role: 'user', status: 'active' },
          { uid: 'pending-a', email: 'pending@example.test', role: 'user', status: 'pending' }
        ]),
        listAssistantComps: vi.fn(async () => grants)
      },
      actions: { updateUser: vi.fn(), setAssistantComp },
      authContext: () => ({ currentUser: { uid: 'admin-a' }, profile: { uid: 'admin-a', role: 'owner', status: 'active' } }),
      confirm: () => true,
      notify: vi.fn(),
      consoleRef: { error: vi.fn() }
    });

    const model = await controller.refresh();
    const byUid = Object.fromEntries(model.users.map((user) => [user.uid, user]));
    expect(byUid['admin-a']).toMatchObject({ assistantComp: false, actions: { assistantComp: true, self: true } });
    expect(byUid['pending-a'].actions.assistantComp).toBe(false);

    await controller.setAssistantComp('admin-a', true);
    await controller.setAssistantComp('juan', true);
    expect(setAssistantComp).toHaveBeenCalledWith('juan', true, { targetEmail: 'juan@example.test' });
    const after = controller.getState().model.users;
    expect(after.filter((user) => user.assistantComp).map((user) => user.uid)).toEqual(['admin-a', 'juan']);

    await controller.setAssistantComp('juan', false);
    expect(controller.getState().model.users.find((user) => user.uid === 'juan').assistantComp).toBe(false);
  });
});
