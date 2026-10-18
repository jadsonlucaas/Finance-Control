export function roundCurrency(value) {
  return Math.round(((Number(value) || 0) + 1e-8) * 100) / 100;
}

function parseExplicitCurrencyString(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const clean = raw.replace(/\s/g, '').replace(/R\$/gi, '');

  if (/^[+-]?\d+$/.test(clean)) return Number(clean);
  if (/^[+-]?\d+\.\d{1,2}$/.test(clean)) return Number(clean);
  if (/^[+-]?\d+,\d{1,2}$/.test(clean)) return Number(clean.replace(',', '.'));
  if (/^[+-]?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(clean)) {
    return Number(clean.replace(/\./g, '').replace(',', '.'));
  }

  throw new Error(`Valor monetario ambiguo ou invalido: ${value}`);
}

export function moneyToCents(value) {
  if (value === null || value === undefined || value === '') return 0;

  const numeric = typeof value === 'string'
    ? parseExplicitCurrencyString(value)
    : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error('Valor monetario deve ser finito.');
  }

  const cents = Math.round((numeric + Number.EPSILON) * 100);
  if (Math.abs(numeric * 100 - cents) > 1e-6) {
    throw new Error('Valor monetario deve ter no maximo duas casas decimais.');
  }
  return cents;
}

export function centsToMoney(cents) {
  if (!Number.isInteger(cents) || !Number.isFinite(cents)) {
    throw new Error('Centavos devem ser inteiro finito.');
  }
  return cents / 100;
}

export function splitAmountIntoInstallments(totalCents, count, policy = {}) {
  if (!Number.isInteger(totalCents) || !Number.isFinite(totalCents) || totalCents < 0) {
    throw new Error('Total em centavos deve ser inteiro nao negativo.');
  }
  if (!Number.isInteger(count) || !Number.isFinite(count) || count <= 0) {
    throw new Error('Quantidade de parcelas deve ser inteiro positivo.');
  }

  const residueTarget = policy.residueTarget || 'last';
  const base = Math.floor(totalCents / count);
  const residue = totalCents % count;
  const installments = Array.from({ length: count }, () => base);

  if (residueTarget === 'last') {
    installments[count - 1] += residue;
  } else if (residueTarget === 'first') {
    installments[0] += residue;
  } else if (residueTarget === 'distributed') {
    for (let index = 0; index < residue; index += 1) installments[index] += 1;
  } else {
    throw new Error(`Politica de residuo desconhecida: ${residueTarget}`);
  }

  return {
    totalCents,
    count,
    policy: residueTarget,
    baseCents: base,
    residueCents: residue,
    installments
  };
}

export function validateInstallmentSplit(result, totalCents) {
  const installments = Array.isArray(result?.installments) ? result.installments : [];
  const sumCents = installments.reduce((sum, value) => sum + value, 0);
  const min = installments.length ? Math.min(...installments) : 0;
  const max = installments.length ? Math.max(...installments) : 0;
  const maxDifferenceCents = max - min;

  return {
    isValid: sumCents === totalCents
      && installments.every((value) => Number.isInteger(value) && value >= 0)
      && maxDifferenceCents <= Math.max(1, result?.residueCents || 0),
    sumCents,
    expectedTotalCents: totalCents,
    differenceCents: sumCents - totalCents,
    maxDifferenceCents
  };
}

export function parseCurrencyValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return roundCurrency(value);

  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? roundCurrency(numeric) : 0;
}
