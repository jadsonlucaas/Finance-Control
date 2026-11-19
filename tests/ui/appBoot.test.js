import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginDataPending,
  endAppBoot,
  holdViewWhileLoading,
  markFirstDataReceived,
  resetFirstData
} from '../../src/ui/shell/appBoot.js';
import { activateTab } from '../../src/ui/navigationTabs.js';

function classList(initial = []) {
  const set = new Set(initial);
  return {
    add: (name) => set.add(name),
    remove: (name) => set.delete(name),
    contains: (name) => set.has(name),
    toggle: (name, force) => (force ? set.add(name) : set.delete(name)),
    has: (name) => set.has(name)
  };
}

function fakeTarget({ views = [] } = {}) {
  const elements = new Map();
  views.forEach(([id, hidden]) => elements.set(id, { classList: classList(hidden ? ['hidden'] : []) }));
  const main = { scrollTop: 0 };
  elements.set('main-content', main);
  const documentElement = { classList: classList(['h-full', 'app-booting']) };
  return {
    document: {
      documentElement,
      getElementById: (id) => elements.get(id) || null,
      querySelectorAll: () => [],
      querySelector: (selector) => ([...elements.values()].some((el) => el.classList?.has?.(selector.replace('.', ''))) ? {} : null)
    },
    elements,
    main
  };
}

afterEach(() => vi.useRealTimers());

describe('abertura sem piscar', () => {
  it('tira a tela de carregamento quando a sessao e conferida', () => {
    const target = fakeTarget();
    endAppBoot(target);
    expect(target.document.documentElement.classList.has('app-booting')).toBe(false);
  });

  it('esconde o conteudo ate a primeira leitura dos lancamentos e nao volta a esconder depois', () => {
    vi.useFakeTimers();
    const target = fakeTarget();
    const root = target.document.documentElement.classList;
    beginDataPending(target);
    expect(root.has('finance-data-pending')).toBe(true);
    markFirstDataReceived(target);
    expect(root.has('finance-data-pending')).toBe(false);
    beginDataPending(target);
    expect(root.has('finance-data-pending')).toBe(false);
    resetFirstData(target);
    beginDataPending(target);
    expect(root.has('finance-data-pending')).toBe(true);
  });

  it('libera o conteudo sozinho se os dados nao chegarem', () => {
    vi.useFakeTimers();
    const target = fakeTarget();
    beginDataPending(target);
    vi.advanceTimersByTime(10000);
    expect(target.document.documentElement.classList.has('finance-data-pending')).toBe(false);
  });

  it('segura uma tela enquanto o modulo dela carrega', () => {
    vi.useFakeTimers();
    const target = fakeTarget({ views: [['view-configuracoes', false]] });
    const view = target.elements.get('view-configuracoes');
    const release = holdViewWhileLoading(target, 'view-configuracoes');
    expect(view.classList.has('view-loading')).toBe(true);
    expect(target.document.documentElement.classList.has('finance-view-loading')).toBe(true);
    release();
    expect(view.classList.has('view-loading')).toBe(false);
    expect(target.document.documentElement.classList.has('finance-view-loading')).toBe(false);
  });
});

describe('troca de aba', () => {
  it('abre a nova tela no topo e mantem a rolagem ao redesenhar a mesma tela', () => {
    const target = fakeTarget({ views: [['view-dashboard', false], ['view-configuracoes', true]] });
    const views = ['dashboard', 'configuracoes'];
    target.main.scrollTop = 400;
    activateTab('dashboard', target, views);
    expect(target.main.scrollTop).toBe(400);
    activateTab('configuracoes', target, views);
    expect(target.main.scrollTop).toBe(0);
    expect(target.elements.get('view-configuracoes').classList.has('hidden')).toBe(false);
    expect(target.elements.get('view-dashboard').classList.has('hidden')).toBe(true);
  });
});
