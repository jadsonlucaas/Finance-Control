export const MAIN_TABS = ['dashboard', 'saidas', 'entradas', 'parcelamentos', 'importacao', 'controle-horas', 'configuracoes'];

export function isMainTab(tab) {
  return MAIN_TABS.includes(tab);
}

export const TAB_BUTTON_ACTIVE_CLASS = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-accent/10 text-accent';
export const TAB_BUTTON_IDLE_CLASS = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-textSecondary hover:bg-surfaceLight hover:text-textPrimary';
export const APP_VIEWS = ['dashboard', 'mes-detalhe', 'saidas', 'entradas', 'parcelamentos', 'importacao', 'controle-horas', 'novo', 'configuracoes'];

export function canGoBack(tabHistory = []) {
  return Array.isArray(tabHistory) && tabHistory.length > 0;
}
