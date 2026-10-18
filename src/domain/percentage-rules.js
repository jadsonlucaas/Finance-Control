import { centsToMoney, moneyToCents, roundCurrency } from '../core/money.js';
import { normalizeCompetenceKey } from '../core/dates.js';

export const PERCENTAGE_RULE_CALCULATION_VERSION = 1;
export const PERCENTAGE_RULE_SOURCE_CHANNEL = 'system';
export const PERCENTAGE_RULE_MATERIALIZATION_SOURCE = 'percentage_rule_materialization';
export const PERCENTAGE_RULE_BASES = Object.freeze(['liquido', 'bruta', 'base_total', 'salario', 'extra']);
export const PERCENTAGE_RULE_CYCLES = Object.freeze(['INICIO_MES', 'QUINZENA']);

export function getWorkIncomeBaseValue(consolidated = {}) {
  return roundCurrency(Number(consolidated.baseTrabalho || 0) ||
    (Number(consolidated.salaryBase || consolidated.salarioBase || 0) +
      Number(consolidated.hourExtra || 0) +
      Number(consolidated.dsrHoraExtra || 0) +
      Number(consolidated.dsrProventos || 0)));
}

export function getWorkLiquidBaseValue(consolidated = {}) {
  const workGross = getWorkIncomeBaseValue(consolidated);
  const inss = Number(consolidated.inss || 0);
  const irrf = Number(consolidated.irrf || 0);
  const discounts = Number(consolidated.outrosDescontos || consolidated.outrosDescontosManuais || 0);
  return roundCurrency(workGross - inss - irrf - discounts);
}

