import { performance } from 'node:perf_hooks';
import { buildPlannerReadModel } from '../src/application/readModels/plannerReadModel.js';

function createRecords(count) {
  const people = ['Jadson', 'Luana', 'Ana', 'Bruno'];
  const records = [];

  for (let index = 0; index < count; index += 1) {
    const month = String((index % 12) + 1).padStart(2, '0');
    const day = String((index % 27) + 1).padStart(2, '0');
    const isExpense = index % 3 !== 0;
    records.push({
      id: `record-${index}`,
      type: isExpense ? 'saida' : 'entrada',
      description: isExpense ? `Conta ${index}` : `Receita ${index}`,
      amount: Number((50 + (index % 500) / 10).toFixed(2)),
      due_date: `2026-${month}-${day}`,
      date: `2026-${month}-${day}`,
      competence: `2026-${month}`,
      person: people[index % people.length],
      status: isExpense && index % 5 === 0 ? 'Pago' : 'Em aberto',
      macro_category: isExpense ? 'FIXO' : 'RENDA',
      subcategory: isExpense ? 'Casa' : 'Extra',
      installment_series_id: isExpense && index % 7 === 0 ? `installment-${Math.floor(index / 7)}` : '',
      recurrence_series_id: isExpense && index % 11 === 0 ? `recurrence-${Math.floor(index / 11)}` : ''
    });
  }

  return records;
}

const sizes = [100, 1000, 5000, 10000];
const results = sizes.map((size) => {
  const records = createRecords(size);
  const started = performance.now();
  const model = buildPlannerReadModel({
    records,
    plannerEvents: [
      { id: 'planner-feriado', date: '2026-06-12', type: 'holiday', title: 'Feriado' },
      { id: 'planner-compromisso', date: '2026-06-15', type: 'commitment', title: 'Compromisso' }
    ],
    filters: { month: '2026-06' }
  });
  return {
    records: size,
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    visibleEventCount: model.metadata.visibleEventCount,
    income: model.summary.income,
    expense: model.summary.expense,
    balance: model.summary.balance
  };
});

console.log(JSON.stringify({ ok: true, wrote: false, results }, null, 2));
