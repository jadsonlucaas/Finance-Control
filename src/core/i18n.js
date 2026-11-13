/**
 * Idioma da interface.
 *
 * O texto-fonte do app e o portugues (pt-BR). As traducoes sao dicionarios
 * "texto em portugues -> texto traduzido", assim a traducao das telas antigas pode ser feita
 * aos poucos, sem trocar cada texto do codigo por uma chave. Texto sem traducao continua em
 * portugues. Frases com partes variaveis usam `patterns` (expressao regular + substituicao).
 */
import { ES_ES } from '../i18n/es-ES.js';

export const DEFAULT_LOCALE = 'pt-BR';
export const UI_LOCALES = Object.freeze(['pt-BR', 'es-ES']);

const CATALOGS = Object.freeze({ 'es-ES': ES_ES });
let currentLocale = DEFAULT_LOCALE;
const listeners = new Set();

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  const next = UI_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  if (next === currentLocale) return currentLocale;
  currentLocale = next;
  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch {
      // Um ouvinte com erro nao impede os outros.
    }
  });
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
  if (translated === undefined || translated === key) return text;
  const start = text.slice(0, text.indexOf(trimmed));
  const end = text.slice(text.indexOf(trimmed) + trimmed.length);
  return `${start}${translated}${end}`;
}

export const t = (text) => translateText(text);
