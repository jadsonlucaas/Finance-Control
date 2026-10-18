import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createFinanceUiConsumerAdapters,
  createLegacyUiBridge,
  installFinanceUiConsumerAdapters
} from '../../src/ui/legacy-ui.js';

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add: (...items) => items.forEach((item) => classes.add(item)),
    remove: (...items) => items.forEach((item) => classes.delete(item)),
    contains: (item) => classes.has(item),
    toggle: (item, force) => {
      const shouldAdd = force === undefined ? !classes.has(item) : Boolean(force);
      if (shouldAdd) classes.add(item);
      else classes.delete(item);
      return shouldAdd;
    },
    toString: () => [...classes].join(' ')
  };
}

function createElement(id) {
  return {
    id,
    children: [],
    className: '',
    classList: createClassList(),
    dataset: {},
    innerHTML: '',
    parentElement: null,
    textContent: '',
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
      nodes.forEach((node) => {
        node.parentElement = this;
      });
    }
  };
}

function createTarget() {
  const elements = new Map();
  const body = createElement('body');
  const target = {
    document: {
      body,
      getElementById: (id) => elements.get(id) || null,
      querySelectorAll: (selector) => selector === '#main-tabs button'
        ? [...elements.values()].filter((element) => element.__tabButton)
        : []
    },
    setTimeout: vi.fn((callback) => {
      callback();
      return 1;
    }),
    clearTimeout: vi.fn(),
    financeApp: { existing: true }
  };

  target.add = (id, element = createElement(id)) => {
    elements.set(id, element);
    return element;
  };

  return target;
}

describe('financeUI consumer adapters', () => {
  it('installs under financeApp without creating a new window global', () => {
    const target = createTarget();
    const beforeKeys = new Set(Object.keys(target));

    const adapters = installFinanceUiConsumerAdapters(target);

    expect(adapters).toBe(target.financeApp.financeUiAdapters);
    expect(target.financeApp.existing).toBe(true);
    expect([...Object.keys(target)].filter((key) => !beforeKeys.has(key))).toEqual([]);
    expect(target.financeUI).toBeUndefined();
  });

  it('preserves toast and overlay behavior expected by migrated legacy consumers', () => {
    const target = createTarget();
    const toast = target.add('toast');
    const overlay = target.add('delete-overlay');
    overlay.classList.add('hidden');
    const adapters = createFinanceUiConsumerAdapters(createLegacyUiBridge(target));

    adapters.showToast('Salvo', false);
    expect(toast.textContent).toBe('Salvo');
    expect(toast.className).toContain('bg-success');
    expect(toast.classList.contains('hidden')).toBe(true);

    expect(adapters.showOverlay('delete-overlay')).toBe(overlay);
    expect(overlay.parentElement).toBe(target.document.body);
    expect(overlay.classList.contains('hidden')).toBe(false);
    adapters.hideOverlay('delete-overlay');
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  it('preserves sidebar, back button and tab navigation behavior', () => {
    const target = createTarget();
    const sidebarOverlay = target.add('sidebar-overlay');
    const sidebar = target.add('sidebar');
    const backButton = target.add('btn-go-back');
    const dashboardView = target.add('view-dashboard');
    const saidasView = target.add('view-saidas');
    const dashboardButton = target.add('tab-dashboard');
    const saidasButton = target.add('tab-saidas');
    dashboardButton.__tabButton = true;
    saidasButton.__tabButton = true;
    dashboardButton.dataset.tab = 'dashboard';
    saidasButton.dataset.tab = 'saidas';
    const adapters = createFinanceUiConsumerAdapters(createLegacyUiBridge(target));

    expect(adapters.toggleSidebar(false)).toBe(true);
    expect(sidebarOverlay.classList.contains('hidden')).toBe(false);
    expect(sidebar.classList.contains('-translate-x-full')).toBe(false);
    adapters.setSidebarOpen(false);
    expect(sidebarOverlay.classList.contains('hidden')).toBe(true);
    expect(sidebar.classList.contains('-translate-x-full')).toBe(true);

    adapters.updateBackButton(false);
    expect(backButton.classList.contains('hidden')).toBe(true);
    adapters.activateTab('saidas', ['dashboard', 'saidas']);
    expect(saidasButton.className).toContain('bg-accent/10');
    expect(dashboardView.classList.contains('hidden')).toBe(true);
    expect(saidasView.classList.contains('hidden')).toBe(false);
  });

  it('preserves list, empty state and total box rendering behavior', () => {
    const target = createTarget();
    const list = target.add('saidas-list');
    const empty = target.add('saidas-empty');
    const meta = target.add('saidas-meta');
    const pagination = target.add('saidas-pagination');
    const total = target.add('saidas-total');
    const row = createElement('row');
    const adapters = createFinanceUiConsumerAdapters(createLegacyUiBridge(target));

    adapters.renderListState({
      listId: 'saidas-list',
      emptyId: 'saidas-empty',
      metaId: 'saidas-meta',
      paginationId: 'saidas-pagination',
      nodes: [row],
      hasItems: true,
      metaHtml: '<strong>1 de 1 exibidos</strong>',
      showPagination: false
    });

    expect(list.children).toEqual([row]);
    expect(empty.classList.contains('hidden')).toBe(true);
    expect(meta.innerHTML).toBe('<strong>1 de 1 exibidos</strong>');
    expect(pagination.classList.contains('hidden')).toBe(true);

    adapters.renderTotalBox('saidas-total', '<span>R$ 10,00</span>', true);
    expect(total.innerHTML).toBe('<span>R$ 10,00</span>');
    adapters.renderTotalBox('saidas-total', '<span>R$ 10,00</span>', false);
    expect(total.classList.contains('hidden')).toBe(true);
    expect(total.innerHTML).toBe('');
  });

  it('preserves text and hidden helpers used by remaining classic consumers', () => {
    const target = createTarget();
    const meta = target.add('controle-horas-meta');
    const empty = target.add('controle-horas-empty');
    const adapters = createFinanceUiConsumerAdapters(createLegacyUiBridge(target));

    expect(adapters.setText('controle-horas-meta', '2 lançamentos')).toBe(meta);
    expect(meta.textContent).toBe('2 lançamentos');

    expect(adapters.setHidden('controle-horas-empty', true)).toBe(empty);
    expect(empty.classList.contains('hidden')).toBe(true);
    adapters.setHidden('controle-horas-empty', false);
    expect(empty.classList.contains('hidden')).toBe(false);
  });

  it('keeps the adapter free from Firebase, dataSdk and financial rule references', () => {
    const source = fs.readFileSync('src/ui/legacy-ui.js', 'utf8');

    expect(source).not.toMatch(/\bdataSdk\b/);
    expect(source).not.toMatch(/\bfirebase\b/i);
    expect(source).not.toMatch(/\bauth(Sdk)?\b/i);
    expect(source).not.toMatch(/\bcalcular[A-Za-z0-9_$]*\b/);
    expect(source).not.toMatch(/\broundCurrency\b/);
    expect(source).not.toMatch(/\b(create|update|delete|upsert)Record\b/);
  });
});
