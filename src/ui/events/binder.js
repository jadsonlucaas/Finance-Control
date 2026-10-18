export const boundKey = 'financeEventsBound';

const binderState = {
  target: window // Fallback if not specified
};

export function setBinderTarget(target) {
  binderState.target = target;
}

export function invoke(name, ...args) {
  const target = binderState.target;
  const fn = target[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

function byId(id) {
  return binderState.target.document.getElementById(id);
}

export function bind(id, eventName, handler) {
  const element = byId(id);
  if (!element || element.dataset[boundKey + eventName]) return;
  element.dataset[boundKey + eventName] = 'true';
  element.addEventListener(eventName, handler);
}

export function bindClick(id, handler) {
  bind(id, 'click', handler);
}

export function bindChange(id, handler) {
  bind(id, 'change', handler);
}

export function bindInput(id, handler) {
  bind(id, 'input', handler);
}

export function bindSubmit(id, handler) {
  bind(id, 'submit', handler);
}
