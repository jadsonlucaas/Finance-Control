export function viewConfiguracoesTemplate() {
  return `
<!-- CONFIGURAÇÕES -->
            <section id="view-configuracoes" class="fade-in hidden max-w-2xl mx-auto">
                <div class="mb-4">
                    <h2 class="font-semibold">Configurações</h2>
                    <p class="text-sm text-textSecondary mt-1">Cadastros e operações administrativas em um único lugar.</p>
                </div>
                <div class="space-y-6">
                    <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="font-semibold text-sm">Pessoas</h3><button id="btn-add-person" type="button"
                                class="bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><i
                                    data-lucide="plus" class="w-3 h-3"></i> Adicionar</button>
                        </div>
                        <div id="pessoas-list" class="space-y-2"></div>
                        <p id="pessoas-empty" class="text-textSecondary text-xs text-center py-4">Nenhuma pessoa
                            configurada.</p>
                    </div>
                    <div id="settings-macro-panel" class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="font-semibold text-sm">Categorias Macro</h3><button id="btn-add-macro" type="button"
                                class="bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><i
                                    data-lucide="plus" class="w-3 h-3"></i> Adicionar</button>
                        </div>
                        <div id="macro-list" class="space-y-2"></div>
                        <p id="macro-empty" class="text-textSecondary text-xs text-center py-4">Nenhuma categoria macro.
                        </p>
                    </div>
                    <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3">
                            <div>
                                <h3 class="font-semibold text-sm">Categorias Personalizadas</h3>
                                <p class="text-xs text-textSecondary mt-1">Mantenha as categorias usadas nos lançamentos sem espalhar o cadastro em outra aba.</p>
                            </div>
                            <button id="btn-open-category-form" type="button"
                                class="bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><i
                                    data-lucide="plus" class="w-3 h-3"></i> Nova Categoria</button>
                        </div>
                        <div id="categories-list" class="grid gap-3"></div>
                        <p id="categories-empty" class="text-textSecondary text-xs text-center py-4">Nenhuma categoria
                            personalizada.</p>
                    </div>
                    <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3 gap-3 flex-wrap">
                            <div>
                                <h3 class="font-semibold text-sm">Configuração de Tipos de H.E.</h3>
                                <p class="text-xs text-textSecondary mt-1">Tipos ativos aparecem no lançamento. O sistema salva o snapshot no registro para manter o histórico intacto.</p>
                            </div>
                            <button id="btn-open-overtime-type-modal" type="button"
                                class="bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><i
                                    data-lucide="plus" class="w-3 h-3"></i> Novo Tipo</button>
                        </div>
                        <div id="overtime-types-list" class="space-y-2"></div>
                        <p id="overtime-types-empty" class="text-textSecondary text-xs text-center py-4">Nenhum tipo de hora extra cadastrado.</p>
                    </div>
                    <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3 gap-3 flex-wrap">
                            <div>
                                <h3 class="font-semibold text-sm">Importar Saídas</h3>
                                <p class="text-xs text-textSecondary mt-1">Importa a planilha \`.xlsx\` no formato validado e grava os dados na conta logada.</p>
                            </div>
                            <div class="flex gap-2 flex-wrap">
                                <button type="button" id="btn-remove-saidas"
                                    class="bg-danger/10 hover:bg-danger text-danger hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                    <i data-lucide="trash-2" class="w-3 h-3"></i> Remover Importação
                                </button>
                                <button type="button" id="btn-remove-all-saidas"
                                    class="bg-danger hover:bg-danger/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                    <i data-lucide="trash" class="w-3 h-3"></i> Excluir Todas as Saídas
                                </button>
                                <button type="button" id="btn-import-saidas-force"
                                    class="bg-warn/10 hover:bg-warn text-warn hover:text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                    <i data-lucide="database" class="w-3 h-3"></i> Importar Tudo
                                </button>
                                <button type="button" id="btn-import-saidas"
                                    class="bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                                    <i data-lucide="upload" class="w-3 h-3"></i> Importar Planilha
                                </button>
                            </div>
                        </div>
                        <input id="import-saidas-file" type="file" accept=".xlsx,.xls" aria-label="Arquivo XLSX de saidas" class="w-full text-sm">
                        <p class="text-xs text-textSecondary mt-3">Colunas esperadas: \`Data\`, \`Classe\`, \`Categoria_macro\`, \`Categoria\`, \`Descrição\`, \`Parcela\`, \`Valor Orçado\`, \`STATUS\`, \`Pagamento\`, \`Quem paga\`, \`Data competencia\`. Na importação, \`Data\` vira a data do gasto e \`Data competencia\` define o mês de vencimento/competência. Use \`Importar Tudo\` para ignorar duplicidade e gravar todas as linhas válidas.</p>
                        <div id="import-report" class="hidden mt-4 rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4">
                            <div class="flex justify-between items-center gap-3 flex-wrap mb-3">
                                <div>
                                    <h4 class="font-semibold text-sm">Relatório da importação</h4>
                                    <p id="import-report-summary" class="text-xs text-textSecondary mt-1"></p>
                                </div>
                                <button id="btn-clear-import-report" type="button" class="text-xs bg-surface hover:bg-surface/80 text-textSecondary px-3 py-1.5 rounded-lg">Limpar</button>
                            </div>
                            <div id="import-report-list" class="space-y-2 max-h-64 overflow-y-auto pr-1"></div>
                        </div>
                    </div>
                    <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3 gap-3 flex-wrap">
                            <div>
                                <h3 class="font-semibold text-sm">Importar Entradas</h3>
                                <p class="text-xs text-textSecondary mt-1">Importa entradas por competência com base na planilha \`Entradas1.xlsx\` usando \`Competência\`, \`Valores\`, \`Desc\` e \`Pessoa\`.</p>
                            </div>
                            <div class="flex gap-2 flex-wrap">
                                <button type="button" id="btn-import-entradas-force"
                                    class="bg-warn/10 hover:bg-warn text-warn hover:text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                    <i data-lucide="database" class="w-3 h-3"></i> Importar Tudo
                                </button>
                                <button type="button" id="btn-import-entradas"
                                    class="bg-success hover:bg-success/80 text-bg text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                                    <i data-lucide="upload" class="w-3 h-3"></i> Importar Planilha
                                </button>
                            </div>
                        </div>
                        <input id="import-entradas-file" type="file" accept=".xlsx,.xls" aria-label="Arquivo XLSX de entradas" class="w-full text-sm">
                        <p class="text-xs text-textSecondary mt-3">Colunas esperadas: \`Competência\`, \`Valores\`, \`Desc\`, \`Pessoa\`. Tipos suportados: \`Inicio do mês\`, \`Quinzena\`, \`HE\` e \`DSR H.E\`.</p>
                        <div id="import-entradas-report" class="hidden mt-4 rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4">
                            <div class="flex justify-between items-center gap-3 flex-wrap mb-3">
                                <div>
                                    <h4 class="font-semibold text-sm">Relatório da importação de entradas</h4>
                                    <p id="import-entradas-report-summary" class="text-xs text-textSecondary mt-1"></p>
                                </div>
                                <button id="btn-clear-entradas-import-report" type="button" class="text-xs bg-surface hover:bg-surface/80 text-textSecondary px-3 py-1.5 rounded-lg">Limpar</button>
                            </div>
                            <div id="import-entradas-report-list" class="space-y-2 max-h-64 overflow-y-auto pr-1"></div>
                        </div>
                    </div>
                    <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
                        <div class="flex justify-between items-center mb-3 gap-3 flex-wrap">
                            <div>
                                <h3 class="font-semibold text-sm">Histórico</h3>
                                <p id="archive-summary" class="text-xs text-textSecondary mt-1">Organize o volume operacional sem apagar dados.</p>
                            </div>
                            <div class="flex gap-2 flex-wrap">
                                <button id="btn-archive-records" type="button" class="bg-warn/10 hover:bg-warn text-warn hover:text-bg text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Arquivar período</button>
                                <button id="btn-restore-archived-records" type="button" class="bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary hover:text-textPrimary text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Reabrir período</button>
                            </div>
                        </div>
                        <div class="flex gap-3 flex-wrap items-end">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Competência até</label>
                                <input id="archive-cutoff" type="month" aria-label="Competencia limite para arquivamento" class="text-sm">
                            </div>
                            <p class="text-xs text-textSecondary max-w-md">Arquiva ou reabre lançamentos de \`entrada\` e \`saida\` com competência menor ou igual ao período informado. Os dados continuam salvos e consultáveis nas abas com filtro de histórico.</p>
                        </div>
                    </div>
                    <div id="backup-restore-panel"></div>
                </div>
                <div id="add-person-modal"
                    class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90]">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-sm mx-4 w-full">
                        <h3 class="font-semibold mb-4">Nova Pessoa</h3><input id="person-input" type="text"
                            placeholder="Ex: João" class="w-full text-sm mb-4">
                        <div class="mb-4">
                            <label class="text-xs text-textSecondary mb-1 block">Salário base</label>
                            <input id="person-base-salary" type="number" step="0.01" min="0" placeholder="0,00" class="w-full text-sm">
                        </div>
                        <div class="mb-4">
                            <label class="text-xs text-textSecondary mb-1 block">Início da vigência</label>
                            <input id="person-salary-start" type="date" class="w-full text-sm">
                        </div>
                        <div class="mb-4">
                            <label class="text-xs text-textSecondary mb-1 block">Observação</label>
                            <input id="person-salary-note" type="text" placeholder="Opcional" class="w-full text-sm">
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="btn-close-add-person-modal" type="button"
                                class="px-3 py-1.5 text-sm text-textSecondary bg-surfaceLight rounded-lg">Cancelar</button><button
                                id="btn-save-person" type="button"
                                class="px-3 py-1.5 text-sm text-white bg-accent rounded-lg">Salvar</button>
                        </div>
                    </div>
                </div>
                <div id="add-macro-modal"
                    class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90]">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-sm mx-4 w-full">
                        <h3 class="font-semibold mb-4">Nova Categoria Macro</h3><input id="macro-input" type="text"
                            placeholder="Ex: Lazer" class="w-full text-sm mb-4">
                        <div id="macro-scope-wrap" class="mb-4">
                            <label class="text-xs text-textSecondary mb-1 block">Escopo</label>
                            <select id="macro-scope" class="w-full text-sm">
                                <option value="personal">Pessoal</option>
                                <option value="global">Global</option>
                            </select>
                            <p class="text-xs text-textSecondary mt-1">Global afeta todos os usuários e exige autorização administrativa.</p>
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="btn-close-add-macro-modal" type="button"
                                class="px-3 py-1.5 text-sm text-textSecondary bg-surfaceLight rounded-lg">Cancelar</button><button
                                id="btn-save-macro" type="button"
                                class="px-3 py-1.5 text-sm text-white bg-accent rounded-lg">Salvar</button>
                        </div>
                    </div>
                </div>
                <div id="overtime-type-modal"
                    class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90]">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-md mx-4 w-full">
                        <h3 id="overtime-type-modal-title" class="font-semibold mb-4">Novo Tipo de Hora Extra</h3>
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Nome do tipo</label>
                                <input id="overtime-type-name" type="text" placeholder="Ex: H.E. 50%" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Percentual</label>
                                <input id="overtime-type-percentage" type="number" step="0.01" min="0" placeholder="Ex: 1.5" class="w-full text-sm">
                            </div>
                            <label class="flex items-center gap-2 text-sm text-textPrimary">
                                <input id="overtime-type-financial" type="checkbox" checked class="accent-accent">
                                Tipo financeiro (gera valor)
                            </label>
                            <label class="flex items-center gap-2 text-sm text-textPrimary">
                                <input id="overtime-type-active" type="checkbox" checked class="accent-accent">
                                Status ativo
                            </label>
                            <p class="text-xs text-textSecondary">Tipos inativos não aparecem no lançamento. Registros antigos não são recalculados.</p>
                        </div>
                        <div class="flex gap-2 justify-end mt-5">
                            <button id="btn-close-overtime-type-modal" type="button"
                                class="px-3 py-1.5 text-sm text-textSecondary bg-surfaceLight rounded-lg">Cancelar</button>
                            <button id="btn-save-overtime-type" type="button"
                                class="px-3 py-1.5 text-sm text-white bg-accent rounded-lg">Salvar</button>
                        </div>
                    </div>
                </div>
                <div id="salary-history-modal" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-2xl mx-4 w-full max-h-[85vh] overflow-y-auto">
                        <div class="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 id="salary-history-title" class="font-semibold">Histórico Salarial</h3>
                                <p class="text-xs text-textSecondary mt-1">Cada alteração cria um novo registro de vigência.</p>
                            </div>
                            <button id="btn-close-salary-history-modal" type="button" class="p-2 rounded-lg hover:bg-surfaceLight text-textSecondary"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Salário base</label>
                                <input id="salary-history-amount" type="number" step="0.01" min="0" placeholder="0,00" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Início da vigência</label>
                                <input id="salary-history-start" type="date" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Fim da vigência</label>
                                <input id="salary-history-end" type="date" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Observação</label>
                                <input id="salary-history-note" type="text" placeholder="Opcional" class="w-full text-sm">
                            </div>
                        </div>
                        <div class="flex justify-end gap-2 mb-4">
                            <button id="btn-save-salary-history" type="button" class="px-3 py-1.5 text-sm text-white bg-accent rounded-lg">Adicionar novo salário</button>
                        </div>
                        <div id="salary-history-list" class="space-y-2"></div>
                    </div>
                </div>
                <div id="hour-control-modal" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto">
                        <div class="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 id="hour-control-title" class="font-semibold">Novo Lançamento de Horas</h3>
                                <p class="text-xs text-textSecondary mt-1">Financeiro e banco de horas separados visual e logicamente.</p>
                            </div>
                            <button id="btn-close-hour-control-modal" type="button" class="p-2 rounded-lg hover:bg-surfaceLight text-textSecondary"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Pessoa</label>
                                <select id="hour-person" class="w-full text-sm"></select>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Competência</label>
                                <input id="hour-competence" type="month" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Data</label>
                                <input id="hour-date" type="date" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Tipo</label>
                                <select id="hour-type" class="w-full text-sm">
                                    <option value="Hora Extra">Hora Extra</option>
                                    <option value="Banco de Horas">Banco de Horas</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Hora inicial</label>
                                <input id="hour-start" type="time" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Hora final</label>
                                <input id="hour-end" type="time" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Início do intervalo</label>
                                <input id="hour-break-start" type="time" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Fim do intervalo</label>
                                <input id="hour-break-end" type="time" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Quantidade de horas</label>
                                <input id="hour-quantity" type="number" step="0.01" min="0" class="w-full text-sm bg-surfaceLight/60" readonly>
                            </div>
                            <div id="hour-nature-wrap" class="hidden">
                                <label class="text-xs text-textSecondary mb-1 block">Natureza</label>
                                <select id="hour-bank-nature" class="w-full text-sm">
                                    <option value="Débito">Débito</option>
                                    <option value="Crédito">Crédito</option>
                                </select>
                            </div>
                            <div id="hour-percentage-wrap">
                                <label class="text-xs text-textSecondary mb-1 block">Percentual H.E. (%)</label>
                                    <input id="hour-percentage" type="number" step="1" min="0" placeholder="110" class="w-full text-sm" value="110">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Salário vigente</label>
                                <input id="hour-salary-base" type="number" step="0.01" min="0" class="w-full text-sm bg-surfaceLight/60" readonly>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">DSR H.E. automatico</label>
                                <input id="hour-dsr-value" type="number" step="0.01" min="0" class="w-full text-sm bg-surfaceLight/60" readonly>
                                <p id="hour-dsr-info" class="text-[11px] text-textSecondary mt-1"></p>
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="text-xs text-textSecondary mb-1 block">Observação</label>
                            <textarea id="hour-note" rows="3" class="w-full text-sm" placeholder="Opcional"></textarea>
                        </div>
                        <div id="hour-calculation-preview" class="mt-4 rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4 text-sm"></div>
                        <div class="flex justify-end gap-2 mt-4">
                            <button id="btn-cancel-hour-control" type="button" class="px-3 py-1.5 text-sm text-textSecondary bg-surfaceLight rounded-lg">Cancelar</button>
                            <button id="btn-save-hour-control" type="button" class="px-3 py-1.5 text-sm text-white bg-accent rounded-lg">Salvar</button>
                        </div>
                    </div>
                </div>
                <div id="hour-detail-modal" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-4xl mx-4 w-full max-h-[90vh] overflow-y-auto">
                        <div class="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 id="hour-detail-title" class="font-semibold">Detalhe do Controle de Horas</h3>
                                <p id="hour-detail-subtitle" class="text-xs text-textSecondary mt-1"></p>
                            </div>
                            <button id="btn-close-hour-detail-modal" type="button" class="p-2 rounded-lg hover:bg-surfaceLight text-textSecondary"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                        <div id="hour-detail-content" class="space-y-3"></div>
                    </div>
                </div>
                <div id="entry-detail-modal" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
                    <div class="bg-surface rounded-xl p-5 border border-surfaceLight max-w-5xl mx-4 w-full max-h-[90vh] overflow-y-auto">
                        <div class="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 id="entry-detail-title" class="font-semibold">Detalhe da Entrada</h3>
                                <p id="entry-detail-subtitle" class="text-xs text-textSecondary mt-1"></p>
                            </div>
                            <button id="btn-close-entry-detail-modal" type="button" class="p-2 rounded-lg hover:bg-surfaceLight text-textSecondary"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>
                        <div id="entry-detail-content"></div>
                    </div>
                </div>
            </section>`;
}
