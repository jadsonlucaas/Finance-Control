// Nome do app num lugar só.
//
// A marca definitiva ainda não foi aprovada; até lá o app usa um nome
// provisório. Para trocar, basta definir VITE_APP_NAME na Vercel (e redeploy)
// ou mudar DEFAULT_APP_NAME aqui. Textos de interface e mensagens evitam citar
// o nome; só o título da aba, o topo e a tela de entrada usam esta constante.

import { onLocaleChange, translateText } from './i18n.js';

export const DEFAULT_APP_NAME = 'Controle Financeiro';

export function resolveAppName(env = {}) {
  const value = String(env?.VITE_APP_NAME ?? '').replace(/\s+/g, ' ').trim();
  return value || DEFAULT_APP_NAME;
}

export const APP_NAME = resolveAppName(import.meta.env || {});

/** Aplica o nome no título da aba, no topo (#app-title) e na tela de entrada. */
export function applyAppName(target = globalThis, name = APP_NAME) {
  const documentRef = target?.document;
  if (!documentRef) return name;
  const translate = (text) => translateText(text) || text;
  const label = translate(name);
  documentRef.title = label;
  documentRef.querySelectorAll?.('[data-app-name]').forEach((element) => {
    element.textContent = label;
  });
  const title = documentRef.getElementById?.('app-title');
  if (title) title.textContent = label;
  return label;
}

/** Aplica agora e de novo quando o idioma da conta muda. */
export function installAppName(target = globalThis) {
  applyAppName(target);
  onLocaleChange(() => applyAppName(target));
  target.financeBrand = Object.freeze({ name: APP_NAME, apply: () => applyAppName(target) });
}
