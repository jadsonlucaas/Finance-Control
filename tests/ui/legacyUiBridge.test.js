import { describe, expect, it, vi } from 'vitest';
import { createLegacyUiBridge, installLegacyUiBridge } from '../../src/ui/legacy-ui.js';

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
    __elements: elements
  };

  target.add = (id, element = createElement(id)) => {
    elements.set(id, element);
    return element;
  };

  return target;
}

describe('legacy UI bridge ES module', () => {
  it('delegates DOM helper behavior to the canonical DOM module', () => {
    const target = createTarget();
    const list = target.add('list');
    const empty = target.add('empty');
    const meta = target.add('meta');
    const total = target.add('total', createElement('total'));
    const node = createElement('row');
    const bridge = createLegacyUiBridge(target);

    expect(bridge.setHtml('list', '<p>ok</p>')).toBe(list);
    expect(list.innerHTML).toBe('<p>ok</p>');

    expect(bridge.setText('meta', '2 itens')).toBe(meta);
    expect(meta.textContent).toBe('2 itens');

    bridge.setNodes('list', [node, null]);
    expect(list.children).toEqual([node]);

    bridge.renderListState({
      listId: 'list',
      emptyId: 'empty',
      metaId: 'meta',
      nodes: [node],
      hasItems: true,
      metaText: '1 item'
    });
    expect(empty.classList.contains('hidden')).toBe(true);
    expect(meta.textContent).toBe('1 item');

    bridge.renderTotalBox('total', '<strong>R$ 1</strong>', true);
    expect(total.innerHTML).toBe('<strong>R$ 1</strong>');
    bridge.renderTotalBox('total', '<strong>R$ 1</strong>', false);
    expect(total.classList.contains('hidden')).toBe(true);
    expect(total.innerHTML).toBe('');
  });

  it('preserves legacy toast, overlay, sidebar and tab behavior', () => {
    const target = createTarget();
    const toast = target.add('toast');
    const overlay = target.add('modal', createElement('modal'));
    overlay.classList.add('hidden');
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

    const bridge = createLegacyUiBridge(target);
    bridge.showToast('Salvo');
    expect(toast.textContent).toBe('Salvo');
    expect(toast.className).toContain('bg-success');
    expect(toast.classList.contains('hidden')).toBe(true);

    expect(bridge.showOverlay('modal')).toBe(overlay);
    expect(overlay.parentElement).toBe(target.document.body);
    expect(overlay.classList.contains('hidden')).toBe(false);
    bridge.hideOverlay('modal');
    expect(overlay.classList.contains('hidden')).toBe(true);

    expect(bridge.toggleSidebar(false)).toBe(true);
    expect(sidebarOverlay.classList.contains('hidden')).toBe(false);
    expect(sidebar.classList.contains('-translate-x-full')).toBe(false);
    bridge.setSidebarOpen(false);
    expect(sidebarOverlay.classList.contains('hidden')).toBe(true);
    expect(sidebar.classList.contains('-translate-x-full')).toBe(true);

    bridge.updateBackButton(false);
    expect(backButton.classList.contains('hidden')).toBe(true);

    bridge.activateTab('saidas', ['dashboard', 'saidas']);
    expect(saidasButton.className).toContain('bg-accent/10');
    expect(dashboardView.classList.contains('hidden')).toBe(true);
    expect(saidasView.classList.contains('hidden')).toBe(false);
  });

  it('installs only the nested compatibility adapters and re-installs safely', () => {
    const target = createTarget();

    const first = installLegacyUiBridge(target);
    const second = installLegacyUiBridge(target);

    expect(second).toBe(first);
    expect(target.financeUI).toBeUndefined();
    expect(target.financeApp.financeUiAdapters).toBe(first);
  });

  it('does not install without a DOM target', () => {
    expect(installLegacyUiBridge({})).toBeNull();
  });
});
