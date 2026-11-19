// Saídas: os filtros ficam atrás do botão "Filtros" (no celular ocupavam a
// tela inteira antes da lista). O botão mostra quantos filtros estão ativos.
const FILTER_IDS = [
  'saidas-payment-filter',
  'saidas-person-filter',
  'saidas-cycle-filter',
  'saidas-macro-filter',
  'saidas-date-start-filter',
  'saidas-date-end-filter'
];

export function countActiveFilters(values = []) {
  return values.filter((value) => String(value ?? '').trim() !== '').length;
}

export function installListFilters(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.__financeListFiltersInstalled) return;
  target.__financeListFiltersInstalled = true;

  function paint() {
    const button = documentRef.getElementById('btn-saidas-filters');
    if (!button) return;
    const count = countActiveFilters(FILTER_IDS.map((id) => documentRef.getElementById(id)?.value));
    const badge = button.querySelector('[data-filters-count]');
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = String(count);
    }
  }

  documentRef.addEventListener('click', (event) => {
    const button = event.target?.closest?.('#btn-saidas-filters');
    if (!button) return;
    const view = documentRef.getElementById('view-saidas');
    const open = !view?.classList.contains('list-filters-open');
    view?.classList.toggle('list-filters-open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  documentRef.addEventListener('change', (event) => {
    if (FILTER_IDS.includes(event.target?.id)) paint();
  });
  // Filtros também mudam por código (atalhos do Início): a linha de resumo da
  // lista é redesenhada a cada filtragem, então o contador acompanha por ela.
  const meta = documentRef.getElementById('saidas-meta');
  if (meta && typeof target.MutationObserver === 'function') {
    new target.MutationObserver(paint).observe(meta, { childList: true, characterData: true, subtree: true });
  }
  paint();
}
