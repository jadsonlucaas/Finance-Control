import { describe, expect, it, vi } from 'vitest';
import { createAccountDeletionService } from '../../src/services/accountDeletion.js';
import { renderAccountDeletionPanel } from '../../src/ui/account/accountDeletionUi.js';
import { createUserAdminController } from '../../src/ui/admin/userAdminController.js';
import { buildUserAdminReadModel } from '../../src/application/readModels/userAdminReadModel.js';
import { resolveUserAdminPermissions } from '../../src/application/userAdmin/userAdminPermissions.js';

const okFetch = (body = { excluido: true }, status = 200) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));

describe('servico de exclusao de conta (Dashboard)', () => {
  it('propria conta: confirma a senha, pega token novo e manda so acao/confirmacao/token', async () => {
    const fetchImpl = okFetch();
    const reauthenticate = vi.fn(async () => {});
    const getIdToken = vi.fn(async () => 'tok');
    const sdk = createAccountDeletionService({ endpoint: 'https://relay.test/x', getIdToken, reauthenticate, fetchImpl });
    await sdk.deleteOwnAccount({ password: 'segredo', confirmacao: ' eu@exemplo.test ' });
    expect(reauthenticate).toHaveBeenCalledWith('segredo');
    expect(getIdToken).toHaveBeenCalledWith(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://relay.test/x');
    expect(JSON.parse(init.body)).toEqual({ acao: 'excluir_conta', confirmacao: 'eu@exemplo.test', idToken: 'tok' });
    expect(init.body).not.toContain('segredo');
  });

  it('senha errada vira WRONG_PASSWORD e nada e enviado', async () => {
    const fetchImpl = okFetch();
    const sdk = createAccountDeletionService({
      endpoint: 'https://relay.test/x',
      getIdToken: async () => 'tok',
      reauthenticate: async () => { throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' }); },
      fetchImpl
    });
    await expect(sdk.deleteOwnAccount({ password: 'errada', confirmacao: 'a@b.c' })).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sdk.errorMessage({ code: 'WRONG_PASSWORD' })).toBe('Senha incorreta.');
  });

  it('admin: manda uid e confirmacao; erro do servidor vira codigo', async () => {
    const fetchImpl = okFetch({ erro: { codigo: 'OWNER_REQUIRED' } }, 403);
    const sdk = createAccountDeletionService({ endpoint: 'https://relay.test/x', getIdToken: async () => 'tok', fetchImpl });
    await expect(sdk.deleteUser('uid-b', 'b@exemplo.test')).rejects.toMatchObject({ code: 'OWNER_REQUIRED' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ acao: 'excluir_usuario', uid: 'uid-b', confirmacao: 'b@exemplo.test', idToken: 'tok' });
  });

  it('sem endpoint fica desabilitado', () => {
    expect(createAccountDeletionService({ getIdToken: async () => 'x' }).enabled).toBe(false);
  });
});

describe('painel "Excluir minha conta"', () => {
  it('mostra o botao, o formulario e o bloqueio para admin', () => {
    expect(renderAccountDeletionPanel({})).toContain('data-account-deletion-action="open"');
    const form = renderAccountDeletionPanel({ open: true, error: '<b>x</b>' });
    expect(form).toContain('id="account-deletion-password"');
    expect(form).toContain('id="account-deletion-email"');
    expect(form).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(renderAccountDeletionPanel({ isAdmin: true })).not.toContain('data-account-deletion-action');
    expect(renderAccountDeletionPanel({ enabled: false })).toContain('indisponível');
  });
});

describe('painel de usuarios: excluir', () => {
  const users = [
    { uid: 'u1', email: 'u1@exemplo.test', role: 'user', status: 'active' },
    { uid: 'a2', email: 'a2@exemplo.test', role: 'admin', status: 'active' },
    { uid: 'o1', email: 'o1@exemplo.test', role: 'owner', status: 'active' },
    { uid: 'me', email: 'me@exemplo.test', role: 'admin', status: 'active' }
  ];

  it('admin exclui usuario comum; owner tambem exclui admin; ninguem exclui owner nem a si mesmo', () => {
    const asAdmin = buildUserAdminReadModel({
      users, currentUser: { uid: 'me' }, permissions: resolveUserAdminPermissions({ profile: { role: 'admin', status: 'active' } })
    });
    const removable = (model) => model.users.filter((u) => u.actions.remove).map((u) => u.uid);
    expect(removable(asAdmin)).toEqual(['u1']);
    const asOwner = buildUserAdminReadModel({
      users, currentUser: { uid: 'o1' }, permissions: resolveUserAdminPermissions({ profile: { role: 'owner', status: 'active' } })
    });
    expect(removable(asOwner).sort()).toEqual(['a2', 'me', 'u1']);
  });

  function fixture(typed) {
    const deleteUser = vi.fn(async () => ({ excluido: true }));
    const notify = vi.fn();
    const controller = createUserAdminController({
      document: {},
      presenter: { render: vi.fn() },
      readSource: { listUsers: vi.fn(async () => users) },
      actions: { updateUser: vi.fn(), deleteUser },
      authContext: () => ({ currentUser: { uid: 'me' }, profile: { uid: 'me', role: 'admin', status: 'active' } }),
      prompt: vi.fn(() => typed),
      notify,
      consoleRef: { error: vi.fn() }
    });
    return { controller, deleteUser, notify };
  }

  it('so exclui quando o e-mail digitado confere', async () => {
    const wrong = fixture('outro@exemplo.test');
    await wrong.controller.refresh();
    expect((await wrong.controller.deleteUser('u1')).code).toBe('CONFIRMATION_MISMATCH');
    expect(wrong.deleteUser).not.toHaveBeenCalled();

    const cancelled = fixture(null);
    await cancelled.controller.refresh();
    expect((await cancelled.controller.deleteUser('u1')).code).toBe('USER_ADMIN_ACTION_CANCELLED');

    const ok = fixture(' U1@exemplo.test ');
    await ok.controller.refresh();
    expect((await ok.controller.deleteUser('u1')).isOk).toBe(true);
    expect(ok.deleteUser).toHaveBeenCalledWith('u1', 'U1@exemplo.test');
    expect(ok.notify).toHaveBeenCalledWith('Conta excluída definitivamente.');
  });
});
