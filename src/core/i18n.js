/**
 * Idioma da interface.
 *
 * O texto-fonte do app e o portugues (pt-BR). As traducoes sao dicionarios
 * "texto em portugues -> texto traduzido", assim a traducao das telas antigas pode ser feita
 * aos poucos, sem trocar cada texto do codigo por uma chave. Texto sem traducao continua em
 * portugues. Frases com partes variaveis usam `patterns` (expressao regular + substituicao).
 */
export const DEFAULT_LOCALE = 'pt-BR';
export const UI_LOCALES = Object.freeze(['pt-BR', 'es-ES']);

// Os dicionarios sao carregados sob demanda: quem usa pt-BR nao baixa nenhum.
const LOADERS = Object.freeze({
  'es-ES': () => import('../i18n/es-ES.js').then((module) => module.ES_ES)
});
const CATALOGS = {};
let currentLocale = DEFAULT_LOCALE;
const listeners = new Set();

export function getLocale() {
  return currentLocale;
}

function notify(locale) {
  listeners.forEach((listener) => {
    try {
      listener(locale);
    } catch {
      // Um ouvinte com erro nao impede os outros.
    }
  });
}

/** Carrega o dicionario do idioma (uma vez). Sem dicionario, o texto fica em portugues. */
export async function loadCatalog(locale) {
  if (CATALOGS[locale] || !LOADERS[locale]) return CATALOGS[locale] || null;
  try {
    CATALOGS[locale] = await LOADERS[locale]();
  } catch {
    return null;
  }
  return CATALOGS[locale];
}

/**
 * Troca o idioma. Devolve uma Promise que termina quando o dicionario esta pronto e os
 * ouvintes (ex.: o tradutor da tela) ja foram avisados.
 */
export async function setLocale(locale) {
  const next = UI_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  if (next === currentLocale) return currentLocale;
  currentLocale = next;
  if (LOADERS[next] && !CATALOGS[next]) {
    await loadCatalog(next);
    if (currentLocale !== next) return currentLocale; // trocou de novo enquanto carregava
  }
  notify(next);
  return currentLocale;
}

export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function catalogFor(locale) {
  return CATALOGS[locale] || null;
}

/**
 * Traduz um texto em portugues para o idioma atual (ou o informado).
 * Mantem espacos nas pontas; devolve o proprio texto quando nao ha traducao.
 */
export function translateText(text, locale = currentLocale) {
  const catalog = catalogFor(locale);
  if (!catalog || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  // Quebras de linha e espacos repetidos do HTML nao fazem parte da chave.
  const key = trimmed.replace(/\s+/g, ' ');
  let translated = catalog.messages[key];
  if (translated === undefined) {
    for (const [pattern, replacement] of catalog.patterns) {
      if (pattern.test(key)) {
        translated = key.replace(pattern, replacement);
        break;
      }
    }
  }
  // Itens de lista desenhados com marcador ("• texto"): traduz o texto e mantem o marcador.
  if (translated === undefined) {
    const bullet = /^([•\-–]\s+)(.+)$/.exec(key);
    if (bullet) {
      const inner = translateText(bullet[2], locale);
      if (inner !== bullet[2]) translated = `${bullet[1]}${inner}`;
    }
  }
  if (translated === undefined || translated === key) return text;
  const start = text.slice(0, text.indexOf(trimmed));
  const end = text.slice(text.indexOf(trimmed) + trimmed.length);
  return `${start}${translated}${end}`;
}

export const t = (text) => translateText(text);

const MONTH_ABBREVIATIONS = Object.freeze({
  'pt-BR': Object.freeze(['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']),
  'es-ES': Object.freeze(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'])
});

/** Abreviacoes dos meses no idioma (usadas em "nov/2026" nos graficos, listas e titulos). */
export function monthAbbreviations(locale = currentLocale) {
  return MONTH_ABBREVIATIONS[locale] || MONTH_ABBREVIATIONS[DEFAULT_LOCALE];
}

/** "2026-02" -> "fev/2026" (pt-BR) ou "feb/2026" (es-ES). */
export function formatCompetenceLabel(competence, locale = currentLocale) {
  if (!competence) return '';
  const [year, month] = String(competence).split('-');
  const index = Number.parseInt(month, 10) - 1;
  if (!year || !(index >= 0 && index < 12)) return String(competence);
  return `${monthAbbreviations(locale)[index]}/${year}`;
}
