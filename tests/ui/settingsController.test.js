import { describe, expect, it, vi } from 'vitest';
import { createSettingsController } from '../../src/ui/settings/settingsController.js';
import { installSettingsActiveUi } from '../../src/ui/settings/settingsActiveUi.js';

function element(value = '') {
  const children = new Map();
  return {
    value,
    dataset: {},
    disabled: false,
    innerHTML: '',
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    focus: vi.fn(),
    querySelector: vi.fn((selector) => children.get(selector) || null),
    __children: children
  };
}

function documentStub() {
  const elements = new Map([
    ['person-input', element('Ana')],
    ['person-base-salary', element('5000')],
    ['person-receiving-type', element('quinzenal')],
    ['add-person-modal', element()],
    ['macro-input', element('Casa')],
    ['macro-scope', element('personal')],
    ['macro-scope-wrap', element()],
    ['add-macro-modal', element()],
    ['category-modal', element()],
    ['cat-name', element('Energia')],
    ['cat-macro', element('Casa')],
    ['cat-color', element('#38bdf8')],
    ['cat-icon', element('bolt')],
    ['cat-scope', element('personal')],
    ['cat-scope-wrap', element()]
  ]);
  return {
    documentElement: { dataset: {} },
    defaultView: { lucide: { createIcons: vi.fn() } },
    getElementById: vi.fn((id) => elements.get(id) || null),
    addEventListener: vi.fn(),
    __elements: elements
  };
}

function presenter() {
  return { render: vi.fn() };
}

const readPayload = {
  userProfile: { uid: 'uid-a', role: 'user', status: 'active' },
  personalReferences: [],
  sharedReferences: [],
  people: [],
  percentageRules: [],
  taxParameters: [],
  localSettings: {},
  permissions: {}
};

describe('settings controller', () => {
  it('renders loading and success states from injected read source', async () => {
    const ui = presenter();
    const controller = createSettingsController({
      document: documentStub(),
      presenter: ui,
      readSource: { read: vi.fn(async () => readPayload) },
      now: () => '2026-09-04T00:00:00.000Z'
    });

    const result = await controller.render();

    expect(ui.render).toHaveBeenCalledWith(expect.objectContaining({ status: 'loading' }));
    expect(ui.render).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(result.status).toBe('success');
  });

  it('does not decide authorization and delegates mutations to injected actions', async () => {
    const actions = {
      createPerson: vi.fn(async () => ({ success: true })),
      createMacro: vi.fn(async () => ({ success: true })),
      createCategory: vi.fn(async () => ({ success: true })),
      updatePerson: vi.fn(async () => ({ success: true }))
    };
    const controller = createSettingsController({
      document: documentStub(),
      presenter: presenter(),
      readSource: { read: vi.fn(async () => readPayload) },
      actions
    });

    await controller.savePerson();
    await controller.saveMacro();
    await controller.saveCategory();
    await controller.updatePersonReceivingType('p1', 'mensal');

    expect(actions.createPerson).toHaveBeenCalledWith({ person: 'Ana', salary_base: 5000, receiving_type: 'quinzenal' });
    expect(actions.createMacro).toHaveBeenCalledWith({ macro_category: 'Casa', shared_scope: 'personal' });
    expect(actions.createCategory).toHaveBeenCalledWith(expect.objectContaining({ category_name: 'Energia', macro_category: 'Casa' }));
    expect(actions.updatePerson).toHaveBeenCalledWith({ id: 'p1', fields: { receiving_type: 'mensal' } });
  });

  it('preserves manipulated global scope for application layer rejection', async () => {
    const doc = documentStub();
    doc.__elements.get('macro-scope').value = 'global';
    const actions = {
      createMacro: vi.fn(async () => ({ success: false, code: 'SETTINGS_SHARED_REFERENCE_FORBIDDEN' }))
    };
    const controller = createSettingsController({
      document: doc,
      presenter: presenter(),
      readSource: { read: vi.fn(async () => readPayload) },
      actions
    });

    const result = await controller.saveMacro();

    expect(result.code).toBe('SETTINGS_SHARED_REFERENCE_FORBIDDEN');
    expect(actions.createMacro).toHaveBeenCalledWith({ macro_category: 'Casa', shared_scope: 'global' });
    expect(doc.__elements.get('add-macro-modal').classList.add).not.toHaveBeenCalled();
  });

  it('keeps form state when a mutation fails', async () => {
    const doc = documentStub();
    const controller = createSettingsController({
      document: doc,
      presenter: presenter(),
      readSource: { read: vi.fn(async () => readPayload) },
      actions: { createPerson: vi.fn(async () => ({ success: false })) }
    });

    const result = await controller.savePerson();

    expect(result.success).toBe(false);
    expect(doc.__elements.get('person-input').value).toBe('Ana');
    expect(doc.__elements.get('add-person-modal').classList.add).not.toHaveBeenCalled();
  });

  it('renders offline state without reading data', async () => {
    const read = vi.fn();
    const ui = presenter();
    const controller = createSettingsController({
      document: documentStub(),
      presenter: ui,
      readSource: { read },
      connectivity: { isOnline: () => false }
    });

    const result = await controller.render();

    expect(read).not.toHaveBeenCalled();
    expect(result.status).toBe('offline');
  });
});

describe('settings active UI', () => {
  it('preserves existing global names as modern bridges without adding new APIs', () => {
    const controller = {
      render: vi.fn(),
      openPersonForm: vi.fn(),
      closePersonForm: vi.fn(),
      savePerson: vi.fn(),
      openMacroForm: vi.fn(),
      closeMacroForm: vi.fn(),
      saveMacro: vi.fn(),
      openCategoryForm: vi.fn(),
      closeCategoryForm: vi.fn(),
      saveCategory: vi.fn(),
      updatePersonReceivingType: vi.fn(),
      destroy: vi.fn()
    };
    const target = { document: documentStub() };

    const result = installSettingsActiveUi(target, { controller });
    const second = installSettingsActiveUi(target);

    expect(result.controller).toBe(controller);
    expect(second.alreadyInstalled).toBe(true);
    expect(target.renderConfiguracoes.__financeModernSettings).toBe(true);
    target.saveMacroCategory();
    expect(controller.saveMacro).toHaveBeenCalledOnce();
  });
});
