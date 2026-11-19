/**
 * Abertura do app sem "piscar" telas.
 *
 * - `app-booting` (posto no <html> pelo index.html antes do primeiro desenho): enquanto o
 *   Firebase confere se ja existe sessao, mostra so a tela de carregamento. Assim, ao
 *   atualizar a pagina logado, a tela de login nao aparece antes do Inicio.
 * - `finance-data-pending`: depois do acesso liberado, ate chegar a primeira leitura dos
 *   lancamentos, o conteudo fica escondido atras do carregamento (em vez de mostrar R$ 0,00).
 *
 * Os dois estados tem limite de tempo: se algo falhar, a tela normal volta sozinha.
 * - Enquanto espera os dados, um esqueleto do Inicio aparece no lugar do conteudo.
 * - Se os dados nao chegarem no limite, `finance-data-slow` mostra um aviso com
 *   "Tentar de novo" (em vez de deixar a pessoa achar que a conta zerou).
 */
const BOOT_CLASS = 'app-booting';
const DATA_CLASS = 'finance-data-pending';
const SLOW_CLASS = 'finance-data-slow';

const SKELETON_HTML = `
  <div class="skeleton-block skeleton-hero"></div>
  <div class="skeleton-grid">
    <div class="skeleton-block skeleton-tile"></div>
    <div class="skeleton-block skeleton-tile"></div>
    <div class="skeleton-block skeleton-tile"></div>
    <div class="skeleton-block skeleton-tile"></div>
  </div>
  <div class="skeleton-block skeleton-row"></div>
  <div class="skeleton-block skeleton-row"></div>
  <div class="skeleton-block skeleton-row"></div>`;

function ensureLoadStateElements(target) {
  const documentRef = target?.document;
  const main = documentRef?.getElementById?.('main-content');
  if (!main || typeof documentRef.createElement !== 'function') return;
  if (!documentRef.getElementById('data-skeleton')) {
    const skeleton = documentRef.createElement('div');
    skeleton.id = 'data-skeleton';
    skeleton.className = 'data-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.innerHTML = SKELETON_HTML;
    main.prepend(skeleton);
  }
  if (!documentRef.getElementById('data-slow-notice')) {
    const notice = documentRef.createElement('div');
    notice.id = 'data-slow-notice';
    notice.className = 'state-notice state-notice-warn';
    notice.setAttribute('role', 'alert');
    const translate = (text) => target?.financeI18n?.translate?.(text) || text;
    notice.innerHTML = `<div class="state-notice-text">
        <strong>${translate('Seus dados estão demorando para carregar.')}</strong>
        <span>${translate('Confira a internet e tente de novo. Nada foi perdido.')}</span>
      </div>
      <button type="button" class="state-notice-action" data-reload-app>${translate('Tentar de novo')}</button>`;
    notice.querySelector('[data-reload-app]')?.addEventListener('click', () => target.location?.reload?.());
    main.prepend(notice);
  }
}
const BOOT_TIMEOUT_MS = 8000;
const DATA_TIMEOUT_MS = 10000;

function rootOf(target) {
  return target?.document?.documentElement || null;
}

export function endAppBoot(target = globalThis) {
  rootOf(target)?.classList.remove(BOOT_CLASS);
}

export function beginDataPending(target = globalThis) {
  const root = rootOf(target);
  if (!root || target.__financeFirstDataReceived) return;
  ensureLoadStateElements(target);
  root.classList.remove(SLOW_CLASS);
  root.classList.add(DATA_CLASS);
  clearTimeout(target.__financeDataPendingTimer);
  target.__financeDataPendingTimer = setTimeout(() => {
    endDataPending(target);
    rootOf(target)?.classList.add(SLOW_CLASS);
  }, DATA_TIMEOUT_MS);
}

export function endDataPending(target = globalThis) {
  clearTimeout(target.__financeDataPendingTimer);
  rootOf(target)?.classList.remove(DATA_CLASS);
}

export function markFirstDataReceived(target = globalThis) {
  target.__financeFirstDataReceived = true;
  endDataPending(target);
  rootOf(target)?.classList.remove(SLOW_CLASS);
}

export function resetFirstData(target = globalThis) {
  target.__financeFirstDataReceived = false;
  endDataPending(target);
  rootOf(target)?.classList.remove(SLOW_CLASS);
}

/**
 * Esconde uma tela enquanto o modulo dela carrega (a linha de carregamento corre no topo).
 * Devolve a funcao que libera a tela; ela tambem e liberada sozinha depois de 10 s.
 */
export function holdViewWhileLoading(target = globalThis, viewId = '') {
  const documentRef = target?.document;
  const view = documentRef?.getElementById?.(viewId);
  const root = documentRef?.documentElement;
  if (!view || !root) return () => {};
  view.classList.add('view-loading');
  root.classList.add('finance-view-loading');
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    view.classList.remove('view-loading');
    if (!documentRef.querySelector('.view-loading')) root.classList.remove('finance-view-loading');
  };
  const timer = setTimeout(release, DATA_TIMEOUT_MS);
  return release;
}

export function installAppBoot(target = globalThis) {
  if (!target?.document || target.financeAppBoot) return target?.financeAppBoot || null;
  const api = {
    endAppBoot: () => endAppBoot(target),
    beginDataPending: () => beginDataPending(target),
    markFirstDataReceived: () => markFirstDataReceived(target),
    resetFirstData: () => resetFirstData(target)
  };
  target.financeAppBoot = api;
  setTimeout(() => endAppBoot(target), BOOT_TIMEOUT_MS);
  return api;
}
