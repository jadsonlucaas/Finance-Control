// Fecha com a tecla Esc o modal visivel que estiver por cima.
//
// Preferimos acionar o botao de fechar do proprio modal (assim cada tela roda a
// sua logica de limpeza). So escondemos direto quando o modal nao tem botao.

const MODAL_SELECTOR = '[id$="-modal"], [id$="-overlay"]';
const CLOSE_SELECTOR = [
  '[data-close-modal]',
  '[id^="btn-close"]',
  '[data-legacy-click^="close"]',
  'button[aria-label="Fechar"]',
  'button[aria-label^="Fechar "]',
  'button[title="Fechar"]'
].join(', ');

function isOpenModal(element, view) {
  if (!element || element.classList?.contains('hidden')) return false;
  const style = view?.getComputedStyle?.(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.position !== 'fixed')) return false;
  return true;
}

function zIndexOf(element, view) {
  const value = Number.parseInt(view?.getComputedStyle?.(element)?.zIndex, 10);
  return Number.isFinite(value) ? value : 0;
}

export function findTopmostOpenModal(documentRef, view = documentRef?.defaultView) {
  const open = [...(documentRef?.querySelectorAll?.(MODAL_SELECTOR) || [])]
    .filter((element) => isOpenModal(element, view));
  if (!open.length) return null;
  // Maior z-index vence; em empate, o ultimo no DOM (aberto por cima).
  return open.reduce((top, element) => (zIndexOf(element, view) >= zIndexOf(top, view) ? element : top));
}

export function closeTopmostModal(documentRef, view = documentRef?.defaultView) {
  const modal = findTopmostOpenModal(documentRef, view);
  if (!modal) return false;
  const closeButton = modal.querySelector?.(CLOSE_SELECTOR);
  if (closeButton) closeButton.click();
  else modal.classList.add('hidden');
  return true;
}

export function installModalKeyboard(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || documentRef.documentElement?.dataset?.financeModalKeyboardBound) return false;
  documentRef.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    if (closeTopmostModal(documentRef, target)) event.preventDefault();
  });
  if (documentRef.documentElement?.dataset) documentRef.documentElement.dataset.financeModalKeyboardBound = 'true';
  return true;
}
