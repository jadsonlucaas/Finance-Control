import { describe, expect, it } from 'vitest';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';

async function waitFor(assertion, timeoutMs = 2000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe('runtime subscription lifecycle', () => {
  it('closes Firebase adapter subscriptions before opening the next owner listener', async () => {
    const activeOwners = new Set();
    const calls = [];
    const subscriptionSdk = {
      subscribe(query, listener, context) {
        activeOwners.add(context.ownerUid);
        calls.push({ action: 'subscribe', ownerUid: context.ownerUid, query });
        listener([{ id: `${context.ownerUid}-record`, owner_uid: context.ownerUid }]);
        return () => {
          activeOwners.delete(context.ownerUid);
          calls.push({ action: 'unsubscribe', ownerUid: context.ownerUid });
        };
      }
    };
    const dependencies = createApplicationDependencies({
      mode: 'web',
      financeRecordDataSdk: { create: () => ({ success: true }) },
      subscriptionSdk,
      recordsProvider: () => []
    });
    const received = [];

    const unsubscribeOwnerA = dependencies.repositories.financeRecordSubscriptions.subscribe(
      { type: 'saida' },
      (items) => received.push(items),
      { actorUid: 'owner-a', ownerUid: 'owner-a', accountStatus: 'active' }
    );
    await waitFor(() => expect(activeOwners.has('owner-a')).toBe(true));

    unsubscribeOwnerA();
    const unsubscribeOwnerB = dependencies.repositories.financeRecordSubscriptions.subscribe(
      { type: 'saida' },
      (items) => received.push(items),
      { actorUid: 'owner-b', ownerUid: 'owner-b', accountStatus: 'active' }
    );
    await waitFor(() => expect(activeOwners.has('owner-b')).toBe(true));

    expect(activeOwners.has('owner-a')).toBe(false);
    expect(activeOwners.has('owner-b')).toBe(true);
    expect(received.flat().every((item) => item.owner_uid !== 'owner-a' || !activeOwners.has('owner-a'))).toBe(true);

    unsubscribeOwnerB();
    expect(activeOwners.size).toBe(0);
    expect(calls.map((call) => `${call.action}:${call.ownerUid}`)).toEqual([
      'subscribe:owner-a',
      'unsubscribe:owner-a',
      'subscribe:owner-b',
      'unsubscribe:owner-b'
    ]);
  });
});
