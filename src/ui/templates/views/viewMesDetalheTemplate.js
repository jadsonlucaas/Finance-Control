export function viewMesDetalheTemplate() {
  return `
<section id="view-mes-detalhe" class="fade-in hidden">
                <div class="glass rounded-2xl p-4 mb-4">
                    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.18em] text-textSecondary">Análise Mensal</p>
                            <h2 id="month-detail-title" class="text-xl font-bold text-textPrimary">Visão do mês</h2>
                            <p id="month-detail-subtitle" class="text-sm text-textSecondary mt-1">Resumo executivo do período selecionado no gráfico mensal.</p>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button id="btn-month-detail-back" type="button" class="text-xs bg-surfaceLight hover:bg-surfaceLight/80 px-3 py-2 rounded-lg text-textSecondary hover:text-textPrimary transition-colors font-medium">Voltar ao dashboard</button>
                        </div>
                    </div>
                </div>
                <div id="month-detail-summary" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"></div>
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                    <div class="glass rounded-xl p-4 xl:col-span-2">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <h3 class="text-sm font-semibold text-textSecondary">Indicadores do mês</h3>
                            <span id="month-detail-status-badge" class="px-3 py-1 rounded-full text-xs font-semibold bg-surfaceLight text-textSecondary">Sem status</span>
                        </div>
                        <div id="month-detail-highlights" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
                    </div>
                    <div class="glass rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-textSecondary mb-4">Top categorias</h3>
                        <div id="month-detail-categories" class="space-y-3"></div>
                    </div>
                </div>
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div class="glass rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-textSecondary mb-4">Por pessoa</h3>
                        <div id="month-detail-people" class="space-y-3"></div>
                    </div>
                    <div class="glass rounded-xl p-4 xl:col-span-2">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <h3 class="text-sm font-semibold text-textSecondary">Lançamentos do mês</h3>
                            <span id="month-detail-records-meta" class="text-xs text-textSecondary"></span>
                        </div>
                        <div id="month-detail-records" class="space-y-2 max-h-[460px] overflow-y-auto pr-1"></div>
                    </div>
                </div>
            </section>`;
}
