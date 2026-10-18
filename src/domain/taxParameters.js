export const TAX_PARAMETER_SCHEMA_VERSION = 1;
export const TAX_TYPES = Object.freeze(['inss', 'irrf']);
export const TAX_PARAMETER_STATUSES = Object.freeze(['draft', 'active', 'archived']);

export const LEGACY_UNVERIFIED_TAX_PARAMETERS = Object.freeze([
  {
    id: 'legacy-unverified-inss-app-baseline',
    tax_type: 'inss',
    version: 'legacy-unverified-inss-app-baseline',
    valid_from: '2026-01',
    valid_to: '',
    status: 'active',
    source_name: 'baseline legado sem fonte',
    source_reference: 'Valores hardcoded existentes no app antes do versionamento.',
    source_published_at: '',
    notes: 'Nao utilizar como tabela oficial sem validacao externa. Mantem compatibilidade numerica do app.',
    brackets: [
      { from_cents: 0, to_cents: 162100, rate: 0.075, deduction_cents: 0, progressive: true, order: 1 },
      { from_cents: 162101, to_cents: 290284, rate: 0.09, deduction_cents: 0, progressive: true, order: 2 },
      { from_cents: 290285, to_cents: 435427, rate: 0.12, deduction_cents: 0, progressive: true, order: 3 },
      { from_cents: 435428, to_cents: 847555, rate: 0.14, deduction_cents: 0, progressive: true, order: 4 }
    ],
    deductions: {},
    ceiling_cents: 847555,
    created_at: '2026-08-21T00:00:00.000Z',
    updated_at: '2026-08-21T00:00:00.000Z',
    schema_version: TAX_PARAMETER_SCHEMA_VERSION
  },
  {
    id: 'legacy-unverified-irrf-app-baseline',
    tax_type: 'irrf',
    version: 'legacy-unverified-irrf-app-baseline',
    valid_from: '2026-01',
    valid_to: '',
    status: 'active',
    source_name: 'baseline legado sem fonte',
    source_reference: 'Valores hardcoded existentes no app antes do versionamento.',
    source_published_at: '',
    notes: 'Nao utilizar como tabela oficial sem validacao externa. Mantem compatibilidade numerica do app.',
    brackets: [
      { from_cents: 0, to_cents: 242880, rate: 0, deduction_cents: 0, order: 1 },
      { from_cents: 242881, to_cents: 282665, rate: 0.075, deduction_cents: 18216, order: 2 },
      { from_cents: 282666, to_cents: 375105, rate: 0.15, deduction_cents: 39416, order: 3 },
      { from_cents: 375106, to_cents: 466468, rate: 0.225, deduction_cents: 67549, order: 4 },
      { from_cents: 466469, to_cents: null, rate: 0.275, deduction_cents: 90873, order: 5 }
    ],
    deductions: {
      dependent_deduction_cents: 0,
      simplified_deduction_cents: 0,
      other_legal_deductions: false,
      reduction_rules: [
        {
          id: 'legacy-unverified-low-income-reduction',
          from_cents: 0,
          to_cents: 735000,
          zero_gross_until_cents: 500000,
          formula: 'max(0, 978.62 - 0.133145 * gross_income)',
          fixed_cents: 97862,
          factor: 0.133145,
          basis: 'gross_income'
        }
      ]
    },
    ceiling_cents: null,
    created_at: '2026-08-21T00:00:00.000Z',
    updated_at: '2026-08-21T00:00:00.000Z',
    schema_version: TAX_PARAMETER_SCHEMA_VERSION
  }
]);

function issue(field, code, message, severity = 'error') {
  return { field, code, message, severity };
}

