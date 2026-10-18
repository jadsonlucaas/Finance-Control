import {
  LEGACY_UNVERIFIED_TAX_PARAMETERS,
  compareCompetence,
  isCompetence,
  normalizeTaxParameters,
  validateTaxParameter,
  validateTaxParameterTimeline
} from './taxParameters.js';

function structuredError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class InMemoryTaxParameterRepository {
  constructor(parameters = LEGACY_UNVERIFIED_TAX_PARAMETERS) {
    this.parameters = normalizeTaxParameters(parameters);
  }

  listByType(taxType = '') {
    return clone(this.parameters.filter((item) => !taxType || item.tax_type === taxType));
  }

  getById(id = '') {
    const found = this.parameters.find((item) => item.id === id || item.version === id);
    return found ? clone(found) : null;
  }

  findEffective(taxType = '', competence = '') {
    if (!isCompetence(competence)) {
      return {
        isOk: false,
        parameter: null,
        errors: [{ code: 'COMPETENCE_REQUIRED', message: 'Competencia deve estar em YYYY-MM.' }],
        warnings: []
      };
    }
    const timeline = validateTaxParameterTimeline(this.parameters, taxType);
    if (!timeline.isValid) {
      return {
        isOk: false,
        parameter: null,
        errors: timeline.errors,
        warnings: timeline.warnings
      };
    }
    const candidates = this.parameters
      .filter((item) => item.tax_type === taxType && item.status === 'active')
      .filter((item) => compareCompetence(item.valid_from, competence) <= 0)
      .filter((item) => !item.valid_to || compareCompetence(competence, item.valid_to) <= 0)
      .sort((a, b) => compareCompetence(b.valid_from, a.valid_from));

    if (!candidates.length) {
      return {
        isOk: false,
        parameter: null,
        errors: [{ code: 'TAX_PARAMETER_NOT_FOUND', message: `Tabela ${taxType} nao encontrada para ${competence}.` }],
        warnings: timeline.warnings
      };
    }

    return {
      isOk: true,
      parameter: clone(candidates[0]),
      errors: [],
      warnings: timeline.warnings
    };
  }

  createDraft(parameters = {}) {
    const draft = {
      ...parameters,
      status: 'draft',
      id: parameters.id || `${parameters.tax_type || 'tax'}-${parameters.version || Date.now()}`
    };
    const validation = validateTaxParameter(draft);
    if (!validation.isValid) throw structuredError('TAX_PARAMETER_INVALID', 'Parametro tributario invalido.', validation);
    this.parameters.push(clone(draft));
    return clone(draft);
  }

  activateVersion(id = '') {
    const index = this.parameters.findIndex((item) => item.id === id || item.version === id);
    if (index < 0) throw structuredError('TAX_PARAMETER_NOT_FOUND', 'Parametro nao encontrado.');
    const next = { ...this.parameters[index], status: 'active' };
    const validation = validateTaxParameter(next);
    if (!validation.isValid) throw structuredError('TAX_PARAMETER_INVALID', 'Parametro tributario invalido.', validation);
    const timeline = validateTaxParameterTimeline([
      ...this.parameters.slice(0, index),
      next,
      ...this.parameters.slice(index + 1)
    ], next.tax_type);
    if (!timeline.isValid) throw structuredError('TAX_TIMELINE_INVALID', 'Timeline tributaria invalida.', timeline);
    this.parameters[index] = next;
    return clone(next);
  }

  archiveVersion(id = '') {
    const index = this.parameters.findIndex((item) => item.id === id || item.version === id);
    if (index < 0) throw structuredError('TAX_PARAMETER_NOT_FOUND', 'Parametro nao encontrado.');
    this.parameters[index] = { ...this.parameters[index], status: 'archived' };
    return clone(this.parameters[index]);
  }

  validateTimeline(taxType = '') {
    return validateTaxParameterTimeline(this.parameters, taxType);
  }
}

export function createLegacyTaxParameterRepository(parameters = LEGACY_UNVERIFIED_TAX_PARAMETERS) {
  return new InMemoryTaxParameterRepository(parameters);
}