export function getPercentageBaseValue(consolidated = {}, base = 'liquido') {
  if (base === 'base_total') return getWorkIncomeBaseValue(consolidated);
  if (base === 'bruta') return getWorkIncomeBaseValue(consolidated);
  if (base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
  if (base === 'extra') {
    return roundCurrency((Number(consolidated.hourExtra || 0)) + (Number(consolidated.dsrHoraExtra || 0)) + (Number(consolidated.dsrProventos || 0)));
  }
  return getWorkLiquidBaseValue(consolidated);
}

export function getPercentageCycleBaseValue(consolidated = {}, base = 'liquido', cycle = 'INICIO_MES') {
  const normalizedCycle = cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
  if (base === 'base_total') return getWorkIncomeBaseValue(consolidated);
  if (base === 'bruta') return getWorkIncomeBaseValue(consolidated);
  if (base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
  if (base === 'extra') {
    return normalizedCycle === 'QUINZENA'
      ? 0
      : roundCurrency((Number(consolidated.hourExtra || 0)) + (Number(consolidated.dsrHoraExtra || 0)) + (Number(consolidated.dsrProventos || 0)));
  }
  if (normalizedCycle === 'QUINZENA') {
    return Number(consolidated.adiantamentoQuinzena || 0);
  }
  return getPercentageBaseValue(consolidated, base);
}

export function isReserveOrInvestmentPercentageRule(rule = {}) {
  const text = [
    rule.macro,
    rule.category,
    rule.name
  ].map((value) => String(value || '').trim().toUpperCase()).join(' ');
  return text.includes('RESERVA') || text.includes('INVEST');
}

export function getPercentageRuleBaseValue(consolidated = {}, rule = {}) {
  const ruleCycle = rule.cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
  if (rule.base === 'base_total') return getWorkIncomeBaseValue(consolidated);
  if (rule.base === 'bruta') return getWorkIncomeBaseValue(consolidated);
  if (rule.base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
  if (rule.base === 'extra') return getPercentageCycleBaseValue(consolidated, 'extra', ruleCycle);
  if (isReserveOrInvestmentPercentageRule(rule)) {
    return ruleCycle === 'QUINZENA'
      ? Number(consolidated.adiantamentoQuinzena || 0)
      : getWorkLiquidBaseValue(consolidated);
  }
  return getPercentageCycleBaseValue(consolidated, rule.base || 'liquido', ruleCycle);
}

export function getPercentageRuleAmount(consolidated = {}, rule = {}) {
  const baseValue = getPercentageRuleBaseValue(consolidated, rule);
  return roundCurrency(baseValue * (Number(rule.percentage || 0) / 100));
}

function issue(field, code, message) {
  return { field, code, message };
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function safeToken(value = '') {
  const slug = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
  return slug || 'empty';
}

export function hashPercentageOccurrenceValue(value = '') {
  let hash = 0x811c9dc5;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizePercentageRuleRate(value, legacyContext = {}) {
  const warnings = [];
  const errors = [];
  const raw = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const numeric = Number(raw);

  if (raw === '' || value === null || value === undefined || !Number.isFinite(numeric)) {
    errors.push(issue('percentage', 'PERCENTAGE_REQUIRED', 'Percentual da regra e obrigatorio.'));
  } else if (numeric <= 0) {
    errors.push(issue('percentage', 'PERCENTAGE_MUST_BE_POSITIVE', 'Percentual deve ser maior que zero.'));
  } else if (numeric > 100) {
    errors.push(issue('percentage', 'PERCENTAGE_ABOVE_LIMIT', 'Percentual de regra deve ser menor ou igual a 100.'));
  } else if (numeric < 1 && legacyContext.allowFraction !== true) {
    errors.push(issue('percentage', 'AMBIGUOUS_PERCENTAGE_FORMAT', 'Formato fracionario e ambiguo para regra percentual.'));
  } else {
    if (numeric <= 1 && legacyContext.allowFraction === true) {
      warnings.push(issue('percentage', 'LEGACY_FRACTION_ACCEPTED', 'Percentual fracionario aceito somente por contexto legado explicito.'));
    }
  }

  const normalizedRate = errors.length ? 0 : Math.round((numeric + Number.EPSILON) * 100) / 100;
  return {
    isValid: errors.length === 0,
    normalizedRate,
    ratePercent: normalizedRate,
    rateBasisPoints: Math.round(normalizedRate * 100),
    errors,
    warnings
  };
}

export function normalizePercentageRuleCycle(value = '') {
  return value === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
}

export function normalizePercentageRuleBase(value = '') {
  const base = normalizeText(value || 'liquido');
  return PERCENTAGE_RULE_BASES.includes(base) ? base : 'liquido';
}

export function isPercentageRuleActive(rule = {}) {
  if (rule.active === false) return false;
  if (['inactive', 'inativo', 'cancelado'].includes(String(rule.status || '').trim().toLowerCase())) return false;
  return true;
}

export function isPercentageRuleInRange(rule = {}, competence = '') {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  const start = normalizeCompetenceKey(rule.startCompetence || rule.start_competence || '');
  const end = normalizeCompetenceKey(rule.endCompetence || rule.end_competence || '');
  if (!normalizedCompetence) return false;
  if (start && normalizedCompetence < start) return false;
  if (end && normalizedCompetence > end) return false;
  return true;
}

export function resolvePercentageRulePersonId(person = {}) {
  return normalizeText(person.id || person.person_id || person.uid || person.person || person.name || '');
}

export function buildPercentageOccurrenceKey({
  ownerUid = '',
  ruleId = '',
  personId = '',
  competence = ''
} = {}) {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  const raw = [
    normalizeText(ownerUid),
    normalizeText(ruleId),
    normalizeText(personId),
    normalizedCompetence
  ].join('|');
  const hash = hashPercentageOccurrenceValue(raw);
  return `percentage-rule:${safeToken(ownerUid)}:${safeToken(ruleId)}:${safeToken(personId)}:${normalizedCompetence}:${hash}`;
}

export function buildPercentageOccurrenceEntityId(input = {}) {
  return `percentage_exit_${hashPercentageOccurrenceValue(buildPercentageOccurrenceKey(input))}`;
}

function centsFromMoney(value) {
  try {
    return moneyToCents(roundCurrency(Number(value || 0)));
  } catch {
    return 0;
  }
}

export function calculatePercentageAmountCents(baseAmountCents = 0, rateBasisPoints = 0) {
  return Math.round((Number(baseAmountCents || 0) * Number(rateBasisPoints || 0)) / 10000);
}

export function CalculatePercentageRuleOccurrence({
  rule = {},
  person = {},
  competence = '',
  baseContext = {},
  calculationContext = {}
} = {}) {
  const errors = [];
  const warnings = [];
  const normalizedCompetence = normalizeCompetenceKey(competence);
  const ruleId = normalizeText(rule.id || rule.rule_id || '');
  const personName = normalizeText(person.person || person.name || rule.person || '');
  const personId = resolvePercentageRulePersonId(person) || personName;
  const ownerUid = normalizeText(calculationContext.ownerUid || rule.owner_uid || person.owner_uid || '');

  if (!ruleId) errors.push(issue('ruleId', 'RULE_ID_REQUIRED', 'ID da regra percentual e obrigatorio.'));
  if (!personName) errors.push(issue('person', 'PERSON_REQUIRED', 'Pessoa da ocorrencia e obrigatoria.'));
  if (!normalizedCompetence) errors.push(issue('competence', 'COMPETENCE_REQUIRED', 'Competencia valida e obrigatoria.'));
  if (!isPercentageRuleActive(rule)) errors.push(issue('active', 'RULE_INACTIVE', 'Regra percentual inativa.'));
  if (normalizedCompetence && !isPercentageRuleInRange(rule, normalizedCompetence)) {
    errors.push(issue('competence', 'RULE_OUT_OF_RANGE', 'Competencia fora da vigencia da regra.'));
  }

  const rate = normalizePercentageRuleRate(rule.percentage ?? rule.percentual, calculationContext.legacyContext || {});
  errors.push(...rate.errors);
  warnings.push(...rate.warnings);

  const cycle = normalizePercentageRuleCycle(rule.cycle);
  const base = normalizePercentageRuleBase(rule.base || rule.base_type);
  const baseAmount = getPercentageRuleBaseValue(baseContext, { ...rule, base, cycle, percentage: rate.normalizedRate });
  const baseAmountCents = centsFromMoney(baseAmount);
  const calculatedAmountCents = calculatePercentageAmountCents(baseAmountCents, rate.rateBasisPoints);
  if (calculatedAmountCents <= 0) {
    errors.push(issue('amount', 'PERCENTAGE_AMOUNT_NOT_POSITIVE', 'Valor calculado deve ser maior que zero.'));
  }

  const occurrenceKey = errors.length
    ? ''
    : buildPercentageOccurrenceKey({ ownerUid, ruleId, personId, competence: normalizedCompetence });
  const entityId = errors.length
    ? ''
    : buildPercentageOccurrenceEntityId({ ownerUid, ruleId, personId, competence: normalizedCompetence });

  return {
    isValid: errors.length === 0,
    ruleId,
    personId,
    personName,
    competence: normalizedCompetence,
    cycle,
    base,
    baseAmountCents,
    normalizedRate: rate.normalizedRate,
    rateBasisPoints: rate.rateBasisPoints,
    calculatedAmountCents,
    amount: errors.length ? 0 : centsToMoney(calculatedAmountCents),
    macro: normalizeText(rule.macro || rule.macro_category || 'RESERVA'),
    category: normalizeText(rule.category || rule.category_name || rule.subcategory || ''),
    description: normalizeText(rule.name || rule.description || ''),
    occurrenceKey,
    entityId,
    warnings,
    errors,
    calculationVersion: PERCENTAGE_RULE_CALCULATION_VERSION
  };
}

export function buildPercentageOccurrenceRecord({
  occurrence = {},
  rule = {},
  now = () => new Date().toISOString(),
  metadata = {}
} = {}) {
  const materializedAt = now();
  return {
    id: occurrence.entityId,
    type: 'saida',
    person: occurrence.personName,
    macro_category: occurrence.macro,
    subcategory: occurrence.category,
    description: `${occurrence.description} (${Number(occurrence.normalizedRate).toFixed(2).replace('.', ',')}%)`,
    amount: centsToMoney(occurrence.calculatedAmountCents),
    status: rule.status === 'Pago' ? 'Pago' : 'Em aberto',
    payment_method: 'Regra percentual',
    occurred_date: '',
    due_date: `${occurrence.competence}-01`,
    competence: occurrence.competence,
    paid_at: rule.status === 'Pago' ? `${occurrence.competence}-01` : '',
    installment_no: 0,
    total_installments: 0,
    parent_id: '',
    earning_type: '',
    recurrence: 'mensal_percentual',
    cycle: occurrence.cycle,
    created_at: materializedAt,
    updated_at: materializedAt,
    category_id: rule.category_id || '',
    category_name: occurrence.category,
    category_color: rule.category_color || '',
    category_icon: rule.category_icon || '',
    archived: false,
    generated_percentage_rule: true,
    percentage_rule_id: occurrence.ruleId,
    percentage_occurrence_key: occurrence.occurrenceKey,
    percentage_rule_version: Number(rule.percentage_rule_version || rule.version || 1),
    percentage_materialized_at: materializedAt,
    percentage_calculation_version: occurrence.calculationVersion,
    percentage_rate: occurrence.normalizedRate,
    percentage_base: occurrence.base,
    percentage_base_amount: centsToMoney(occurrence.baseAmountCents),
    percentage_base_amount_cents: occurrence.baseAmountCents,
    percentage_calculated_amount_cents: occurrence.calculatedAmountCents,
    virtual_record: false,
    source_channel: metadata.source_channel || PERCENTAGE_RULE_SOURCE_CHANNEL,
    source_reference_id: metadata.source_reference_id || occurrence.occurrenceKey,
    correlation_id: metadata.correlation_id || '',
    idempotency_key: metadata.idempotency_key || '',
    schema_version: Number(metadata.schema_version || 1)
  };
}
