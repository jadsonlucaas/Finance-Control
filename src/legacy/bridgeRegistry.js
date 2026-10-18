const BRIDGE_REGISTRY_KEY = Symbol.for('finance.legacyBridgeRegistry');

function getBridgeRegistry(target) {
  if (!target[BRIDGE_REGISTRY_KEY]) {
    Object.defineProperty(target, BRIDGE_REGISTRY_KEY, {
      value: new Map(),
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  return target[BRIDGE_REGISTRY_KEY];
}

function shouldThrowOnCollision(target) {
  return Boolean(target.__financeStrictBridgeCollisions) ||
    (typeof process !== 'undefined' && ['development', 'test'].includes(process.env.NODE_ENV || ''));
}

export function defineLegacyGlobalBridge(target = globalThis, name, value, { canonical = name } = {}) {
  if (!target || !name) throw new Error('LEGACY_BRIDGE_INVALID_TARGET');
  const registry = getBridgeRegistry(target);
  const current = target[name];
  const registered = registry.get(name);

  if (registered && registered.canonical === canonical) {
    if (!Object.is(current, registered.value)) {
      target[name] = registered.value;
    }
    return registered.value;
  }

  if (registered && !Object.is(registered.value, value)) {
    throw new Error(`LEGACY_BRIDGE_COLLISION:${name}:${registered.canonical}->${canonical}`);
  }

  if (current !== undefined && !Object.is(current, value)) {
    const message = `LEGACY_BRIDGE_OVERWRITE:${name}:${canonical}`;
    if (shouldThrowOnCollision(target)) throw new Error(message);
    console.warn?.(message);
  }

  target[name] = value;
  registry.set(name, { name, value, canonical });
  return value;
}

export function getLegacyGlobalBridgeRegistry(target = globalThis) {
  return [...(target?.[BRIDGE_REGISTRY_KEY]?.values?.() || [])].map(({ name, canonical }) => ({ name, canonical }));
}

export function clearLegacyGlobalBridgeRegistryForTests(target = globalThis) {
  target?.[BRIDGE_REGISTRY_KEY]?.clear?.();
}
