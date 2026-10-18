import { describe, expect, it, vi } from 'vitest';
import { createDashboardController } from '../../src/ui/dashboard/dashboardController.js';
import { createApplicationError, APPLICATION_ERROR_CODES } from '../../src/application/resilience/applicationError.js';

function presenter() {
  return { render: vi.fn() };
}

describe('dashboard controller', () => {
  it('renders loading and success states', async () => {
    const ui = presenter();
    const controller = createDashboardController({
      presenter: ui,
      readSource: { read: vi.fn().mockResolvedValue({ records: [] }) },
      readModel: vi.fn().mockReturnValue({ rows: [] })
    });

    const state = await controller.load({ start: '2026-06', end: '2026-06' });

    expect(ui.render.mock.calls[0][0].status).toBe('loading');
    expect(state.status).toBe('success');
  });

  it('renders empty when read model has no payload', async () => {
    const ui = presenter();
    const controller = createDashboardController({
      presenter: ui,
      readSource: { read: vi.fn().mockResolvedValue({ records: [] }) },
      readModel: vi.fn().mockReturnValue(null)
    });

    const state = await controller.load();

    expect(state.status).toBe('empty');
  });

  it('normalizes errors and exposes retry state', async () => {
    const ui = presenter();
    const capture = vi.fn();
    const controller = createDashboardController({
      presenter: ui,
      errorReporter: { capture },
      readSource: {
        read: vi.fn().mockRejectedValue(createApplicationError({
          code: APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE,
          category: 'NETWORK',
          severity: 'warning',
          retryable: true
        }))
      }
    });

    const state = await controller.load();

    expect(state.status).toBe('error');
    expect(state.retryAvailable).toBe(true);
    expect(capture).toHaveBeenCalledOnce();
  });

  it('renders offline without reading the source', async () => {
    const ui = presenter();
    const read = vi.fn();
    const controller = createDashboardController({
      presenter: ui,
      connectivity: { isOnline: () => false },
      readSource: { read }
    });

    const state = await controller.load();

    expect(state.status).toBe('offline');
    expect(read).not.toHaveBeenCalled();
  });

  it('reuses filter loading and cleans subscriptions explicitly', async () => {
    const read = vi.fn().mockResolvedValue({ records: [] });
    const controller = createDashboardController({ readSource: { read }, presenter: presenter() });
    const unsubscribe = vi.fn();

    controller.subscribe(() => unsubscribe);
    await controller.setFilters({ person: 'Ana' });

    expect(read).toHaveBeenLastCalledWith({ person: 'Ana' });
    expect(controller.getSubscriptionCount()).toBe(1);
    controller.destroy();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(controller.getSubscriptionCount()).toBe(0);
  });
});
