/**
 * Liga a janela de historico (core/recordsHistoryWindow.js) as telas:
 *
 * - escolher um mes/data anterior a janela em qualquer filtro carrega a partir dele;
 * - entrar na Importacao, ou usar importar/remover/arquivar em Configuracoes,
 *   carrega o historico completo antes (essas acoes comparam com tudo que existe);
 * - avisos `[data-history-window-notice]` mostram desde quando ha dados e o botao
 *   "Carregar histórico completo".
 */
import { formatCompetenceLabel, onLocaleChange, t } from '../../core/i18n.js';
import { HISTORY_MODE_WINDOW, HISTORY_WINDOW_EVENT, toCompetence } from '../../core/recordsHistoryWindow.js';

export const FULL_HISTORY_TABS = Object.freeze(['importacao']);
export const FULL_HISTORY_BUTTON_IDS = Object.freeze([
  'btn-import-saidas',
  'btn-import-saidas-force',
  'btn-remove-saidas',
  'btn-remove-all-saidas',
  'btn-import-entradas',
  'btn-import-entradas-force',
  'btn-archive-records',
  'btn-restore-archived-records'
]);
const NOTICE_SELECTOR = '[data-history-window-notice]';
const installed = new WeakSet();

function historyApi(target) {
  return target.financeHistoryWindow || null;
}

function currentTab(target) {
  const hash = String(target.location?.hash || '');
  return hash.replace(/^#\/?/, '').split(/[?/]/)[0] || '';
}

export function renderHistoryNotice(element, state = {}) {
  if (!element) return;
  const showWindow = state.mode === HISTORY_MODE_WINDOW && state.start;
  if (!showWindow) {
    element.replaceChildren();
    element.hidden = true;
    return;
  }
  element.hidden = false;
  const documentRef = element.ownerDocument;
  const text = documentRef.createElement('span');
  text.textContent = state.loading
    ? t('Carregando lançamentos...')
    : `${t('Mostrando lançamentos a partir de')} ${formatCompetenceLabel(state.start)}.`;
  const nodes = [text];
  if (!state.loading) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.dataset.historyLoadAll = 'true';
    button.className = 'ml-1 text-accent font-medium hover:underline focus-visible:underline';
    button.textContent = t('Carregar histórico completo');
    nodes.push(button);
  }
  element.replaceChildren(...nodes);
}

export function installHistoryWindowUi(target = globalThis) {
  const documentRef = target.document;
  if (!documentRef || installed.has(target)) return null;
  installed.add(target);

  const renderAll = (state = historyApi(target)?.getState?.() || {}) => {
    documentRef.querySelectorAll(NOTICE_SELECTOR).forEach((element) => renderHistoryNotice(element, state));
  };

  const ensureForTab = () => {
    if (FULL_HISTORY_TABS.includes(currentTab(target))) historyApi(target)?.ensureFull?.();
  };

  // Filtros de mes (input month) e de data (input date) anteriores a janela.
  documentRef.addEventListener('change', (event) => {
    const input = event.target;
    if (!input || input.tagName !== 'INPUT' || !['month', 'date'].includes(input.type)) return;
    const competence = toCompetence(input.value);
    if (competence) historyApi(target)?.ensureFrom?.(competence);
  }, true);

  // Acoes que comparam com todo o historico: segura o clique, carrega tudo e repete o clique.
  documentRef.addEventListener('click', (event) => {
    const loadAll = event.target?.closest?.('[data-history-load-all]');
    if (loadAll) {
      event.preventDefault();
      historyApi(target)?.ensureFull?.();
      return;
    }
    const button = event.target?.closest?.('button[id]');
    if (!button || !FULL_HISTORY_BUTTON_IDS.includes(button.id)) return;
    if (button.dataset.historyBypass === 'true') {
      // Clique repetido depois de carregar: segue para a acao original.
      delete button.dataset.historyBypass;
      return;
    }
    const api = historyApi(target);
    const state = api?.getState?.();
    if (!api?.ensureFull || !state || (state.mode !== HISTORY_MODE_WINDOW && !state.loading)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.historyPending === 'true') return;
    button.dataset.historyPending = 'true';
    Promise.resolve(api.ensureFull()).finally(() => {
      delete button.dataset.historyPending;
      button.dataset.historyBypass = 'true';
      button.click();
    });
  }, true);

  // Setas e atalhos de periodo do Dashboard mudam o filtro por codigo (sem evento "change").
  documentRef.addEventListener('click', () => {
    (target.setTimeout || setTimeout)(() => {
      const start = toCompetence(documentRef.getElementById?.('f-comp-start')?.value || '');
      if (start) historyApi(target)?.ensureFrom?.(start);
    }, 0);
  });

  target.addEventListener?.('hashchange', ensureForTab);
  target.addEventListener?.(HISTORY_WINDOW_EVENT, (event) => {
    renderAll(event.detail || {});
    ensureForTab();
  });
  onLocaleChange(() => renderAll());
  renderAll();
  ensureForTab();
  return { renderAll };
}
