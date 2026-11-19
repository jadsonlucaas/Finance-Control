import { emptyStateHtml } from '../../components/emptyState.js';
import { ledgerSwitchTemplate } from './ledgerSwitchTemplate.js';

export function viewEntradasTemplate() {
  return `
<!-- ENTRADAS LIST -->
            <section id="view-entradas" class="fade-in hidden">
                <div class="entradas-header flex justify-between items-center mb-3 gap-3 flex-wrap">
                    <div class="entradas-header-copy">
                        ${ledgerSwitchTemplate('entradas')}
                        <h2 class="font-semibold">Entradas</h2>
                        <p id="entradas-meta" class="text-xs text-textSecondary mt-1">Visao consolidada mensal por pessoa e competencia.</p>
                        <p data-history-window-notice class="history-window-notice text-xs text-textSecondary mt-1" aria-live="polite" hidden></p>
                    </div>
                    <div class="entradas-toolbar mobile-section-actions flex gap-2 flex-wrap">
                        <input
                            id="entradas-search"
                            type="search"
                            placeholder="Buscar pessoa ou competencia"
                            class="entradas-search text-xs rounded-lg border border-surfaceLight bg-surfaceLight/40 text-textPrimary placeholder:text-textSecondary px-3 py-1.5 min-w-[180px]">
                        <input id="entradas-competence-filter" type="month" class="entradas-competence text-xs rounded-lg min-w-[150px]">
                        <button
                            id="btn-new-entrada"
                            type="button"
                            class="entradas-new-button bg-accent hover:bg-accentDark text-bg text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><i
                                data-lucide="plus" class="w-4 h-4"></i> Nova entrada</button>
                    </div>
                </div>
                <div id="entradas-list" class="space-y-3"></div>
                ${emptyStateHtml({ id: 'entradas-empty', hidden: true, icon: 'wallet', title: 'Nenhuma entrada neste mês', text: 'Lance seu salário ou outra receita para ver quanto sobra no mês.', actionLabel: 'Nova entrada', actionClick: 'btn-new-entrada' })}
            </section>`;
}
