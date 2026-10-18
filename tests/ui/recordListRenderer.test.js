import { describe, expect, it } from 'vitest';
import { buildRecordRowViewModel } from '../../src/ui/records/recordListRenderer.js';

describe('record list renderer', () => {
  it('keeps user supplied record text as text model values, not markup', () => {
    const model = buildRecordRowViewModel({
      id: 'r1" onclick="bad',
      type: 'saida',
      description: '<img src=x onerror=alert(1)>',
      person: '<script>alert(1)</script>',
      macro_category: 'FIXO',
      payment_method: '<b>Pix</b>',
      status: 'Em aberto',
      competence: '2026-04',
      amount: 123.45
    }, {
      fmt: (value) => `R$ ${value}`,
      formatCompetence: (value) => `competencia:${value}`
    });

    expect(model.id).toBe('r1" onclick="bad');
    expect(model.title).toBe('<img src=x onerror=alert(1)>');
    expect(model.meta).toContain('competencia:2026-04');
    expect(model.meta).toContain('FIXO');
    expect(model.pills).toContain('<script>alert(1)</script>');
    expect(model.pills).toContain('<b>Pix</b>');
    expect(model.value).toBe('R$ 123.45');
  });

  it('builds archive and paid actions from record state', () => {
    const model = buildRecordRowViewModel({
      id: 'r2',
      type: 'entrada',
      status: 'Pago',
      archived: true,
      amount: 50
    }, {
      fmt: (value) => String(value),
      isArchivedRecord: () => true
    });

    expect(model.icon).toBe('arrow-down-left');
    expect(model.paidIcon).toBe('check-circle');
    expect(model.archiveIcon).toBe('archive-restore');
    expect(model.archiveTitle).toBe('Reabrir lancamento');
  });
});
