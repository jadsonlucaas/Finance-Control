import { describe, expect, it } from 'vitest';
import { sanitizeFirestoreRecord } from '../../src/services/firestoreSanitizer.js';

describe('firestore sanitizer', () => {
  it('removes undefined fields recursively without changing valid values', () => {
    expect(sanitizeFirestoreRecord({
      type: 'saida',
      description: undefined,
      amount: '123.45',
      tags: ['ok', undefined, 'keep'],
      meta: {
        keep: true,
        drop: undefined
      }
    })).toEqual({
      type: 'saida',
      amount: 123.45,
      status: 'Em aberto',
      paid_at: '',
      archived: false,
      installment_no: 0,
      total_installments: 0,
      tags: ['ok', 'keep'],
      meta: {
        keep: true
      }
    });
  });

  it('rejects invalid payloads before persistence', () => {
    expect(() => sanitizeFirestoreRecord(null)).toThrow('Registro invalido');
    expect(() => sanitizeFirestoreRecord([])).toThrow('Registro invalido');
  });
});
