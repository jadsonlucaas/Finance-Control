import { performance } from 'node:perf_hooks';

function makeRecords(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `record-${index}`,
    type: index % 3 === 0 ? 'entrada' : 'saida',
    person: index % 2 === 0 ? 'Ana' : 'Bruno',
    amount: (index % 17) + 10,
    competence: index % 2 === 0 ? '2026-08' : '2026-07',
    status: index % 5 === 0 ? 'Pago' : 'Em aberto'
  }));
}

function aggregate(records, filters = {}) {
  return records.reduce((acc, record) => {
    if (filters.person && record.person !== filters.person) return acc;
    if (filters.competence && record.competence !== filters.competence) return acc;
    const amount = Number(record.amount || 0);
    if (record.type === 'entrada') acc.income += amount;
    if (record.type === 'saida') acc.expense += amount;
    acc.count += 1;
    return acc;
  }, { income: 0, expense: 0, count: 0 });
}

const sizes = [100, 1000, 5000, 10000];
const results = sizes.map((size) => {
  const prepareStart = performance.now();
  const records = makeRecords(size);
  const preparedMs = Number((performance.now() - prepareStart).toFixed(3));
  const aggregateStart = performance.now();
  const totals = aggregate(records, { competence: '2026-08' });
  const aggregationMs = Number((performance.now() - aggregateStart).toFixed(3));
  const filterStart = performance.now();
  const filtered = aggregate(records, { competence: '2026-08', person: 'Ana' });
  const filterMs = Number((performance.now() - filterStart).toFixed(3));
  const durationMs = Number((preparedMs + aggregationMs + filterMs).toFixed(3));
  return {
    size,
    durationMs,
    preparedMs,
    aggregationMs,
    filterMs,
    totalRecordsConsidered: records.length,
    firstPageUsedForKpi: false,
    totals,
    filtered
  };
});

console.log(JSON.stringify({ ok: true, wrote: false, results }, null, 2));
