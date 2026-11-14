export function normalizeCompetenceKey(value = '') {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  return '';
}

// Fuso usado para "hoje": o escolhido pelo usuario em Configuracoes; sem ele, o do navegador.
function activeTimeZone(target = globalThis) {
  const zone = target?.financeApp?.userPreferences?.time_zone;
  return typeof zone === 'string' && zone ? zone : undefined;
}

/**
 * Data AAAA-MM-DD de `date` no fuso do usuario. Evita o bug de toISOString(),
 * que usa UTC: em Manaus, depois das 20h, "hoje" virava o dia seguinte;
 * em Madri, antes da 1h, virava o dia anterior.
 */
export function isoDateInTimeZone(date = new Date(), timeZone = activeTimeZone()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return isoDateInTimeZone(date, undefined);
  }
}

export function todayIsoDate(timeZone = activeTimeZone()) {
  return isoDateInTimeZone(new Date(), timeZone);
}

export function currentCompetenceKey(timeZone = activeTimeZone()) {
  return todayIsoDate(timeZone).slice(0, 7);
}

/** Soma dias a uma data AAAA-MM-DD sem passar por fuso (calendario puro). */
export function addDaysToIsoDate(isoDate, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return isoDate || '';
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}
