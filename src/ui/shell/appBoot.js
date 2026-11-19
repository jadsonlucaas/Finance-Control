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
 */
const BOOT_CLASS = 'app-booting';
const DATA_CLASS = 'finance-data-pending';
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
  root.classList.add(DATA_CLASS);
  clearTimeout(target.__financeDataPendingTimer);
  target.__financeDataPendingTimer = setTimeout(() => endDataPending(target), DATA_TIMEOUT_MS);
}

export function endDataPending(target = globalThis) {
  clearTimeout(target.__financeDataPendingTimer);
  rootOf(target)?.classList.remove(DATA_CLASS);
}

export function markFirstDataReceived(target = globalThis) {
  target.__financeFirstDataReceived = true;
  endDataPending(target);
}

export function resetFirstData(target = globalThis) {
  target.__financeFirstDataReceived = false;
  endDataPending(target);
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
