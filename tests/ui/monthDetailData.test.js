import { describe, expect, it } from 'vitest';
import { getMonthlyDetailFilteredRecords } from '../../src/ui/monthDetail/monthDetailData.js';

function createTarget({
  transactionRecords = [],
  dashboardSaidas = [],
  person = '',
  macro = '',
  cycle = ''
} = {}) {
  return {
    __financeDataVersion: 1,
    getTransactionRecords() {
      return transactionRecords;
    },
    getDashboardBaseSaidas() {
      return dashboardSaidas;
    },
    document: {
      getElementById(id) {
        if (id === 'f-person') return { value: person };
        if (id === 'f-macro') return { value: macro };
        if (id === 'f-cycle') return { value: cycle };
        return { value: '' };
      }
    }
  };
}

describe('month detail data', () => {
  it('merges official dashboard expenses so generated percentage rules appear in the month detail', () => {
    const target = createTarget({
      transactionRecords: [
        {
          id: 'saida-real-1',
          type: 'saida',
          person: 'Jadson',
          competence: '2027-05',
          description: 'Disney Plus + HBO MAX',
          amount: 100,
          status: 'Em aberto',
          cycle: 'INICIO_MES'
        }
      ],
      dashboardSaidas: [
        {
          id: 'saida-real-1',
          type: 'saida',
          person: 'Jadson',
          competence: '2027-05',
          description: 'Disney Plus + HBO MAX',
          amount: 100,
          status: 'Em aberto',
          cycle: 'INICIO_MES'
        },
        {
          id: 'regra-perc-1',
          type: 'saida',
          person: 'Jadson',
          competence: '2027-05',
          description: 'Dizimo (5,00%)',
          amount: 265,
          status: 'Em aberto',
          cycle: 'INICIO_MES',
          generated_percentage_rule: true,
          virtual_record: true
        }
      ]
    });

    const records = getMonthlyDetailFilteredRecords('2027-05', target);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.description)).toEqual([
      'Disney Plus + HBO MAX',
      'Dizimo (5,00%)'
    ]);
  });
});
