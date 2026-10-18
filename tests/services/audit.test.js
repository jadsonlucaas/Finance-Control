import { describe, expect, it } from 'vitest';
import {
  buildAuditLogEntry,
  classifyFinanceRecordAuditAction,
  summarizeFinanceRecord
} from '../../src/services/audit.js';

describe('audit service helpers', () => {
  it('builds sanitized audit entries without secret fields', () => {
    const entry = buildAuditLogEntry('finance_record.create', {
      password: 'secret',
      description: 'x'.repeat(400),
      nested: { token: 'hidden', safe: 'ok' }
    }, {
      user: { uid: 'u1', email: 'user@example.com' },
      now: new Date('2026-04-18T12:00:00.000Z')
    });

    expect(entry).toMatchObject({
      action: 'finance_record.create',
      actor_uid: 'u1',
      actor_email: 'user@example.com',
      created_at: '2026-04-18T12:00:00.000Z',
      status: 'success',
      source: 'web'
    });
    expect(entry.details.password).toBeUndefined();
    expect(entry.details.nested.token).toBeUndefined();
    expect(entry.details.description.length).toBeLessThan(310);
  });

  it('classifies critical finance actions', () => {
    expect(classifyFinanceRecordAuditAction('create', { type: 'saida' })).toBe('finance_record.create');
    expect(classifyFinanceRecordAuditAction('update', { type: 'saida', archived: true })).toBe('finance_record.archive');
    expect(classifyFinanceRecordAuditAction('update', { type: 'saida', status: 'Pago' })).toBe('finance_record.mark_paid');
    expect(classifyFinanceRecordAuditAction('delete', { type: 'percentage_rule' })).toBe('percentage_rule.delete');
    expect(classifyFinanceRecordAuditAction('create', { type: 'saida', import_source: 'saidas_xlsx' })).toBe('import.record_create');
  });

  it('summarizes records without carrying free text descriptions', () => {
    const summary = summarizeFinanceRecord({
      id: 'r1',
      type: 'saida',
      description: 'private detail',
      amount: '10',
      person: 'Jadson'
    });

    expect(summary).toEqual(expect.objectContaining({
      record_id: 'r1',
      record_type: 'saida',
      amount: 10,
      person: 'Jadson'
    }));
    expect(summary.description).toBeUndefined();
  });
});
