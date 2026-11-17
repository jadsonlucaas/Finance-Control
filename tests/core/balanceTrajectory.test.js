import { describe, expect, it } from 'vitest';
import { buildBalanceTrajectory } from '../../src/application/selectors/balanceTrajectory.js';

const saida = (amount, status, date, extra = {}) => ({ type: 'saida', amount, status, occurred_date: date, due_date: date, ...extra });
const entrada = (amount, date) => ({ type: 'entrada', amount, status: 'Pago', occurred_date: date });

describe('trajetoria do saldo no mes', () => {
  it('acumula ate hoje e projeta as saidas em aberto pelo vencimento', () => {
    const result = buildBalanceTrajectory({
      month: '2026-11',
      today: '2026-11-16',
      entradas: [entrada(4200, '2026-11-05')],
      saidas: [saida(100, 'Pago', '2026-11-02'), saida(1200, 'Em aberto', '2026-11-18', { occurred_date: '2026-11-01' })]
    });
    expect(result.lastDay).toBe(30);
    expect(result.points).toHaveLength(30);
    expect(result.points[0].balance).toBe(0);
    expect(result.points[3].balance).toBe(-100);
    expect(result.current).toBe(4100);
    expect(result.projectedEnd).toBe(2900);
    expect(result.points[16].projected).toBe(true);
    expect(result.biggestUpcoming).toEqual({ day: 18, amount: 1200 });
    expect(result.openTotal).toBe(1200);
    expect(result.openCount).toBe(1);
  });

  it('mes passado fica todo realizado; mes futuro todo previsto; sem data cai no dia 1', () => {
    const past = buildBalanceTrajectory({ month: '2026-10', today: '2026-11-16', saidas: [saida(50, 'Pago', '')] });
    expect(past.todayDay).toBe(31);
    expect(past.points.every((point) => !point.projected)).toBe(true);
    expect(past.points[0].balance).toBe(-50);
    const future = buildBalanceTrajectory({ month: '2026-12', today: '2026-11-16', saidas: [saida(80, 'Em aberto', '2026-12-10')] });
    expect(future.todayDay).toBe(0);
    expect(future.current).toBe(0);
    expect(future.projectedEnd).toBe(-80);
  });

  it('ignora mes invalido e entradas ainda nao recebidas', () => {
    expect(buildBalanceTrajectory({ month: '11/2026', today: '2026-11-16' })).toBeNull();
    const result = buildBalanceTrajectory({ month: '2026-11', today: '2026-11-16', entradas: [{ amount: 10, status: 'Em aberto', occurred_date: '2026-11-01' }] });
    expect(result.projectedEnd).toBe(0);
  });
});
