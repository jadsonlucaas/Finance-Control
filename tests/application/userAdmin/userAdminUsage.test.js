import { describe, expect, it } from 'vitest';
import { buildUserAdminReadModel } from '../../../src/application/readModels/userAdminReadModel.js';
import { translateText, loadCatalog } from '../../../src/core/i18n.js';

describe('painel de usuarios: consumo do mes (Etapa 5)', () => {
  it('normaliza o consumo e deixa null para quem nao usou', () => {
    const model = buildUserAdminReadModel({
      users: [
        { uid: 'a', email: 'a@example.test', role: 'user', status: 'active', usage: { month: '2026-11', messages: 12, tool_calls: '40', writes: 3, records_read: 351.4 } },
        { uid: 'b', email: 'b@example.test', role: 'user', status: 'active' }
      ],
      currentUser: { uid: 'root' },
      permissions: { canReadUserAdmin: true, canManageUsers: true },
      filters: {},
      pagination: { limit: 50 }
    });
    const byUid = Object.fromEntries(model.users.map((user) => [user.uid, user.usage]));
    expect(byUid.a).toEqual({ month: '2026-11', messages: 12, toolCalls: 40, writes: 3, recordsRead: 351 });
    expect(byUid.b).toBeNull();
  });

  it('traduz a linha de consumo para espanhol', async () => {
    await loadCatalog('es-ES');
    expect(translateText('Consumo no mês: 12 mensagens · 40 consultas da IA · 351 leituras', 'es-ES'))
      .toBe('Consumo del mes: 12 mensajes · 40 consultas de la IA · 351 lecturas');
  });
});
