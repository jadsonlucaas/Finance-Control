import { describe, expect, it } from 'vitest';
import { buildSettingsReadModel } from '../../../src/application/readModels/settingsReadModel.js';

const baseInput = {
  userProfile: { uid: 'uid-a', role: 'user', status: 'active' },
  permissions: {},
  personalReferences: [
    { id: 'macro-a', type: 'macro', macro_category: 'Casa', shared_scope: 'personal', owner_uid: 'uid-a' },
    { id: 'cat-a', type: 'categoria', macro_category: 'Casa', category_name: 'Energia', shared_scope: 'personal', owner_uid: 'uid-a' },
    { id: 'cat-b', type: 'categoria', macro_category: 'Casa', category_name: 'Outro usuario', shared_scope: 'personal', owner_uid: 'uid-b' }
  ],
  sharedReferences: [
    { id: 'macro-g', type: 'macro', macro_category: 'Global', shared_scope: 'global' },
    { id: 'cat-g', type: 'categoria', macro_category: 'Global', category_name: 'Compartilhada', shared_scope: 'global' }
  ],
  people: [
    { id: 'p1', type: 'pessoa', person: 'Ana', salary_base: 5000, owner_uid: 'uid-a' }
  ],
  percentageRules: [
    { id: 'rule-1', type: 'percentage_rule', percentage: 10, base_type: 'salary', status: 'active' }
  ],
  taxParameters: [
    { id: 'inss-2026', parameter_type: 'inss', status: 'active' }
  ],
  localSettings: {
    theme: 'dark'
  },
  options: {
    generatedAt: '2026-09-04T00:00:00.000Z'
  }
};

describe('buildSettingsReadModel', () => {
  it('does not mutate input and returns deterministic output', () => {
    const input = JSON.parse(JSON.stringify(baseInput));
    const before = JSON.stringify(input);

    const first = buildSettingsReadModel(input);
    const second = buildSettingsReadModel(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(first).toEqual(second);
  });

  it('keeps personal and shared references separated without leaking other owners', () => {
    const model = buildSettingsReadModel(baseInput);

    expect(model.references.personalMacros.map((item) => item.id)).toEqual(['macro-a']);
    expect(model.references.personalCategories.map((item) => item.id)).toEqual(['cat-a']);
    expect(model.references.effectiveCategories.map((item) => item.id)).not.toContain('cat-b');
    expect(model.references.sharedMacros.map((item) => item.id)).toEqual(['macro-g']);
    expect(model.references.sharedCategories.map((item) => item.id)).toEqual(['cat-g']);
  });

  it('reflects permissions without inventing admin authority', () => {
    const common = buildSettingsReadModel(baseInput);
    const admin = buildSettingsReadModel({
      ...baseInput,
      userProfile: { uid: 'uid-admin', role: 'admin', status: 'active' },
      permissions: { canManageSharedReferences: true }
    });
    const inactive = buildSettingsReadModel({
      ...baseInput,
      userProfile: { uid: 'uid-a', role: 'admin', status: 'inactive' },
      permissions: { canManageSharedReferences: true }
    });

    expect(common.permissions.canManageSharedReferences).toBe(false);
    expect(common.references.sharedMacros[0].readonly).toBe(true);
    expect(admin.permissions.canManageSharedReferences).toBe(true);
    expect(admin.references.sharedMacros[0].readonly).toBe(false);
    expect(inactive.permissions.canReadSettings).toBe(false);
    expect(inactive.permissions.canManageSharedReferences).toBe(false);
  });

  it('does not recalculate percentage rules or tax parameters', () => {
    const model = buildSettingsReadModel(baseInput);

    expect(model.rules.percentageRules).toEqual(baseInput.percentageRules);
    expect(model.rules.taxParameters).toEqual(baseInput.taxParameters);
    expect(model.rules.percentageRules[0].percentage).toBe(10);
  });
});
