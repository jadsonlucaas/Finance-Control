import { moneyToCents, roundCurrency } from '../core/money.js';
import { CalculateINSS, CalculateIRRF } from './taxes.js';

function toMoney(value = 0) {
  return roundCurrency(Number(value) || 0);
}

function workIncomeCents(entry = {}) {
  return moneyToCents(roundCurrency(
    toMoney(entry.salaryBase ?? entry.salary_base ?? entry.salarioBase ?? 0) +
    toMoney(entry.hourExtra ?? entry.horaExtra ?? 0) +
    toMoney(entry.dsrProventos ?? entry.dsr ?? 0)
  ));
}

export function dryRunTaxHistory(entries = [], { repository, competenceResolver = null } = {}) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const competence = competenceResolver
      ? competenceResolver(entry)
      : entry.competencia || entry.competence || '';
    const grossIncomeCents = workIncomeCents(entry);
    const inss = CalculateINSS({ competence, grossIncomeCents, repository });
    const irrf = CalculateIRRF({
      competence,
      grossIncomeCents,
      inssCents: inss.amountCents,
      repository
    });
    const currentInssCents = moneyToCents(toMoney(entry.inss ?? entry.INSS ?? 0));
    const currentIrrfCents = moneyToCents(toMoney(entry.irrf ?? entry.IRRF ?? 0));

    return {
      id: entry.id || '',
      person: entry.person || '',
      competence,
      grossIncomeCents,
      currentInssCents,
      calculatedInssCents: inss.amountCents,
      inssDifferenceCents: inss.amountCents - currentInssCents,
      currentIrrfCents,
      calculatedIrrfCents: irrf.amountCents,
      irrfDifferenceCents: irrf.amountCents - currentIrrfCents,
      inssParameterVersion: inss.parameterVersion,
      irrfParameterVersion: irrf.parameterVersion,
      isValid: inss.isValid && irrf.isValid,
      warnings: [...(inss.warnings || []), ...(irrf.warnings || [])],
      errors: [...(inss.errors || []), ...(irrf.errors || [])]
    };
  });
}
