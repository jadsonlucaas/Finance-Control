import { centsToMoney, moneyToCents, roundCurrency } from '../core/money.js';
import {
  TAX_PARAMETER_SCHEMA_VERSION,
  validateTaxParameter
} from './taxParameters.js';
import { createLegacyTaxParameterRepository } from './taxParameterRepository.js';

export const TAX_CALCULATION_SCHEMA_VERSION = 1;
export const LEGACY_COMPATIBILITY_COMPETENCE = '2026-01';

const defaultRepository = createLegacyTaxParameterRepository();

function issue(code, message, details = {}) {
  return { code, message, details };
}

function toCents(value = 0) {
  if (Number.isInteger(value)) return value;
  return moneyToCents(value);
}

function toMoney(cents = 0) {
  return roundCurrency(centsToMoney(Math.round(Number(cents) || 0)));
}

function roundCents(value = 0) {
  return Math.max(0, Math.round((Number(value) || 0) + Number.EPSILON));
}

function normalizeCompetence(competence = '', context = {}) {
  const value = String(competence || '').trim();
  if (/^\d{4}-\d{2}$/.test(value)) {
    return { competence: value, warnings: [] };
  }
  if (context.allowLegacyWithoutCompetence) {
    return {
      competence: LEGACY_COMPATIBILITY_COMPETENCE,
      warnings: [
        issue(
          'LEGACY_COMPETENCE_MISSING',
          `Competencia ausente: usando baseline legado ${LEGACY_COMPATIBILITY_COMPETENCE}.`
        )
      ]
    };
  }
  return {
    competence: '',
    warnings: [],
    errors: [issue('COMPETENCE_REQUIRED', 'Competencia tributaria deve estar em YYYY-MM.')]
  };
}

function resolveParameter({ taxType, competence, repository = defaultRepository, parameter = null, context = {} } = {}) {
  const normalized = normalizeCompetence(competence, context);
  if (normalized.errors?.length) {
    return {
      isOk: false,
      competence: normalized.competence,
      parameter: null,
      warnings: normalized.warnings,
      errors: normalized.errors
    };
  }

  if (parameter) {
    const validation = validateTaxParameter(parameter);
    return {
      isOk: validation.isValid,
      competence: normalized.competence,
      parameter: validation.isValid ? parameter : null,
      warnings: [...normalized.warnings, ...validation.warnings],
      errors: validation.errors
    };
  }

  const found = repository.findEffective(taxType, normalized.competence);
  return {
    isOk: found.isOk,
    competence: normalized.competence,
    parameter: found.parameter,
    warnings: [...normalized.warnings, ...(found.warnings || [])],
    errors: found.errors || []
  };
}

