import { performance } from 'node:perf_hooks';
import { buildFinancialReportReadModel } from '../src/application/readModels/financialReportReadModel.js';

function records(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `pdf-record-${index}`,
    type: index % 3 === 0 ? 'entrada' : 'saida',
    owner_uid: 'pdf-bench',
    person: index % 2 === 0 ? 'Ana' : 'Jadson',
    amount: (index % 40) + 10,
    cardLiquido: index % 3 === 0 ? (index % 40) + 10 : undefined,
    competence: '2026-08',
    due_date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    status: index % 4 === 0 ? 'Em aberto' : 'Pago',
    macro_category: index % 5 === 0 ? 'Fixo' : 'Variavel',
    schema_version: 1
  }));
}

const results = [];

for (const size of [100, 1000, 5000]) {
  const source = records(size);
  const started = performance.now();
  const report = buildFinancialReportReadModel({
    financeRecords: source,
    filters: { start: '2026-08', end: '2026-08' },
    userContext: { ownerUid: 'pdf-bench' },
    options: { generatedAt: '2026-09-08T12:00:00.000Z' }
  });
  const reportModelMs = performance.now() - started;

  const serializationStarted = performance.now();
  const serialized = JSON.stringify(report);
  const serializationMs = performance.now() - serializationStarted;

  results.push({
    size,
    reportModelMs: Number(reportModelMs.toFixed(3)),
    serializationMs: Number(serializationMs.toFixed(3)),
    totalMs: Number((reportModelMs + serializationMs).toFixed(3)),
    detailedRows: report.tables.detailedRows.length,
    serializedBytes: serialized.length,
    wrote: false
  });
}

console.log(JSON.stringify({ ok: true, wrote: false, results }, null, 2));
