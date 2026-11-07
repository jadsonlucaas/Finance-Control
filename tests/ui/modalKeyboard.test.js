import { describe, expect, it, vi } from 'vitest';
import { closeTopmostModal, findTopmostOpenModal, installModalKeyboard } from '../../src/ui/modalKeyboard.js';

function classList(initial = []) {
  const set = new Set(initial);
  return { contains: (c) => set.has(c), add: (c) => set.add(c), remove: (c) => set.delete(c) };
}

function fakeModal(id, { hidden = false, zIndex = '50', closeButton = true } = {}) {
  const modal = { id, classList: classList(hidden ? ['hidden'] : []), style: { zIndex } };
  modal.closeButton = closeButton ? { click: vi.fn(() => modal.classList.add('hidden')) } : null;
  modal.querySelector = () => modal.closeButton;
  return modal;
}

function fakeDocument(modals) {
  const listeners = {};
  return {
    documentElement: { dataset: {} },
    querySelectorAll: () => modals,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    dispatchKey: (key) => {
      const event = { key, defaultPrevented: false, isComposing: false, preventDefault: vi.fn() };
      listeners.keydown?.(event);
      return event;
    }
  };
}

const view = {
  getComputedStyle: (element) => ({ display: 'flex', visibility: 'visible', position: 'fixed', zIndex: element.style.zIndex })
};

describe('modalKeyboard', () => {
  it('ignores hidden modals and returns null when none is open', () => {
    const doc = fakeDocument([fakeModal('a-modal', { hidden: true })]);
    expect(findTopmostOpenModal(doc, view)).toBeNull();
    expect(closeTopmostModal(doc, view)).toBe(false);
  });

  it('closes the topmost modal through its own close button', () => {
    const lower = fakeModal('planner-modal', { zIndex: '50' });
    const upper = fakeModal('parcelamentos-detail-modal', { zIndex: '300' });
    const doc = fakeDocument([upper, lower]);

    expect(closeTopmostModal(doc, view)).toBe(true);
    expect(upper.closeButton.click).toHaveBeenCalledTimes(1);
    expect(lower.closeButton.click).not.toHaveBeenCalled();
  });

  it('hides a modal that has no close button', () => {
    const modal = fakeModal('delete-person-overlay', { closeButton: false });
    const doc = fakeDocument([modal]);
    expect(closeTopmostModal(doc, view)).toBe(true);
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('wires Escape once and leaves other keys alone', () => {
    const modal = fakeModal('planner-modal');
    const doc = fakeDocument([modal]);
    const target = { document: doc, getComputedStyle: view.getComputedStyle };

    expect(installModalKeyboard(target)).toBe(true);
    expect(installModalKeyboard(target)).toBe(false);

    doc.dispatchKey('Enter');
    expect(modal.closeButton.click).not.toHaveBeenCalled();

    const event = doc.dispatchKey('Escape');
    expect(modal.closeButton.click).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
