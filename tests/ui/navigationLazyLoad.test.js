import { describe, expect, it, vi } from 'vitest';
import { installParcelamentosLazyLoader } from '../../src/app.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushAsyncTurns(count = 4) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function createTarget() {
  const target = {
    currentTab: 'dashboard',
    currentUser: { uid: 'uid-a', email: 'ana@example.test' },
    allRecords: [{ id: 'a-private', owner_uid: 'uid-a', description: 'Ana privado' }],
    document: { getElementById: () => null },
    location: { hash: '#/dashboard' },
    financeApp: {
      resilience: {
        errorReporter: { report: vi.fn() }
      }
    },
    showToast: vi.fn(),
    switchTab(tab) {
      target.currentTab = tab;
      target.location.hash = `#/${tab}`;
      return `switched:${tab}`;
    }
  };
  return target;
}

describe('navigation lazy-load stale completions', () => {
  it('keeps C active when delayed B resolves after A -> B -> C navigation', async () => {
    const target = createTarget();
    const delayedParcelamentos = deferred();
    const renderCalls = [];
    target.financeApp.parcelamentosRendererLoader = vi.fn(() => delayedParcelamentos.promise);

    installParcelamentosLazyLoader(target);

    expect(target.switchTab('parcelamentos', { fromRouter: true })).toBe('switched:parcelamentos');
    expect(target.currentTab).toBe('parcelamentos');
    expect(target.switchTab('controle-horas', { fromRouter: true })).toBe('switched:controle-horas');

    delayedParcelamentos.resolve({
      installParcelamentosRenderer: (installTarget) => {
        installTarget.renderParcelamentos = vi.fn(() => {
          renderCalls.push(installTarget.currentTab);
        });
        return { installed: true };
      }
    });
    await delayedParcelamentos.promise;
    await flushAsyncTurns();

    expect(target.currentTab).toBe('controle-horas');
    expect(target.location.hash).toBe('#/controle-horas');
    expect(renderCalls).toEqual([]);
  });

  it('does not reactivate a lazy tab abandoned before its loader finishes', async () => {
    const target = createTarget();
    const delayedParcelamentos = deferred();
    target.financeApp.parcelamentosRendererLoader = vi.fn(() => delayedParcelamentos.promise);

    installParcelamentosLazyLoader(target);

    target.switchTab('parcelamentos', { fromRouter: true });
    target.switchTab('saidas', { fromRouter: true });

    delayedParcelamentos.resolve({
      installParcelamentosRenderer: (installTarget) => {
        installTarget.renderParcelamentos = vi.fn(() => {
          installTarget.currentTab = 'parcelamentos';
        });
        return { installed: true };
      }
    });
    await delayedParcelamentos.promise;
    await flushAsyncTurns();

    expect(target.currentTab).toBe('saidas');
    expect(target.location.hash).toBe('#/saidas');
  });

  it('uses the current session state when an old lazy load resolves on the same route', async () => {
    const target = createTarget();
    const delayedParcelamentos = deferred();
    const renderedOwners = [];
    target.financeApp.parcelamentosRendererLoader = vi.fn(() => delayedParcelamentos.promise);

    installParcelamentosLazyLoader(target);

    target.switchTab('parcelamentos', { fromRouter: true });
    target.currentUser = { uid: 'uid-b', email: 'bruno@example.test' };
    target.allRecords = [{ id: 'b-private', owner_uid: 'uid-b', description: 'Bruno privado' }];

    delayedParcelamentos.resolve({
      installParcelamentosRenderer: (installTarget) => {
        installTarget.renderParcelamentos = vi.fn(() => {
          renderedOwners.push({
            uid: installTarget.currentUser.uid,
            owners: installTarget.allRecords.map((record) => record.owner_uid)
          });
        });
        return { installed: true };
      }
    });
    await delayedParcelamentos.promise;
    await flushAsyncTurns();

    expect(renderedOwners).toEqual([{ uid: 'uid-b', owners: ['uid-b'] }]);
  });

  it('keeps shell usable after lazy failure and retries once without duplicate wrappers', async () => {
    const target = createTarget();
    let attempt = 0;
    const renderCalls = [];
    target.financeApp.parcelamentosRendererLoader = vi.fn(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new Error('chunk failed'));
      return Promise.resolve({
        installParcelamentosRenderer: (installTarget) => {
          installTarget.renderParcelamentos = vi.fn(() => renderCalls.push(installTarget.currentTab));
          return { installed: true };
        }
      });
    });

    installParcelamentosLazyLoader(target);
    const wrappedSwitchTab = target.switchTab;
    installParcelamentosLazyLoader(target);
    expect(target.switchTab).toBe(wrappedSwitchTab);

    target.switchTab('parcelamentos', { fromRouter: true });
    await flushAsyncTurns();

    expect(target.showToast).toHaveBeenCalledTimes(1);
    expect(target.financeApp.parcelamentosRendererLoader).toHaveBeenCalledTimes(1);
    expect(target.currentTab).toBe('parcelamentos');

    target.switchTab('parcelamentos', { fromRouter: true });
    await flushAsyncTurns();

    expect(target.financeApp.parcelamentosRendererLoader).toHaveBeenCalledTimes(2);
    expect(renderCalls).toEqual(['parcelamentos']);
  });
});
