import { describe, expect, it } from 'vitest';
import { splitMoney } from '../../src/ui/dashboard/balanceTrajectoryCard.js';

describe('valor com centavos sobrescritos', () => {
  it('separa reais e centavos em BRL e EUR', () => {
    expect(splitMoney('R$ 1.234,56')).toEqual({ main: 'R$ 1.234', cents: ',56', suffix: '' });
    expect(splitMoney('-R$ 80,00')).toEqual({ main: '-R$ 80', cents: ',00', suffix: '' });
    expect(splitMoney('1.234,56 €')).toEqual({ main: '1.234', cents: ',56', suffix: ' €' });
  });

  it('devolve o texto inteiro quando nao ha centavos', () => {
    expect(splitMoney('R$ 10')).toEqual({ main: 'R$ 10', cents: '', suffix: '' });
  });
});
