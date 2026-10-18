import { describe, expect, it } from 'vitest';
import {
  clearLegacyGlobalBridgeRegistryForTests,
  defineLegacyGlobalBridge,
  getLegacyGlobalBridgeRegistry
} from '../../src/legacy/bridgeRegistry.js';

describe('legacy global bridge registry', () => {
  it('installs bridges idempotently and records canonical source', () => {
    const target = {};
    const canonical = () => 'ok';

    const first = defineLegacyGlobalBridge(target, 'canonicalBridge', canonical, {
      canonical: 'src/domain/example.js:canonical'
    });
    const second = defineLegacyGlobalBridge(target, 'canonicalBridge', canonical, {
      canonical: 'src/domain/example.js:canonical'
    });

    expect(first).toBe(canonical);
    expect(second).toBe(canonical);
    expect(target.canonicalBridge()).toBe('ok');
    expect(getLegacyGlobalBridgeRegistry(target)).toEqual([
      { name: 'canonicalBridge', canonical: 'src/domain/example.js:canonical' }
    ]);
  });

  it('rejects incompatible bridge overwrite in strict mode', () => {
    const target = { __financeStrictBridgeCollisions: true };
    defineLegacyGlobalBridge(target, 'duplicatedBridge', () => 'first', {
      canonical: 'src/domain/first.js'
    });

    expect(() => defineLegacyGlobalBridge(target, 'duplicatedBridge', () => 'second', {
      canonical: 'src/domain/second.js'
    })).toThrow('LEGACY_BRIDGE_COLLISION:duplicatedBridge');
  });

  it('does not overwrite an already installed compatible bridge', () => {
    const target = {};
    const first = () => 'first';
    const second = () => 'second';

    defineLegacyGlobalBridge(target, 'stableBridge', first, {
      canonical: 'src/domain/stable.js'
    });
    const installed = defineLegacyGlobalBridge(target, 'stableBridge', second, {
      canonical: 'src/domain/stable.js'
    });

    expect(installed).toBe(first);
    expect(target.stableBridge()).toBe('first');
    expect(getLegacyGlobalBridgeRegistry(target)).toEqual([
      { name: 'stableBridge', canonical: 'src/domain/stable.js' }
    ]);
  });

  it('restores the canonical bridge when a classic script overwrites the global', () => {
    const target = {};
    const canonical = () => 'canonical';

    defineLegacyGlobalBridge(target, 'classicBridge', canonical, {
      canonical: 'src/domain/classic.js'
    });
    target.classicBridge = () => 'legacy';

    const installed = defineLegacyGlobalBridge(target, 'classicBridge', () => 'ignored', {
      canonical: 'src/domain/classic.js'
    });

    expect(installed).toBe(canonical);
    expect(target.classicBridge()).toBe('canonical');
    expect(getLegacyGlobalBridgeRegistry(target)).toEqual([
      { name: 'classicBridge', canonical: 'src/domain/classic.js' }
    ]);
  });

  it('keeps removed bridges out of the registry after cleanup', () => {
    const target = {};
    defineLegacyGlobalBridge(target, 'removedBridge', () => 'value', {
      canonical: 'src/domain/removed.js'
    });
    clearLegacyGlobalBridgeRegistryForTests(target);

    expect(getLegacyGlobalBridgeRegistry(target)).toEqual([]);
    expect(target.removedBridge()).toBe('value');
  });

  it('allows cleanup in tests', () => {
    const target = {};
    defineLegacyGlobalBridge(target, 'temporaryBridge', () => null, {
      canonical: 'src/domain/temp.js'
    });

    clearLegacyGlobalBridgeRegistryForTests(target);

    expect(getLegacyGlobalBridgeRegistry(target)).toEqual([]);
  });
});
