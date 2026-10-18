export function viewImportacaoTemplate() {
  return `
<!-- IMPORTACAO -->
            <section id="view-importacao" class="fade-in hidden">
                <div class="glass rounded-2xl p-4 mb-4">
                    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.18em] text-textSecondary">Integracao Bancaria</p>
                            <h2 class="text-xl font-bold text-textPrimary">Importacao de extratos</h2>
                            <p class="text-sm text-textSecondary mt-1">Camada dedicada para transformar extratos bancarios em saidas rastreaveis, sem alterar a logica atual do app.</p>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button id="btn-importacao-open-settings" type="button" class="text-xs bg-surfaceLight hover:bg-surfaceLight/80 px-3 py-2 rounded-lg text-textSecondary hover:text-textPrimary transition-colors font-medium">
                                Configuracoes
                            </button>
                            <button id="btn-importacao-open-saidas" type="button" class="text-xs bg-accent hover:bg-accentDark px-3 py-2 rounded-lg text-white transition-colors font-medium">
                                Ver saidas
                            </button>
                        </div>
                    </div>
                </div>

                <div class="glass rounded-xl p-4 mb-4">
                    <div id="modern-import-panel"></div>

                    <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <h3 class="text-sm font-semibold text-textSecondary">Preview de importacao</h3>
                            <p class="text-xs text-textSecondary mt-1">Nesta fase inicial, a importacao bancaria grava apenas saidas. Creditos entram no preview como movimentos ignorados.</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
                        <div>
                            <label for="import-bank-model" class="text-xs text-textSecondary mb-1 block">Modelo do banco</label>
                            <select id="import-bank-model" class="w-full text-sm">
                                <option value="BRADESCO">Bradesco CSV</option>
                                <option value="MERCADO_PAGO">Mercado Pago CSV</option>
                                <option value="INTER">Banco Inter CSV</option>
                                <option value="ITAU_PDF">Itau PDF</option>
                                <option value="PADRAO">CSV padrao</option>
                            </select>
                        </div>
                        <div>
                            <label for="import-bank-label" class="text-xs text-textSecondary mb-1 block">Origem do banco</label>
                            <input id="import-bank-label" type="text" class="w-full text-sm" value="Bradesco" placeholder="Ex.: Bradesco">
                        </div>
                        <div>
                            <label for="import-person-owner" class="text-xs text-textSecondary mb-1 block">Responsavel</label>
                            <select id="import-person-owner" class="w-full text-sm">
                                <option value="">Selecionar responsavel</option>
                            </select>
                        </div>
                        <div class="xl:col-span-2">
                            <label for="import-file-input" class="text-xs text-textSecondary mb-1 block">Arquivo CSV ou PDF</label>
                            <input id="import-file-input" type="file" accept=".csv,text/csv,.pdf,application/pdf" class="w-full text-sm">
                        </div>
                    </div>

                    <div class="flex gap-2 flex-wrap mb-4">
                        <button id="btn-import-preview" type="button" class="bg-accent hover:bg-accentDark text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">Gerar preview</button>
                        <button id="btn-import-commit" type="button" class="bg-success hover:bg-success/80 text-bg text-xs font-semibold px-3 py-2 rounded-lg transition-colors" disabled>Importar saidas aprovadas</button>
                        <button id="btn-import-clear" type="button" class="bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary hover:text-textPrimary text-xs font-semibold px-3 py-2 rounded-lg transition-colors">Limpar preview</button>
                    </div>

                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3 mb-4">
                        <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
                            <div>
                                <p class="text-sm font-semibold text-textPrimary">Assistente de mapeamento</p>
                                <p class="text-xs text-textSecondary mt-1">Aplique categoria em lote nas linhas que exigem revisao manual e trate possiveis transferencias internas antes de importar.</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_auto] gap-3">
                            <div>
                                <label for="import-bulk-category" class="text-xs text-textSecondary mb-1 block">Categoria em lote</label>
                                <select id="import-bulk-category" class="w-full text-sm">
                                    <option value="">Selecionar categoria</option>
                                </select>
                            </div>
                            <div>
                                <label for="import-bulk-target" class="text-xs text-textSecondary mb-1 block">Aplicar em</label>
                                <select id="import-bulk-target" class="w-full text-sm">
                                    <option value="review">Linhas em revisao</option>
                                    <option value="transfer">Possiveis transferencias</option>
                                    <option value="all-pending">Todas as linhas pendentes</option>
                                </select>
                            </div>
                            <div class="flex items-end">
                                <button id="btn-import-apply-bulk-category" type="button" class="w-full bg-accent/10 hover:bg-accent hover:text-white text-accent text-xs font-semibold px-3 py-2 rounded-lg transition-colors">Aplicar categoria</button>
                            </div>
                        </div>
                    </div>

                    <div id="importacao-preview-summary" class="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4"></div>

                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3 mb-4">
                        <div class="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <p class="text-sm font-semibold text-textPrimary">Resultado do arquivo</p>
                                <p id="importacao-preview-meta" class="text-xs text-textSecondary mt-1">Nenhum preview carregado.</p>
                            </div>
                        </div>
                    </div>

                    <div class="overflow-auto rounded-xl border border-surfaceLight">
                        <table class="w-full min-w-[980px] text-sm">
                            <thead class="bg-surfaceLight/70 text-textSecondary">
                                <tr>
                                    <th class="text-left px-3 py-2 font-medium">Status</th>
                                    <th class="text-left px-3 py-2 font-medium">Data</th>
                                    <th class="text-left px-3 py-2 font-medium">Responsavel</th>
                                    <th class="text-left px-3 py-2 font-medium">Descricao</th>
                                    <th class="text-right px-3 py-2 font-medium">Valor</th>
                                    <th class="text-left px-3 py-2 font-medium">Categoria</th>
                                    <th class="text-left px-3 py-2 font-medium">Confianca</th>
                                    <th class="text-left px-3 py-2 font-medium">Observacao</th>
                                </tr>
                            </thead>
                            <tbody id="importacao-preview-rows"></tbody>
                        </table>
                    </div>
                </div>

                <div class="glass rounded-xl p-4 mb-4">
                    <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <h3 class="text-sm font-semibold text-textSecondary">Importacoes gravadas</h3>
                            <p class="text-xs text-textSecondary mt-1">Historico dos lotes importados com filtro por origem e remocao seletiva sem tocar nos lancamentos manuais.</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-4">
                        <div>
                            <label for="import-history-source-filter" class="text-xs text-textSecondary mb-1 block">Filtrar por origem</label>
                            <select id="import-history-source-filter" class="w-full text-sm">
                                <option value="all">Todas as origens</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button id="btn-import-history-refresh" type="button" class="w-full bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary hover:text-textPrimary text-xs font-semibold px-3 py-2 rounded-lg transition-colors">Atualizar historico</button>
                        </div>
                    </div>

                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3 mb-4">
                        <p id="importacao-history-meta" class="text-xs text-textSecondary">Nenhuma importacao registrada ainda.</p>
                    </div>

                    <div id="importacao-history-batches" class="space-y-3"></div>
                </div>

            </section>`;
}
