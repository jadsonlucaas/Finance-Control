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

  it('usa o liquido das entradas calculadas, como o total Entradas do Dashboard', () => {
    const result = buildBalanceTrajectory({
      month: '2026-11',
      today: '2026-11-18',
      entradas: [{ type: 'entrada', person: 'Jadson', cardLiquido: 5268.74, liquido: 9999, competence: '2026-11' }],
      saidas: [saida(1393.29, 'Pago', '2026-11-05'), saida(2806, 'Em aberto', '2026-11-10')]
    });
    expect(result.current).toBe(1069.45);
    expect(result.projectedEnd).toBe(1069.45);
  });

  it('ignora mes invalido e entradas ainda nao recebidas', () => {
    expect(buildBalanceTrajectory({ month: '11/2026', today: '2026-11-16' })).toBeNull();
    const result = buildBalanceTrajectory({ month: '2026-11', today: '2026-11-16', entradas: [{ amount: 10, status: 'Em aberto', occurred_date: '2026-11-01' }] });
    expect(result.projectedEnd).toBe(0);
  });
});

describe('barras de gastos do dia no grafico do saldo', async () => {
  const { dailyBars, trajectoryPaths } = await import('../../src/ui/dashboard/balanceTrajectoryCard.js');
  const trajectory = buildBalanceTrajectory({ month: '2026-11', today: '2026-11-16', saidas: [] });
  const values = new Array(30).fill(0);
  values[0] = 6000;
  values[13] = 300;
  values[19] = 150;

  it('desenha so os dias com gasto, o maior ocupando a faixa de baixo inteira', () => {
    const { bars } = dailyBars(values, trajectory, 600, 168);
    expect(bars.map((bar) => bar.day)).toEqual([1, 14, 20]);
    const base = 168 - 26;
    bars.forEach((bar) => expect(bar.y + bar.height).toBeCloseTo(base, 5));
    expect(bars[0].height).toBeGreaterThan(bars[1].height);
    expect(bars[1].height).toBeGreaterThanOrEqual(2);
    expect(bars.find((bar) => bar.day === 20).future).toBe(true);
    expect(bars.find((bar) => bar.day === 14).future).toBe(false);
  });

  it('barras ficam alinhadas com os pontos da linha do saldo', () => {
    const { bars } = dailyBars(values, trajectory, 600, 168);
    const { coords } = trajectoryPaths(trajectory, 600, 168);
    bars.forEach((bar) => expect(bar.x + bar.width / 2).toBeCloseTo(coords[bar.day - 1][0], 5));
  });

  it('sem gastos nao desenha barras', () => {
    expect(dailyBars(new Array(30).fill(0), trajectory, 600, 168).bars).toEqual([]);
  });
});
