export function viewSaidasTemplate() {
  return `
<!-- SAIDAS LIST -->
            <section id="view-saidas" class="fade-in hidden">
                <div class="saidas-header flex justify-between items-center mb-3 gap-3 flex-wrap">
                    <div class="saidas-header-copy">
                        <h2 class="font-semibold">Saidas</h2>
                        <p id="saidas-meta" class="text-xs text-textSecondary mt-1"></p>
                    </div>
                    <div class="saidas-toolbar mobile-section-actions flex gap-2 flex-wrap">
                        <div class="saidas-status-toggle flex gap-1 bg-surfaceLight/40 rounded-lg p-1 border border-surfaceLight">
                            <button id="saidas-filter-active" type="button" class="px-3 py-1.5 text-xs rounded-md bg-accent text-white">Ativos</button>
                            <button id="saidas-filter-archived" type="button" class="px-3 py-1.5 text-xs rounded-md text-textSecondary">Arquivados</button>
                            <button id="saidas-filter-all" type="button" class="px-3 py-1.5 text-xs rounded-md text-textSecondary">Todos</button>
                        </div>

                        <div class="saidas-filter-grid">
                            <select id="saidas-payment-filter" class="text-xs rounded-lg border border-surfaceLight bg-surfaceLight/40 text-textSecondary px-3 py-1.5">
                                <option value="">Todos pagamentos</option>
                            </select>
                            <select id="saidas-person-filter" class="text-xs rounded-lg border border-surfaceLight bg-surfaceLight/40 text-textSecondary px-3 py-1.5">
                                <option value="">Todas pessoas</option>
                            </select>
                            <select id="saidas-cycle-filter" class="text-xs rounded-lg border border-surfaceLight bg-surfaceLight/40 text-textSecondary px-3 py-1.5">
                                <option value="">Todos ciclos</option>
                                <option value="INICIO_MES">Inicio do mes</option>
                                <option value="QUINZENA">Quinzena</option>
                            </select>
                            <select id="saidas-macro-filter" class="text-xs rounded-lg border border-surfaceLight bg-surfaceLight/40 text-textSecondary px-3 py-1.5">
                                <option value="">Todas categorias</option>
                            </select>
                            <label class="saidas-date-filter text-xs text-textSecondary flex items-center gap-2 rounded-lg border border-surfaceLight bg-surfaceLight/40 px-3 py-1.5">
                                <span>De</span>
                                <input id="saidas-date-start-filter" type="date" class="bg-transparent text-textPrimary outline-none">
                            </label>
                            <label class="saidas-date-filter text-xs text-textSecondary flex items-center gap-2 rounded-lg border border-surfaceLight bg-surfaceLight/40 px-3 py-1.5">
                                <span>Ate</span>
                                <input id="saidas-date-end-filter" type="date" class="bg-transparent text-textPrimary outline-none">
                            </label>
                        </div>

                        <div class="saidas-search-row">
                            <input
                                id="saidas-search"
                                type="search"
                                placeholder="Buscar saida"
                                class="text-xs rounded-lg border border-surfaceLight bg-surfaceLight/40 text-textPrimary placeholder:text-textSecondary px-3 py-1.5 min-w-[180px]">
                        </div>

                        <button
                            id="btn-new-saida"
                            type="button"
                            class="saidas-new-button bg-accent hover:bg-accentDark text-bg text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <i data-lucide="plus" class="w-4 h-4"></i> Nova Saida
                        </button>
                    </div>
                </div>

                <div id="saidas-list" class="space-y-2"></div>
                <div id="saidas-total" class="hidden mt-3 rounded-xl border border-surfaceLight bg-surfaceLight/40 px-4 py-3"></div>
                <div id="saidas-pagination" class="hidden pt-3 flex justify-center">
                    <button id="btn-load-more-saidas" type="button" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Carregar mais</button>
                </div>
                <p id="saidas-empty" class="text-textSecondary text-sm text-center py-8 hidden">Nenhuma saida cadastrada.</p>
            </section>`;
}
