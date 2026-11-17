const TAB_BUTTON_ACTIVE_CLASS = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-accent/10 text-accent';
const TAB_BUTTON_IDLE_CLASS = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-textSecondary hover:bg-surfaceLight hover:text-textPrimary';
const DEFAULT_VIEWS = ['dashboard', 'mes-detalhe', 'saidas', 'entradas', 'parcelamentos', 'orcamentos', 'importacao', 'controle-horas', 'novo', 'configuracoes'];

export function activateTab(tab, target = globalThis, views = DEFAULT_VIEWS) {
  const documentRef = target.document || globalThis.document;
  if (!documentRef) return;

  documentRef.querySelectorAll('#main-tabs button').forEach((button) => {
    button.className = button.dataset.tab === tab ? TAB_BUTTON_ACTIVE_CLASS : TAB_BUTTON_IDLE_CLASS;
  });

  // Barra inferior do celular: Saidas e Entradas ficam juntas em "Lancamentos".
  const bottomTab = tab === 'entradas' ? 'saidas' : tab;
  documentRef.querySelectorAll('[data-bottom-tab]').forEach((button) => {
    button.setAttribute('aria-current', button.dataset.bottomTab === bottomTab ? 'page' : 'false');
  });

  views.forEach((view) => {
    const element = documentRef.getElementById('view-' + view);
    if (element) element.classList.toggle('hidden', view !== tab);
  });
}