export function isCompetence(value = '') {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

export function compareCompetence(a = '', b = '') {
  return String(a || '').localeCompare(String(b || ''));
}

function isIntegerCents(value) {
  return value === null || (Number.isInteger(value) && Number.isFinite(value) && value >= 0);
}

function validateBracket(bracket = {}, index = 0, taxType = '') {
  const errors = [];
  const prefix = `brackets[${index}]`;
  if (!Number.isInteger(bracket.order) || bracket.order <= 0) {
    errors.push(issue(`${prefix}.order`, 'INVALID_BRACKET_ORDER', 'Ordem da faixa deve ser inteiro positivo.'));
  }
  if (!Number.isInteger(bracket.from_cents) || bracket.from_cents < 0) {
    errors.push(issue(`${prefix}.from_cents`, 'INVALID_CENTS', 'from_cents deve ser inteiro em centavos.'));
  }
  if (bracket.to_cents !== undefined && !isIntegerCents(bracket.to_cents)) {
    errors.push(issue(`${prefix}.to_cents`, 'INVALID_CENTS', 'to_cents deve ser inteiro em centavos ou null.'));
  }
  if (!Number.isFinite(bracket.rate) || bracket.rate < 0 || bracket.rate > 1) {
    errors.push(issue(`${prefix}.rate`, 'INVALID_RATE', 'Aliquota deve ser finita entre 0 e 1.'));
  }
  if (taxType === 'irrf' && !isIntegerCents(bracket.deduction_cents)) {
    errors.push(issue(`${prefix}.deduction_cents`, 'INVALID_CENTS', 'IRRF exige deduction_cents inteiro.'));
  }
  if (bracket.deduction_cents !== undefined && !isIntegerCents(bracket.deduction_cents)) {
    errors.push(issue(`${prefix}.deduction_cents`, 'INVALID_CENTS', 'deduction_cents deve ser inteiro em centavos.'));
  }
  if (bracket.to_cents !== null && bracket.to_cents !== undefined && bracket.from_cents > bracket.to_cents) {
    errors.push(issue(`${prefix}.to_cents`, 'INVALID_BRACKET_RANGE', 'Fim da faixa nao pode ser menor que o inicio.'));
  }
  return errors;
}

export function validateTaxParameter(input = {}) {
  const errors = [];
  const warnings = [];
  const parameter = { ...input };

  if (!TAX_TYPES.includes(parameter.tax_type)) {
    errors.push(issue('tax_type', 'INVALID_TAX_TYPE', 'tax_type deve ser inss ou irrf.'));
  }
  if (!parameter.version || typeof parameter.version !== 'string') {
    errors.push(issue('version', 'VERSION_REQUIRED', 'version e obrigatoria.'));
  }
  if (!isCompetence(parameter.valid_from)) {
    errors.push(issue('valid_from', 'INVALID_VALID_FROM', 'valid_from deve estar em YYYY-MM.'));
  }
  if (parameter.valid_to && !isCompetence(parameter.valid_to)) {
    errors.push(issue('valid_to', 'INVALID_VALID_TO', 'valid_to deve estar em YYYY-MM.'));
  }
  if (parameter.valid_to && parameter.valid_from && compareCompetence(parameter.valid_to, parameter.valid_from) < 0) {
    errors.push(issue('valid_to', 'VALID_TO_BEFORE_VALID_FROM', 'valid_to nao pode ser anterior a valid_from.'));
  }
  if (!TAX_PARAMETER_STATUSES.includes(parameter.status)) {
    errors.push(issue('status', 'INVALID_STATUS', 'status deve ser draft, active ou archived.'));
  }
  if (parameter.status === 'active' && !String(parameter.source_name || '').trim()) {
    errors.push(issue('source_name', 'SOURCE_REQUIRED_FOR_ACTIVE', 'Versao ativa exige source_name.'));
  }
  if (!Array.isArray(parameter.brackets) || !parameter.brackets.length) {
    errors.push(issue('brackets', 'BRACKETS_REQUIRED', 'Parametros exigem ao menos uma faixa.'));
  }
  if (parameter.ceiling_cents !== undefined && !isIntegerCents(parameter.ceiling_cents)) {
    errors.push(issue('ceiling_cents', 'INVALID_CEILING', 'ceiling_cents deve ser inteiro em centavos ou null.'));
  }

  const brackets = [...(Array.isArray(parameter.brackets) ? parameter.brackets : [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  brackets.forEach((bracket, index) => errors.push(...validateBracket(bracket, index, parameter.tax_type)));

  const seenOrders = new Set();
  brackets.forEach((bracket, index) => {
    if (seenOrders.has(bracket.order)) errors.push(issue(`brackets[${index}].order`, 'DUPLICATE_BRACKET_ORDER', 'Ordem de faixa duplicada.'));
    seenOrders.add(bracket.order);
  });

  if (brackets.length && Number(brackets[0].from_cents) !== 0) {
    errors.push(issue('brackets[0].from_cents', 'FIRST_BRACKET_MUST_START_ZERO', 'Primeira faixa deve iniciar em zero.'));
  }
  for (let index = 1; index < brackets.length; index += 1) {
    const previous = brackets[index - 1];
    const current = brackets[index];
    if (previous.to_cents === null || previous.to_cents === undefined) {
      errors.push(issue(`brackets[${index - 1}].to_cents`, 'OPEN_BRACKET_NOT_LAST', 'Somente a ultima faixa pode ser aberta.'));
      continue;
    }
    if (current.from_cents <= previous.to_cents) {
      errors.push(issue(`brackets[${index}].from_cents`, 'OVERLAPPING_BRACKET', 'Faixas nao podem se sobrepor.'));
    }
    if (current.from_cents > previous.to_cents + 1) {
      warnings.push(issue(`brackets[${index}].from_cents`, 'BRACKET_GAP', 'Ha gap entre faixas.', 'warning'));
    }
  }

  return {
    isValid: errors.length === 0,
    parameter,
    errors,
    warnings
  };
}

function periodsOverlap(a = {}, b = {}) {
  const aEnd = a.valid_to || '9999-12';
  const bEnd = b.valid_to || '9999-12';
  return compareCompetence(a.valid_from, bEnd) <= 0 && compareCompetence(b.valid_from, aEnd) <= 0;
}

export function validateTaxParameterTimeline(parameters = [], taxType = '') {
  const source = (Array.isArray(parameters) ? parameters : []).filter((item) => !taxType || item.tax_type === taxType);
  const errors = [];
  const warnings = [];

  source.forEach((parameter) => {
    const result = validateTaxParameter(parameter);
    errors.push(...result.errors.map((item) => ({ ...item, parameter_id: parameter.id || parameter.version || '' })));
    warnings.push(...result.warnings.map((item) => ({ ...item, parameter_id: parameter.id || parameter.version || '' })));
  });

  const byType = new Map();
  source.filter((item) => item.status === 'active').forEach((parameter) => {
    if (!byType.has(parameter.tax_type)) byType.set(parameter.tax_type, []);
    byType.get(parameter.tax_type).push(parameter);
  });

  byType.forEach((items, type) => {
    const sorted = [...items].sort((a, b) => compareCompetence(a.valid_from, b.valid_from));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (periodsOverlap(previous, current)) {
        errors.push(issue('valid_from', 'TIMELINE_OVERLAP', `Sobreposicao em ${type}: ${previous.version} x ${current.version}.`));
      } else if (previous.valid_to && compareCompetence(current.valid_from, previous.valid_to) > 0) {
        warnings.push(issue('valid_from', 'TIMELINE_GAP', `Possivel gap em ${type} entre ${previous.version} e ${current.version}.`, 'warning'));
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    total: source.length
  };
}

export function normalizeTaxParameters(parameters = LEGACY_UNVERIFIED_TAX_PARAMETERS) {
  return JSON.parse(JSON.stringify(parameters));
}
