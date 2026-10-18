import { buildPercentageRuleMaterializationPreview } from '../src/application/useCases/percentageRuleMaterializationUseCases.js';
import { buildPercentageOccurrenceEntityId, buildPercentageOccurrenceKey } from '../src/domain/percentage-rules.js';

const ownerUid = 'dry-run-user';
const activeRule = {
  id: 'rule-reserve-10',
  type: 'percentage_rule',
  name: 'Reserva Dry Run',
  percentage: 10,
  base: 'salario',
  macro: 'RESERVA',
  category: 'Investimentos',
  cycle: 'INICIO_MES',
  startCompetence: '2026-06',
  active: true,
  owner_uid: ownerUid
};
const paidRule = { ...activeRule, id: 'rule-paid', name: 'Reserva Paga' };
const editedRule = { ...activeRule, id: 'rule-edited', name: 'Reserva Editada' };
const existingKey = buildPercentageOccurrenceKey({
  ownerUid,
  ruleId: activeRule.id,
  personId: 'person-a',
  competence: '2026-06'
});
const paidKey = buildPercentageOccurrenceKey({
  ownerUid,
  ruleId: paidRule.id,
  personId: 'person-a',
  competence: '2026-06'
});
const editedKey = buildPercentageOccurrenceKey({
  ownerUid,
  ruleId: editedRule.id,
  personId: 'person-b',
  competence: '2026-06'
});

const records = [
  { id: 'person-a', type: 'pessoa', person: 'Ana', salary_base: 5000, receiving_type: 'mensal', owner_uid: ownerUid },
  { id: 'person-b', type: 'pessoa', person: 'Bruno', salary_base: 4000, receiving_type: 'mensal', owner_uid: ownerUid },
  activeRule,
  paidRule,
  editedRule,
  { ...activeRule, id: 'rule-inactive', name: 'Inativa', active: false },
  { ...activeRule, id: 'rule-out', name: 'Fora Vigencia', startCompetence: '2026-07' },
  { ...activeRule, id: 'rule-ambiguous', name: 'Ambigua', percentage: 0.10 },
  {
    id: buildPercentageOccurrenceEntityId({ ownerUid, ruleId: activeRule.id, personId: 'person-a', competence: '2026-06' }),
    type: 'saida',
    person: 'Ana',
    amount: 500,
    status: 'Em aberto',
    competence: '2026-06',
    generated_percentage_rule: true,
    percentage_rule_id: activeRule.id,
    percentage_occurrence_key: existingKey,
    subcategory: 'Investimentos',
    owner_uid: ownerUid
  },
  {
    id: buildPercentageOccurrenceEntityId({ ownerUid, ruleId: paidRule.id, personId: 'person-a', competence: '2026-06' }),
    type: 'saida',
    person: 'Ana',
    amount: 500,
    status: 'Pago',
    paid_at: '2026-06-01',
    competence: '2026-06',
    generated_percentage_rule: true,
    percentage_rule_id: paidRule.id,
    percentage_occurrence_key: paidKey,
    subcategory: 'Investimentos',
    owner_uid: ownerUid
  },
  {
    id: buildPercentageOccurrenceEntityId({ ownerUid, ruleId: editedRule.id, personId: 'person-b', competence: '2026-06' }),
    type: 'saida',
    person: 'Bruno',
    amount: 123.45,
    status: 'Em aberto',
    competence: '2026-06',
    generated_percentage_rule: true,
    percentage_rule_id: editedRule.id,
    percentage_occurrence_key: editedKey,
    subcategory: 'Investimentos ajustado',
    percentage_materialization_manual_edit: true,
    owner_uid: ownerUid
  }
];

const preview = buildPercentageRuleMaterializationPreview({
  records,
  competence: '2026-06',
  context: { ownerUid, actorUid: ownerUid, correlationId: 'percentage-rules-dry-run' },
  now: () => '2026-08-22T00:00:00.000Z'
});

console.log(JSON.stringify({
  ok: true,
  wrote: false,
  note: 'Contagens simuladas em memoria; nenhuma escrita em Firebase real foi executada.',
  summary: preview
}, null, 2));
