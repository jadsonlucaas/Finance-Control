import { performance } from 'node:perf_hooks';
import { buildHourControlReadModel } from '../src/application/readModels/hourControlReadModel.js';

function createRecords(count) {
  const people = ['Jadson', 'Luana', 'Ana', 'Bruno'];
  const records = [
    { id: 'p-jadson', type: 'pessoa', person: 'Jadson', salary_base: 5459 },
    { id: 'p-luana', type: 'pessoa', person: 'Luana', salary_base: 4560 },
    { id: 'sal-jadson', type: 'salario_historico', person: 'Jadson', competence: '2026-01', salary_base: 5459 },
    { id: 'sal-luana', type: 'salario_historico', person: 'Luana', competence: '2026-01', salary_base: 4560 }
  ];

  for (let index = 0; index < count; index += 1) {
    const person = people[index % people.length];
    const month = String((index % 12) + 1).padStart(2, '0');
    const type = index % 3 === 0 ? 'Banco de Horas' : 'Hora Extra';
    const minutes = 60 + (index % 5) * 30;
    records.push({
      id: `h-${index}`,
      type: 'controle_horas',
      person,
      competence: `2026-${month}`,
      occurred_date: `2026-${month}-${String((index % 27) + 1).padStart(2, '0')}`,
      hour_control_type: type,
      hour_entry_type: type,
      start_time: '18:00',
      end_time: '20:00',
      net_minutes: minutes,
      quantidadeHoras: minutes / 60,
      valorTotalCalculado: type === 'Hora Extra' ? Number((minutes * 0.75).toFixed(2)) : 0,
      bank_nature: index % 2 === 0 ? 'Debito' : 'Credito'
    });
  }
  return records;
}

const sizes = [100, 1000, 5000, 10000];
const results = sizes.map((size) => {
  const records = createRecords(size);
  const started = performance.now();
  const model = buildHourControlReadModel({
    records,
    filters: { start: '2026-06', end: '2026-06' }
  });
  const elapsedMs = Number((performance.now() - started).toFixed(3));
  return {
    records: size,
    elapsedMs,
    visibleEntryCount: model.metadata.visibleEntryCount,
    overtimeHours: model.overtime.hours,
    bankNetHours: model.bank.netHours
  };
});

console.log(JSON.stringify({ ok: true, wrote: false, results }, null, 2));