function findBracket(parameter = {}, baseCents = 0) {
  const brackets = [...(Array.isArray(parameter.brackets) ? parameter.brackets : [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return brackets.find((item) =>
    baseCents >= item.from_cents && (item.to_cents === null || item.to_cents === undefined || baseCents <= item.to_cents)
  ) || brackets[brackets.length - 1] || null;
}

function calculateProgressiveBrackets(parameter = {}, baseCents = 0) {
  const brackets = [...(Array.isArray(parameter.brackets) ? parameter.brackets : [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  let previousLimitCents = 0;
  const breakdown = [];
  let amountCents = 0;

  brackets.forEach((bracket) => {
    if (baseCents <= previousLimitCents) return;
    const upperLimitCents = bracket.to_cents === null || bracket.to_cents === undefined
      ? baseCents
      : Math.min(baseCents, bracket.to_cents);
    const bracketBaseCents = Math.max(0, upperLimitCents - previousLimitCents);
    const bracketAmountCents = roundCents(bracketBaseCents * bracket.rate);
    if (bracketBaseCents > 0) {
      breakdown.push({
        code: 'INSS_PROGRESSIVE_BRACKET',
        order: bracket.order,
        baseCents: bracketBaseCents,
        rate: bracket.rate,
        deductionCents: 0,
        amountCents: bracketAmountCents
      });
    }
    amountCents += bracketAmountCents;
    previousLimitCents = bracket.to_cents === null || bracket.to_cents === undefined
      ? upperLimitCents
      : bracket.to_cents;
  });

  return { amountCents, breakdown };
}

function emptyTaxResult({ taxType, competence, errors = [], warnings = [] } = {}) {
  return {
    isValid: errors.length === 0,
    taxType,
    competence: competence || '',
    parameterVersion: '',
    parameterId: '',
    schemaVersion: TAX_CALCULATION_SCHEMA_VERSION,
    parameterSchemaVersion: TAX_PARAMETER_SCHEMA_VERSION,
    grossIncomeCents: 0,
    taxableIncomeCents: 0,
    amountCents: 0,
    amount: 0,
    breakdown: [],
    warnings,
    errors
  };
}

export function CalculateINSS({
  competence = '',
  grossIncomeCents = 0,
  parameter = null,
  repository = defaultRepository,
  context = {}
} = {}) {
  const resolved = resolveParameter({ taxType: 'inss', competence, repository, parameter, context });
  if (!resolved.isOk) {
    return emptyTaxResult({
      taxType: 'inss',
      competence: resolved.competence,
      errors: resolved.errors,
      warnings: resolved.warnings
    });
  }

  const baseCents = Math.max(0, toCents(grossIncomeCents));
  const ceilingCents = Number.isInteger(resolved.parameter.ceiling_cents)
    ? resolved.parameter.ceiling_cents
    : baseCents;
  const taxableIncomeCents = Math.min(baseCents, ceilingCents);
  const bracket = findBracket(resolved.parameter, taxableIncomeCents);
  const usesProgressiveBrackets = (resolved.parameter.brackets || []).some((item) => item.progressive === true);
  const progressive = usesProgressiveBrackets
    ? calculateProgressiveBrackets(resolved.parameter, taxableIncomeCents)
    : null;
  const amountCents = progressive
    ? progressive.amountCents
    : bracket
      ? roundCents((taxableIncomeCents * bracket.rate) - (bracket.deduction_cents || 0))
      : 0;

  return {
    isValid: true,
    taxType: 'inss',
    competence: resolved.competence,
    parameterVersion: resolved.parameter.version,
    parameterId: resolved.parameter.id || resolved.parameter.version,
    schemaVersion: TAX_CALCULATION_SCHEMA_VERSION,
    parameterSchemaVersion: resolved.parameter.schema_version || TAX_PARAMETER_SCHEMA_VERSION,
    grossIncomeCents: baseCents,
    taxableIncomeCents,
    amountCents,
    amount: toMoney(amountCents),
    breakdown: progressive?.breakdown || (bracket ? [
      {
        code: 'INSS_SELECTED_BRACKET',
        order: bracket.order,
        baseCents: taxableIncomeCents,
        rate: bracket.rate,
        deductionCents: bracket.deduction_cents || 0,
        amountCents
      }
    ] : []),
    warnings: resolved.warnings,
    errors: []
  };
}

function calculateLegacyReduction({ parameter = {}, grossIncomeCents = 0, taxableIncomeCents = 0, traditionalCents = 0 } = {}) {
  const rule = Array.isArray(parameter.deductions?.reduction_rules)
    ? parameter.deductions.reduction_rules[0]
    : null;
  if (!rule) return { reductionCents: 0, finalCents: traditionalCents, applied: false };

  const zeroGrossUntil = rule.zero_gross_until_cents ?? 0;
  if (grossIncomeCents <= zeroGrossUntil) {
    return { reductionCents: traditionalCents, finalCents: 0, applied: true };
  }

  const limit = rule.to_cents ?? Number.MAX_SAFE_INTEGER;
  if (grossIncomeCents <= limit) {
    let reductionCents = 0;
    if (taxableIncomeCents <= zeroGrossUntil) {
      reductionCents = traditionalCents;
    } else {
      const basisCents = rule.basis === 'gross_income' ? grossIncomeCents : taxableIncomeCents;
      reductionCents = roundCents((rule.fixed_cents || 0) - ((rule.factor || 0) * basisCents));
    }
    return {
      reductionCents,
      finalCents: Math.max(0, traditionalCents - reductionCents),
      applied: true
    };
  }

  return { reductionCents: 0, finalCents: traditionalCents, applied: false };
}

export function CalculateIRRF({
  competence = '',
  grossIncomeCents = 0,
  taxableIncomeCents = null,
  inssCents = 0,
  dependents = 0,
  legalDeductionsCents = 0,
  simplifiedDeductionRequested = false,
  parameter = null,
  repository = defaultRepository,
  context = {}
} = {}) {
  const resolved = resolveParameter({ taxType: 'irrf', competence, repository, parameter, context });
  if (!resolved.isOk) {
    return emptyTaxResult({
      taxType: 'irrf',
      competence: resolved.competence,
      errors: resolved.errors,
      warnings: resolved.warnings
    });
  }

  const grossCents = Math.max(0, toCents(grossIncomeCents));
  const rawTaxableCents = taxableIncomeCents === null || taxableIncomeCents === undefined
    ? grossCents - toCents(inssCents)
    : toCents(taxableIncomeCents);
  const dependentDeductionCents = Math.max(0, Number(dependents) || 0)
    * (resolved.parameter.deductions?.dependent_deduction_cents || 0);
  const simplifiedDeductionCents = simplifiedDeductionRequested
    ? resolved.parameter.deductions?.simplified_deduction_cents || 0
    : 0;
  const deductionCents = Math.max(dependentDeductionCents + toCents(legalDeductionsCents), simplifiedDeductionCents);
  const finalTaxableCents = Math.max(0, rawTaxableCents - deductionCents);
  const bracket = findBracket(resolved.parameter, finalTaxableCents);
  const traditionalCents = bracket
    ? roundCents((finalTaxableCents * bracket.rate) - (bracket.deduction_cents || 0))
    : 0;
  const reduction = calculateLegacyReduction({
    parameter: resolved.parameter,
    grossIncomeCents: grossCents,
    taxableIncomeCents: finalTaxableCents,
    traditionalCents
  });

  return {
    isValid: true,
    taxType: 'irrf',
    competence: resolved.competence,
    parameterVersion: resolved.parameter.version,
    parameterId: resolved.parameter.id || resolved.parameter.version,
    schemaVersion: TAX_CALCULATION_SCHEMA_VERSION,
    parameterSchemaVersion: resolved.parameter.schema_version || TAX_PARAMETER_SCHEMA_VERSION,
    grossIncomeCents: grossCents,
    taxableIncomeCents: finalTaxableCents,
    traditionalCents,
    reductionCents: reduction.reductionCents,
    amountCents: reduction.finalCents,
    amount: toMoney(reduction.finalCents),
    breakdown: [
      ...(bracket ? [{
        code: 'IRRF_SELECTED_BRACKET',
        order: bracket.order,
        baseCents: finalTaxableCents,
        rate: bracket.rate,
        deductionCents: bracket.deduction_cents || 0,
        amountCents: traditionalCents
      }] : []),
      {
        code: reduction.applied ? 'IRRF_LEGACY_REDUCTION_APPLIED' : 'IRRF_LEGACY_REDUCTION_NOT_APPLIED',
        amountCents: -reduction.reductionCents
      },
      {
        code: 'IRRF_FINAL',
        amountCents: reduction.finalCents
      }
    ],
    warnings: resolved.warnings,
    errors: []
  };
}

export function CalculateNetIncome({
  competence = '',
  grossIncomeCents = 0,
  inssCents = null,
  irrfCents = null,
  otherDiscountsCents = 0,
  repository = defaultRepository,
  context = {}
} = {}) {
  const grossCents = Math.max(0, toCents(grossIncomeCents));
  const inssResult = inssCents === null || inssCents === undefined
    ? CalculateINSS({ competence, grossIncomeCents: grossCents, repository, context })
    : null;
  const resolvedInssCents = inssResult ? inssResult.amountCents : toCents(inssCents);
  const irrfResult = irrfCents === null || irrfCents === undefined
    ? CalculateIRRF({ competence, grossIncomeCents: grossCents, inssCents: resolvedInssCents, repository, context })
    : null;
  const resolvedIrrfCents = irrfResult ? irrfResult.amountCents : toCents(irrfCents);
  const errors = [
    ...(inssResult?.errors || []),
    ...(irrfResult?.errors || [])
  ];
  const warnings = [
    ...(inssResult?.warnings || []),
    ...(irrfResult?.warnings || [])
  ];
  const netIncomeCents = Math.max(0, grossCents - resolvedInssCents - resolvedIrrfCents - toCents(otherDiscountsCents));

  return {
    isValid: errors.length === 0,
    competence,
    schemaVersion: TAX_CALCULATION_SCHEMA_VERSION,
    grossIncomeCents: grossCents,
    inssCents: resolvedInssCents,
    irrfCents: resolvedIrrfCents,
    otherDiscountsCents: toCents(otherDiscountsCents),
    netIncomeCents,
    netIncome: toMoney(netIncomeCents),
    inssVersion: inssResult?.parameterVersion || '',
    irrfVersion: irrfResult?.parameterVersion || '',
    inssResult,
    irrfResult,
    warnings,
    errors
  };
}

export function resolveTaxParametersByCompetence({ competence = '', repository = defaultRepository, context = {} } = {}) {
  const inss = resolveParameter({ taxType: 'inss', competence, repository, context });
  const irrf = resolveParameter({ taxType: 'irrf', competence, repository, context });
  return {
    isValid: inss.isOk && irrf.isOk,
    competence: inss.competence || irrf.competence || '',
    inss: inss.parameter,
    irrf: irrf.parameter,
    warnings: [...(inss.warnings || []), ...(irrf.warnings || [])],
    errors: [...(inss.errors || []), ...(irrf.errors || [])]
  };
}

export function calcularINSS(baseTotal = 0, options = {}) {
  const result = CalculateINSS({
    competence: options.competence || options.context?.competence || '',
    grossIncomeCents: moneyToCents(roundCurrency(Number(baseTotal) || 0)),
    repository: options.repository || defaultRepository,
    context: { allowLegacyWithoutCompetence: true, ...(options.context || {}) }
  });
  return result.isValid ? result.amount : 0;
}

export function calcularIRRF(baseTotal = 0, inss = 0, options = {}) {
  const result = CalculateIRRF({
    competence: options.competence || options.context?.competence || '',
    grossIncomeCents: moneyToCents(roundCurrency(Number(baseTotal) || 0)),
    inssCents: moneyToCents(roundCurrency(Number(inss) || 0)),
    repository: options.repository || defaultRepository,
    context: { allowLegacyWithoutCompetence: true, ...(options.context || {}) }
  });
  return result.isValid ? result.amount : 0;
}

export function calcularLiquido({
  salarioBase = 0,
  horaExtra = 0,
  outrosProventos = 0,
  inss = 0,
  irrf = 0,
  outrosDescontos = 0
} = {}) {
  const grossIncomeCents = moneyToCents(roundCurrency(
    (Number(salarioBase) || 0) +
    (Number(horaExtra) || 0) +
    (Number(outrosProventos) || 0)
  ));
  const result = CalculateNetIncome({
    grossIncomeCents,
    inssCents: moneyToCents(roundCurrency(Number(inss) || 0)),
    irrfCents: moneyToCents(roundCurrency(Number(irrf) || 0)),
    otherDiscountsCents: moneyToCents(roundCurrency(Number(outrosDescontos) || 0)),
    context: { allowLegacyWithoutCompetence: true }
  });
  return result.netIncome;
}

export function createTaxEngine(repository = defaultRepository) {
  return {
    CalculateINSS: (input = {}) => CalculateINSS({ repository, ...input }),
    CalculateIRRF: (input = {}) => CalculateIRRF({ repository, ...input }),
    CalculateNetIncome: (input = {}) => CalculateNetIncome({ repository, ...input }),
    resolveTaxParametersByCompetence: (input = {}) => resolveTaxParametersByCompetence({ repository, ...input }),
    calcularINSS: (baseTotal = 0, options = {}) => calcularINSS(baseTotal, { repository, ...options }),
    calcularIRRF: (baseTotal = 0, inss = 0, options = {}) => calcularIRRF(baseTotal, inss, { repository, ...options }),
    calcularLiquido
  };
}

export { defaultRepository as legacyTaxParameterRepository };
