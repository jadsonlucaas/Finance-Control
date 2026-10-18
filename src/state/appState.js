export const listeners = {};

export function subscribe(key, callback) {
  if (!listeners[key]) listeners[key] = new Set();
  listeners[key].add(callback);
  return () => listeners[key].delete(callback);
}

function notify(key, value) {
  if (listeners[key]) {
    listeners[key].forEach(cb => cb(value));
  }
  if (listeners['*']) {
    listeners['*'].forEach(cb => cb(key, value));
  }
}

// Handler for the core state proxy
const stateHandler = {
  set(target, prop, value) {
    const oldValue = target[prop];
    if (oldValue !== value) {
      target[prop] = value;
      notify(prop, value);
    }
    return true;
  }
};

export const appStateRaw = {
  allRecords: [],
  currentTab: 'dashboard',
  chartInstances: {},
  editingRecordId: null,
  focusedDashboardCard: null
};

// Our reactive state
export const appState = new Proxy(appStateRaw, stateHandler);

const LEGACY_STATE_DEFAULTS = {
  allRecords: () => [],
  currentTab: () => 'dashboard',
  chartInstances: () => ({}),
  editingRecordId: () => null,
  focusedDashboardCard: () => null
};

function normalizeStateValue(name, value) {
  if (name === 'allRecords') return Array.isArray(value) ? value : [];
  if (name === 'chartInstances') return value && typeof value === 'object' ? value : {};
  if (name === 'currentTab') return value || 'dashboard';
  return value ?? null;
}

export function installAppStateGlobals(target = globalThis, state = appState) {
  if (!target) return state;

  for (const [name, createDefault] of Object.entries(LEGACY_STATE_DEFAULTS)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    const existingValue = descriptor && 'value' in descriptor ? descriptor.value : target[name];
    state[name] = normalizeStateValue(name, existingValue ?? state[name] ?? createDefault());

    if (descriptor?.get && descriptor?.set && descriptor.get.__financeAppStateGetter) continue;

    const getter = function getLegacyStateValue() {
      return state[name];
    };
    getter.__financeAppStateGetter = true;

    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: true,
      get: getter,
      set(value) {
        state[name] = normalizeStateValue(name, value);
      }
    });
  }

  target.appState = state;
  target.subscribeState = subscribe;
  target.financeState = {
    appState: state,
    subscribeState: subscribe,
    installAppStateGlobals
  };

  return state;
}
