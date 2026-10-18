import { describe, expect, it, vi } from 'vitest';
import { createSettingsWebAdapter } from '../../src/ui/settings/settingsWebAdapter.js';

function targetStub({ admin = false, records = [] } = {}) {
  const createRecord = vi.fn(async (record) => ({ success: true, id: record.id || 'created' }));
  const updateRecord = vi.fn(async () => ({ success: true }));
  return {
    allRecords: records,
    currentUserProfile: { uid: admin ? 'admin-a' : 'uid-a', role: admin ? 'admin' : 'user', status: 'active' },
    isCurrentUserAdmin: () => admin,
    getHourExtraRecordDefaults: () => ({ hour_extra_contract: 'default' }),
    financeRecordMutations: { createRecord, updateRecord },
    financeApp: { applicationDependencies: { services: { connectivity: { isOnline: () => true } } } },
    __createRecord: createRecord,
    __updateRecord: updateRecord
  };
}

describe('settings web adapter reference scope governance', () => {
  it('sends explicit personal scope for common macro creation', async () => {
    const target = targetStub();
    const adapter = createSettingsWebAdapter(target);

    const result = await adapter.actions.createMacro({ macro_category: 'Projetos', shared_scope: 'personal' });

    expect(result.success).toBe(true);
    expect(target.__createRecord).toHaveBeenCalledWith(expect.objectContaining({
      type: 'macro',
      macro_category: 'Projetos',
      shared_scope: 'personal'
    }));
  });

  it('defaults omitted common scope to personal by contract', async () => {
    const target = targetStub();
    const adapter = createSettingsWebAdapter(target);

    await adapter.actions.createCategory({ category_name: 'Freela', macro_category: 'Projetos' });

    expect(target.__createRecord).toHaveBeenCalledWith(expect.objectContaining({
      type: 'categoria',
      category_name: 'Freela',
      shared_scope: 'personal'
    }));
  });

  it('rejects common global macro requests before repository write', async () => {
    const target = targetStub();
    const adapter = createSettingsWebAdapter(target);

    const result = await adapter.actions.createMacro({ macro_category: 'Global indevida', shared_scope: 'global' });

    expect(result).toMatchObject({
      success: false,
      code: 'SETTINGS_SHARED_REFERENCE_FORBIDDEN',
      effectiveScope: ''
    });
    expect(target.__createRecord).not.toHaveBeenCalled();
  });

  it('does not silently convert common global category request to personal', async () => {
    const target = targetStub();
    const adapter = createSettingsWebAdapter(target);

    const result = await adapter.actions.createCategory({ category_name: 'Convertida', shared_scope: 'global' });

    expect(result.success).toBe(false);
    expect(target.__createRecord).not.toHaveBeenCalledWith(expect.objectContaining({
      category_name: 'Convertida',
      shared_scope: 'personal'
    }));
  });

  it('allows admin to create personal and global only by explicit scope', async () => {
    const target = targetStub({ admin: true });
    const adapter = createSettingsWebAdapter(target);

    await adapter.actions.createMacro({ macro_category: 'Admin personal', shared_scope: 'personal' });
    await adapter.actions.createMacro({ macro_category: 'Admin global', shared_scope: 'global' });
    await adapter.actions.createCategory({ category_name: 'Admin default' });

    expect(target.__createRecord).toHaveBeenNthCalledWith(1, expect.objectContaining({ shared_scope: 'personal' }));
    expect(target.__createRecord).toHaveBeenNthCalledWith(2, expect.objectContaining({ shared_scope: 'global' }));
    expect(target.__createRecord).toHaveBeenNthCalledWith(3, expect.objectContaining({ shared_scope: 'personal' }));
  });

  it('rejects common update of global references before repository write', async () => {
    const target = targetStub({
      records: [
        { id: 'global-cat', type: 'categoria', category_name: 'Global', shared_scope: 'global' }
      ]
    });
    const adapter = createSettingsWebAdapter(target);

    const result = await adapter.actions.updateCategory({ id: 'global-cat', category_name: 'Tentativa' });

    expect(result).toMatchObject({ success: false, code: 'SETTINGS_SHARED_REFERENCE_FORBIDDEN' });
    expect(target.__updateRecord).not.toHaveBeenCalled();
  });

  it('does not allow owner spoofing through category payload', async () => {
    const target = targetStub();
    const adapter = createSettingsWebAdapter(target);

    await adapter.actions.createCategory({
      category_name: 'Sem spoof',
      macro_category: 'FIXO',
      shared_scope: 'personal',
      owner_uid: 'uid-b'
    });

    expect(target.__createRecord).toHaveBeenCalledWith(expect.not.objectContaining({ owner_uid: 'uid-b' }));
  });
});
