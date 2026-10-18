import { describe, expect, it } from 'vitest';
import { appState, installAppStateGlobals } from '../../src/state/appState.js';

describe('appState', () => {
  it('defines the transitional global state shape', () => {
    expect(appState).toEqual({
      allRecords: expect.any(Array),
      currentTab: expect.any(String),
      chartInstances: expect.any(Object),
      editingRecordId: null,
      focusedDashboardCard: null
    });
  });

  it('installs window-compatible accessors backed by the store', () => {
    const state = {
      allRecords: [],
      currentTab: 'dashboard',
      chartInstances: {},
      editingRecordId: null,
      focusedDashboardCard: null
    };
    const target = {};

    installAppStateGlobals(target, state);

    target.allRecords = [{ id: 'record-1' }];
    target.currentTab = 'entradas';
    target.chartInstances = { trend: { id: 'chart' } };
    target.editingRecordId = 'record-1';
    target.focusedDashboardCard = 'saldo';

    expect(state.allRecords).toEqual([{ id: 'record-1' }]);
    expect(state.currentTab).toBe('entradas');
    expect(state.chartInstances.trend.id).toBe('chart');
    expect(state.editingRecordId).toBe('record-1');
    expect(state.focusedDashboardCard).toBe('saldo');
    expect(target.appState).toBe(state);
    expect(target.financeState.appState).toBe(state);
  });

  it('preserves an existing legacy value while installing accessors', () => {
    const target = {
      allRecords: [{ id: 'legacy' }],
      currentTab: 'configuracoes',
      chartInstances: { category: true }
    };
    const state = {};

    installAppStateGlobals(target, state);

    expect(state.allRecords).toEqual([{ id: 'legacy' }]);
    expect(state.currentTab).toBe('configuracoes');
    expect(state.chartInstances).toEqual({ category: true });
  });
});
