import { describe, expect, it } from 'vitest';
import {
  buildEffectiveReferences,
  buildReferenceDataDryRun,
  normalizeReferenceName,
  normalizeReferenceRecord,
  resolveRecordCategory
} from '../../src/domain/referenceData.js';

describe('reference data domain', () => {
  it('normalizes names without accents, duplicated spaces or case sensitivity', () => {
    expect(normalizeReferenceName('  Alimentação   Casa ')).toBe('alimentacao casa');
  });

  it('normalizes legacy records without shared_scope as personal when requested', () => {
    const record = normalizeReferenceRecord({
      type: 'macro',
      macro_category: 'Freelas',
      owner_uid: 'uid-a'
    });

    expect(record).toMatchObject({
      type: 'macro',
      macro_category: 'Freelas',
      shared_scope: 'personal',
      owner_uid: 'uid-a'
    });
  });

  it('combines global and personal references deterministically', () => {
    const result = buildEffectiveReferences(
      [{ id: 'g2', type: 'macro', macro_category: 'Reserva', shared_scope: 'global' }, { id: 'g1', type: 'macro', macro_category: 'Fixo', shared_scope: 'global' }],
      [{ id: 'p1', type: 'macro', macro_category: 'Projetos', shared_scope: 'personal', owner_uid: 'uid-a' }],
      { ownerUid: 'uid-a' }
    );

    expect(result.effectiveMacros.map((record) => record.macro_category)).toEqual(['Fixo', 'Reserva', 'Projetos']);
  });

  it('does not mix personal references from other users', () => {
    const result = buildEffectiveReferences([], [
      { id: 'mine', type: 'macro', macro_category: 'Minha', shared_scope: 'personal', owner_uid: 'uid-a' },
      { id: 'other', type: 'macro', macro_category: 'Outra', shared_scope: 'personal', owner_uid: 'uid-b' }
    ], { ownerUid: 'uid-a' });

    expect(result.effectiveMacros.map((record) => record.id)).toEqual(['mine']);
  });

  it('deduplicates exact duplicates and reports logical collisions', () => {
    const result = buildEffectiveReferences([
      { id: 'g1', type: 'categoria', macro_category: 'FIXO', category_name: 'Moradia', category_color: '#111', category_icon: 'home', shared_scope: 'global' }
    ], [
      { id: 'p1', type: 'categoria', macro_category: 'fixo', category_name: 'Moradia', category_color: '#111', category_icon: 'home', shared_scope: 'personal', owner_uid: 'uid-a' },
      { id: 'p2', type: 'categoria', macro_category: 'FIXO', category_name: 'Moradia', category_color: '#222', category_icon: 'house', shared_scope: 'personal', owner_uid: 'uid-a' }
    ], { ownerUid: 'uid-a' });

    expect(result.duplicateKeys).toEqual(['categoria:fixo|moradia']);
    expect(result.collisions).toHaveLength(1);
    expect(result.effectiveCategories.map((record) => record.id)).toEqual(['g1', 'p2']);
  });

  it('resolves record category by stable id first', () => {
    const effective = {
      effectiveCategories: [
        { category_id: 'cat-aluguel', category_name: 'Aluguel', macro_category: 'FIXO' }
      ]
    };

    expect(resolveRecordCategory({ category_id: 'cat-aluguel', subcategory: 'Outra' }, effective)).toMatchObject({
      status: 'resolved',
      source: 'id'
    });
  });

  it('falls back by normalized name and preserves orphaned record snapshots', () => {
    const effective = {
      effectiveCategories: [
        { category_id: 'cat-mercado', category_name: 'Mercado', macro_category: 'VARIAVEL' }
      ]
    };

    expect(resolveRecordCategory({ macro_category: 'variavel', subcategory: '  Mercado ' }, effective)).toMatchObject({
      status: 'resolved',
      source: 'name'
    });
    expect(resolveRecordCategory({
      macro_category: 'FIXO',
      subcategory: 'Antiga',
      category_color: '#abc',
      category_icon: 'tag'
    }, effective)).toMatchObject({
      status: 'orphaned',
      source: 'record_snapshot',
      category: { category_name: 'Antiga', category_color: '#abc', category_icon: 'tag' }
    });
  });

  it('dry-run reports legacy, missing ids, collisions and orphans without mutating records', () => {
    const records = [
      { id: 'legacy-macro', type: 'macro', macro_category: 'Fixo', owner_uid: 'uid-a' },
      { id: 'global-cat', type: 'categoria', macro_category: 'FIXO', category_name: 'Casa', category_color: '#111', category_icon: 'home', shared_scope: 'global' },
      { id: 'personal-cat', type: 'categoria', macro_category: 'fixo', category_name: 'Casa', category_color: '#222', category_icon: 'home', shared_scope: 'personal', owner_uid: 'uid-a' },
      { id: 'expense', type: 'saida', macro_category: 'Reserva', subcategory: 'Antiga', amount: 10 }
    ];
    const snapshot = JSON.stringify(records);

    const first = buildReferenceDataDryRun(records, { ownerUid: 'uid-a' });
    const second = buildReferenceDataDryRun(records, { ownerUid: 'uid-a' });

    expect(JSON.stringify(records)).toBe(snapshot);
    expect(first).toEqual(second);
    expect(first.legacyWithoutScope).toContain('legacy-macro');
    expect(first.missingIds).toContain('legacy-macro');
    expect(first.collisions).toHaveLength(1);
    expect(first.orphanedReferences).toContain('expense');
  });

  it('keeps metadata independent from WhatsApp channel or phone numbers', () => {
    const record = normalizeReferenceRecord({
      type: 'categoria',
      macro_category: 'FIXO',
      category_name: 'Moradia',
      shared_scope: 'personal',
      owner_uid: 'uid-a',
      phone: '+5599999999999',
      channel: 'whatsapp'
    });

    expect(record.owner_uid).toBe('uid-a');
    expect(record.phone).toBeUndefined();
    expect(record.channel).toBeUndefined();
    expect(record.category_name).toBe('Moradia');
  });
});
