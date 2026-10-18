import { describe, expect, it } from 'vitest';
import { buildDashboardInstallmentSummary, getDashboardInstallmentRecords } from '../../src/ui/dashboard/dashboardCards.js';
import { isInstallmentRecord } from '../../src/domain/installments.js';
import { buildParcelamentosMonthlyChartData } from '../../src/ui/records/parcelamentosRenderer.js';

describe('dashboard installment summary', () => {
  it('uses only installment records and ignores paid parcels in future totals', () => {
    const records = [
      { id: 'a1', type: 'saida', is_installment: true, parent_id: 'buy-a', description: 'Notebook', person: 'Ana', payment_method: 'Visa', installment_no: 1, total_installments: 3, competence: '2026-05', due_date: '2026-05-10', amount: 100, status: 'Pago' },
      { id: 'a2', type: 'saida', is_installment: true, parent_id: 'buy-a', description: 'Notebook', person: 'Ana', payment_method: 'Visa', installment_no: 2, total_installments: 3, competence: '2026-06', due_date: '2026-06-10', amount: 100, status: 'Em aberto' },
      { id: 'a3', type: 'saida', is_installment: true, parent_id: 'buy-a', description: 'Notebook', person: 'Ana', payment_method: 'Visa', installment_no: 3, total_installments: 3, competence: '2026-07', due_date: '2026-07-10', amount: 100, status: 'Em aberto' },
      { id: 'b1', type: 'saida', is_installment: false, description: 'Conta comum', competence: '2026-06', amount: 999, status: 'Em aberto' },
      { id: 'dup', type: 'saida', is_installment: true, parent_id: 'buy-b', description: 'Curso', installment_no: 1, total_installments: 2, competence: '2026-05', amount: 50, status: 'Em aberto' },
      { id: 'dup', type: 'saida', is_installment: true, parent_id: 'buy-b', description: 'Curso', installment_no: 1, total_installments: 2, competence: '2026-05', amount: 50, status: 'Em aberto' }
    ];

    const summary = buildDashboardInstallmentSummary(records, '2026-05');

    expect(getDashboardInstallmentRecords(records)).toHaveLength(4);
    expect(summary.monthRecords).toHaveLength(2);
    expect(summary.monthTotal).toBe(150);
    expect(summary.monthPaidTotal).toBe(100);
    expect(summary.monthOpenTotal).toBe(50);
    expect(summary.monthPaidCount).toBe(1);
    expect(summary.monthOpenCount).toBe(1);
    expect(summary.totalFutureCommitted).toBe(250);
    expect(summary.groupList.find((group) => group.parentId === 'buy-a')).toMatchObject({
      paidAmount: 100,
      remainingAmount: 200,
      paidCount: 1,
      remainingCount: 2,
      actionRecordId: 'a2',
      progress: 33,
      status: 'ativo'
    });
  });

  it('recognizes legacy installment shapes', () => {
    const base = { type: 'saida', description: 'Compra antiga', amount: 10 };

    expect(isInstallmentRecord({ ...base, total_installments: 3 })).toBe(true);
    expect(isInstallmentRecord({ ...base, installment_no: 1 })).toBe(true);
    expect(isInstallmentRecord({ ...base, parent_id: 'legacy-parent' })).toBe(true);
    expect(isInstallmentRecord({ ...base, parcela_atual: 2, total_parcelas: 6 })).toBe(true);
    expect(isInstallmentRecord({ ...base, installments: 4 })).toBe(true);
    expect(isInstallmentRecord({ ...base, tipoDespesa: 'Parcelada' })).toBe(true);
    expect(isInstallmentRecord({ ...base, tipo: 'Parcelada' })).toBe(true);
    expect(isInstallmentRecord({ ...base, payment_type: 'installment' })).toBe(true);
    expect(isInstallmentRecord({ ...base, purchase_parent_id: 'old-parent' })).toBe(true);
    expect(isInstallmentRecord({ ...base, is_installment: false })).toBe(false);
  });

  it('keeps legacy records visible and labels missing card data', () => {
    const records = [
      { id: 'legacy-1', type: 'saida', parent_id: 'legacy-buy', description: 'Sofa (1/2)', installment_no: 1, total_installments: 2, competence: '2026-05', amount: 80, status: '' },
      { id: 'legacy-2', type: 'saida', parent_id: 'legacy-buy', description: 'Sofa (2/2)', installment_no: 2, total_installments: 2, competence: '2026-06', amount: 80 },
      { id: 'new-1', type: 'saida', is_installment: true, parent_id: 'new-buy', description: 'Mesa (1/2)', installment_no: 1, total_installments: 2, competence: '2026-05', amount: 40, status: 'Pago' }
    ];

    const summary = buildDashboardInstallmentSummary(records, '2026-05');

    expect(getDashboardInstallmentRecords(records)).toHaveLength(3);
    expect(summary.totalFutureCommitted).toBe(160);
    expect(summary.groupList.find((group) => group.parentId === 'legacy-buy')).toMatchObject({
      card: 'Nao informado',
      remainingAmount: 160,
      remainingCount: 2,
      status: 'ativo'
    });
  });
});

describe('parcelamentos monthly chart data', () => {
  it('groups filtered installment groups by month for the visual chart', () => {
    const groups = [
      {
        installments: [
          { competence: '2026-05', amount: 100 },
          { competence: '2026-06', amount: 150 }
        ]
      },
      {
        installments: [
          { due_date: '2026-05-20', amount: 50 }
        ]
      }
    ];

    const data = buildParcelamentosMonthlyChartData(groups, { formatCompetence: (value) => value });

    expect(data).toEqual({
      months: ['2026-05', '2026-06'],
      labels: ['2026-05', '2026-06'],
      values: [150, 150],
      total: 300
    });
  });
});
