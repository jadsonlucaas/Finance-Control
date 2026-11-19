const TAB_BUTTON_ACTIVE_CLASS = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-accent/10 text-accent';
const TAB_BUTTON_IDLE_CLASS = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-textSecondary hover:bg-surfaceLight hover:text-textPrimary';
const DEFAULT_VIEWS = ['dashboard', 'mes-detalhe', 'saidas', 'entradas', 'parcelamentos', 'orcamentos', 'importacao', 'controle-horas', 'novo', 'configuracoes'];

export function sidebarTabFor(tab) {
  if (tab === 'entradas') return 'saidas';
  if (tab === 'importacao') return 'configuracoes';
  return tab;
}

export function activateTab(tab, target = globalThis, views = DEFAULT_VIEWS) {
  const documentRef = target.document || globalThis.document;
  if (!documentRef) return;

  // Menu lateral: Saidas e Entradas ficam juntas em "Lancamentos" e a
  // Importacao mora dentro de Configuracoes.
  const sidebarTab = sidebarTabFor(tab);
  documentRef.querySelectorAll('#main-tabs button').forEach((button) => {
    button.className = button.dataset.tab === sidebarTab ? TAB_BUTTON_ACTIVE_CLASS : TAB_BUTTON_IDLE_CLASS;
  });

  // Barra inferior do celular: Saidas e Entradas ficam juntas em "Lancamentos".
  const bottomTab = sidebarTab;
  documentRef.querySelectorAll('[data-bottom-tab]').forEach((button) => {
    button.setAttribute('aria-current', button.dataset.bottomTab === bottomTab ? 'page' : 'false');
  });

  const previous = views.find((view) => {
    const element = documentRef.getElementById('view-' + view);
    return element && !element.classList.contains('hidden');
  });
  views.forEach((view) => {
    const element = documentRef.getElementById('view-' + view);
    if (element) element.classList.toggle('hidden', view !== tab);
  });
  // Tela nova sempre abre no topo (antes herdava a rolagem da tela anterior).
  if (previous !== tab) {
    const main = documentRef.getElementById('main-content');
    if (main) main.scrollTop = 0;
  }
}
