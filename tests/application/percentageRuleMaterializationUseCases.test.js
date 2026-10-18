import { describe, expect, it } from 'vitest';
import { createApplicationDependencies } from '../../src/application/dependencies/createApplicationDependencies.js';
import {
  buildPercentageRuleMaterializationPreview,
  MaterializePercentageRulesForCompetence
} from '../../src/application/useCases/percentageRuleMaterializationUseCases.js';
import {
  buildPercentageOccurrenceEntityId,
  buildPercentageOccurrenceKey
} from '../../src/domain/percentage-rules.js';

const ownerUid = 'owner-pct';
const now = () => '2026-08-22T00:00:00.000Z';

function baseRecords() {
  return [
    { id: 'person-ana', type: 'pessoa', person: 'Ana', salary_base: 5000, receiving_type: 'mensal', owner_uid: ownerUid },
    { id: 'person-bruno', type: 'pessoa', person: 'Bruno', salary_base: 4000, receiving_type: 'mensal', owner_uid: ownerUid },
    {
      id: 'rule-all',
      type: 'percentage_rule',
      name: 'Reserva',
      percentage: 10,
      base: 'salario',
      macro: 'RESERVA',
      category: 'Investimentos',
      cycle: 'INICIO_MES',
      startCompetence: '2026-01',
      active: true,
      owner_uid: ownerUid
    }
  ];
}

function context() {
  return {
    actorUid: ownerUid,
    ownerUid,
    actorType: 'user',
    accountStatus: 'active',
    correlationId: 'pct-test',
    sourceChannel: 'system'
  };
}

describe('MaterializePercentageRulesForCompetence', () => {
  it('creates missing deterministic occurrences and does not duplicate on replay', async () => {
    const dependencies = createApplicationDependencies({ mode: 'test', records: baseRecords(), now });
    const first = await MaterializePercentageRulesForCompetence({
      input: { competence: '2026-06' },
      context: context(),
      dependencies,
      now
    });
    const second = await MaterializePercentageRulesForCompetence({
      input: { competence: '2026-06' },
      context: context(),
      dependencies,
      now
    });
    const listed = await dependencies.repositories.financeRecords.list({ type: 'saida' }, context());

    expect(first.success).toBe(true);
    expect(first.data).toMatchObject({ evaluated: 2, created: 2, alreadyExisting: 0 });
    expect(second.success).toBe(true);
    expect(second.data).toMatchObject({ evaluated: 2, created: 0, alreadyExisting: 2 });
    expect(listed.items).toHaveLength(2);
    expect(new Set(listed.items.map((record) => record.id)).size).toBe(2);
    expect(listed.items.every((record) => record.percentage_occurrence_key)).toBe(true);
  });

  it('preserves paid and manually edited occurrences without overwrite', async () => {
    const paidKey = buildPercentageOccurrenceKey({ ownerUid, ruleId: 'rule-all', personId: 'person-ana', competence: '2026-06' });
    const editedKey = buildPercentageOccurrenceKey({ ownerUid, ruleId: 'rule-all', personId: 'person-bruno', competence: '2026-06' });
    const dependencies = createApplicationDependencies({
      mode: 'test',
      records: [
        ...baseRecords(),
        {
          id: buildPercentageOccurrenceEntityId({ ownerUid, ruleId: 'rule-all', personId: 'person-ana', competence: '2026-06' }),
          type: 'saida',
          person: 'Ana',
          amount: 500,
          status: 'Pago',
          paid_at: '2026-06-01',
          competence: '2026-06',
          generated_percentage_rule: true,
          percentage_rule_id: 'rule-all',
          percentage_occurrence_key: paidKey,
          subcategory: 'Investimentos',
          owner_uid: ownerUid
        },
        {
          id: buildPercentageOccurrenceEntityId({ ownerUid, ruleId: 'rule-all', personId: 'person-bruno', competence: '2026-06' }),
          type: 'saida',
          person: 'Bruno',
          amount: 123.45,
          status: 'Em aberto',
          competence: '2026-06',
          generated_percentage_rule: true,
          percentage_rule_id: 'rule-all',
          percentage_occurrence_key: editedKey,
          subcategory: 'Investimentos ajustado',
          percentage_materialization_manual_edit: true,
          owner_uid: ownerUid
        }
      ],
      now
    });

    const result = await MaterializePercentageRulesForCompetence({
      input: { competence: '2026-06' },
      context: context(),
      dependencies,
      now
    });
    const listed = await dependencies.repositories.financeRecords.list({ type: 'saida' }, context());

    expect(result.data).toMatchObject({ created: 0, alreadyExisting: 2 });
    expect(result.data.occurrences.flatMap((item) => item.warnings)).toEqual(expect.arrayContaining([
      'PAID_OCCURRENCE_PRESERVED',
      'MANUALLY_EDITED_OCCURRENCE_PRESERVED',
      'DIVERGENT_AMOUNT_PRESERVED',
      'DIVERGENT_CATEGORY_PRESERVED'
    ]));
    expect(listed.items.find((record) => record.person === 'Ana').status).toBe('Pago');
    expect(listed.items.find((record) => record.person === 'Bruno').amount).toBe(123.45);
  });

  it('simulates concurrent materialization without duplicate deterministic records', async () => {
    const dependencies = createApplicationDependencies({ mode: 'test', records: baseRecords(), now });
    const [first, second] = await Promise.all([
      MaterializePercentageRulesForCompetence({
        input: { competence: '2026-06' },
        context: { ...context(), correlationId: 'pct-concurrent-1' },
        dependencies,
        now
      }),
      MaterializePercentageRulesForCompetence({
        input: { competence: '2026-06' },
        context: { ...context(), correlationId: 'pct-concurrent-2' },
        dependencies,
        now
      })
    ]);
    const listed = await dependencies.repositories.financeRecords.list({ type: 'saida' }, context());

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.data.created + second.data.created).toBe(2);
    expect(listed.items).toHaveLength(2);
    expect(new Set(listed.items.map((record) => record.id)).size).toBe(2);
  });

  it('dry-run returns wrote false and simulated non-zero counts', () => {
    const preview = buildPercentageRuleMaterializationPreview({
      records: baseRecords(),
      competence: '2026-06',
      context: { ownerUid, actorUid: ownerUid },
      now
    });

    expect(preview.wrote).toBe(false);
    expect(preview.evaluated).toBe(2);
    expect(preview.created).toBe(2);
    expect(preview.occurrences.every((item) => item.wrote === false)).toBe(true);
  });

  it('inactive and out-of-range rules do not create occurrences', async () => {
    const dependencies = createApplicationDependencies({
      mode: 'test',
      records: [
        { id: 'person-ana', type: 'pessoa', person: 'Ana', salary_base: 5000, owner_uid: ownerUid },
        { ...baseRecords()[2], id: 'inactive', active: false },
        { ...baseRecords()[2], id: 'future', startCompetence: '2026-07' }
      ],
      now
    });

    const result = await MaterializePercentageRulesForCompetence({
      input: { competence: '2026-06' },
      context: context(),
      dependencies,
      now
    });

    expect(result.data).toMatchObject({ created: 0, skippedInactive: 1, skippedOutOfRange: 1 });
  });
});
