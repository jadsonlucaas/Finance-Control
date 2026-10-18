export function viewNovoTemplate() {
  return `
<!-- NOVO LANÇAMENTO -->
            <section id="view-novo" class="fade-in hidden max-w-lg mx-auto">
                <div class="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 id="form-heading" class="font-semibold">Novo Lançamento</h2>
                        <p id="form-editing-hint" class="hidden text-xs text-textSecondary mt-1">Você está editando um lançamento existente. As alterações atualizam apenas este registro.</p>
                    </div>
                    <button type="button" id="btn-cancel-edit" class="hidden px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Cancelar edição</button>
                </div>
                <form id="form-new" class="space-y-3">
                    <div>
                        <label class="text-xs text-textSecondary mb-1 block">Tipo</label><select id="form-type"
                            class="w-full text-sm">
                            <option value="saida">Saída</option>
                            <option value="entrada">Entrada</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-textSecondary mb-1 block">Pessoa</label><select id="form-person"
                            class="w-full text-sm">
                            <option>Jadson</option>
                            <option>Luana</option>
                            <option>Reserva</option>
                        </select>
                    </div>
                    <div id="saida-fields">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Categoria Macro</label><select
                                    id="form-macro" class="w-full text-sm">
                                    <option value="">Selecione...</option>
                                    <option value="FIXO">Fixo</option>
                                    <option value="VARIAVEL">Variável</option>
                                    <option value="RESERVA">Reserva</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Categoria</label><input
                                    id="form-category" list="form-category-options" class="w-full text-sm"
                                    placeholder="Selecione ou digite uma categoria">
                                <datalist id="form-category-options"></datalist>
                                <p class="text-[11px] text-textSecondary mt-1">Categorias existentes aparecem como sugestão. Se digitar uma nova, ela vira padrão para os demais usuários.</p>
                            </div>
                        </div>
                        <div class="mt-3">
                            <label class="text-xs text-textSecondary mb-1 block">Descrição</label><input id="form-desc"
                                type="text" placeholder="Detalhes do gasto" class="w-full text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Valor (R\$)</label><input
                                    id="form-amount" type="number" step="0.01" min="0" placeholder="0,00"
                                    class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Status</label><select
                                    id="form-status" class="w-full text-sm">
                                    <option>Em aberto</option>
                                    <option>Pago</option>
                                    <option>Cancelado</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block mt-3">Conta / Meio de
                                Pagamento</label><input id="form-payment" type="text" placeholder="Nubank, Itaú, Pix..."
                                class="w-full text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Data do Evento</label><input
                                    id="form-occurred" type="date" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Vencimento</label><input
                                    id="form-due" type="date" aria-label="Data de vencimento" class="w-full text-sm">
                            </div>
                        </div>
                        <div id="paid-at-wrap" class="mt-3 hidden">
                            <label class="text-xs text-textSecondary mb-1 block">Data do Pagamento</label><input
                                id="form-paid-at" type="date" class="w-full text-sm">
                        </div>
                        <div class="mt-3">
                            <label class="text-xs text-textSecondary mb-1 block">Competência
                                (auto-sugerida)</label><input id="form-competence" type="month" class="w-full text-sm">
                        </div>
                        <div class="mt-3">
                            <label class="text-xs text-textSecondary mb-2 block">Ciclo</label>
                            <div class="flex gap-2" id="form-cycle-group-saida">
                                <button type="button" id="cycle-saida-inicio-mes"
                                    class="px-3 py-2 rounded-full text-sm font-medium transition-colors bg-transparent text-textSecondary hover:bg-surfaceLight">
                                    Início do mês
                                </button>
                                <button type="button" id="cycle-saida-quinzena"
                                    class="px-3 py-2 rounded-full text-sm font-medium transition-colors bg-transparent text-textSecondary hover:bg-surfaceLight">
                                    Quinzena
                                </button>
                            </div>
                        </div>
                        <div class="mt-3">
                            <label class="text-xs text-textSecondary mb-1 block">Tipo da Despesa</label>
                            <select id="form-expense-type" class="w-full text-sm">
                                <option value="a_vista">À vista</option>
                                <option value="parcelada">Parcelada</option>
                            </select>
                        </div>
                        <div id="installment-fields" class="hidden mt-3 p-3 rounded-lg border border-surfaceLight bg-surfaceLight/20 space-y-3">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Quantidade de Parcelas</label>
                                    <input id="form-installments" type="number" min="2" max="72" value="2" class="w-full text-sm">
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Valor da Parcela (R$)</label>
                                    <input id="form-installment-value" type="number" step="0.01" readonly placeholder="0,00" class="w-full text-sm bg-surfaceLight/60">
                                </div>
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Cartão Utilizado</label>
                                <input id="form-card" type="text" placeholder="Nubank, Itaú..." class="w-full text-sm">
                            </div>
                            <p class="text-[11px] text-textSecondary">O valor preenchido no campo "Valor" acima será considerado como Valor Total da compra. As parcelas futuras serão geradas automaticamente na mesma data de vencimento dos próximos meses.</p>
                        </div>
                        <div class="mt-3">
                            <label class="text-xs text-textSecondary mb-1 block">Recorrência</label><select
                                id="form-recurrence" class="w-full text-sm">
                                <option value="">Nenhuma</option>
                                <option value="mensal">Mensal</option>
                                <option value="anual">Anual</option>
                            </select>
                        </div>
                        <div id="recurrence-fields" class="hidden mt-3 p-3 rounded-lg border border-surfaceLight bg-surfaceLight/20 space-y-3">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Termino</label>
                                    <select id="form-recurrence-termination" class="w-full text-sm">
                                        <option value="count">Quantidade</option>
                                        <option value="end_date">Data final</option>
                                    </select>
                                </div>
                                <div id="recurrence-count-wrap">
                                    <label class="text-xs text-textSecondary mb-1 block">Ocorrencias</label>
                                    <input id="form-recurrence-count" type="number" min="1" max="120" value="1" class="w-full text-sm">
                                </div>
                                <div id="recurrence-end-date-wrap" class="hidden">
                                    <label class="text-xs text-textSecondary mb-1 block">Data final</label>
                                    <input id="form-recurrence-end-date" type="date" class="w-full text-sm">
                                </div>
                            </div>
                            <div id="recurrence-preview" class="grid grid-cols-2 gap-2 text-xs text-textSecondary">
                                <div>Frequencia: <strong id="recurrence-preview-frequency" class="text-textPrimary">-</strong></div>
                                <div>Quantidade: <strong id="recurrence-preview-count" class="text-textPrimary">-</strong></div>
                                <div>Primeira: <strong id="recurrence-preview-first" class="text-textPrimary">-</strong></div>
                                <div>Ultima: <strong id="recurrence-preview-last" class="text-textPrimary">-</strong></div>
                                <div class="col-span-2">Total projetado: <strong id="recurrence-preview-total" class="text-textPrimary">R$ 0,00</strong></div>
                            </div>
                            <div id="recurrence-scope-fields" class="hidden grid grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Editar</label>
                                    <select id="form-recurrence-edit-scope" class="w-full text-sm">
                                        <option value="only_this">Somente esta</option>
                                        <option value="this_and_next" disabled>Esta e proximas</option>
                                        <option value="whole_series" disabled>Toda a serie</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Excluir</label>
                                    <select id="form-recurrence-delete-scope" class="w-full text-sm">
                                        <option value="only_this">Somente esta</option>
                                        <option value="this_and_next" disabled>Esta e proximas</option>
                                        <option value="whole_series" disabled>Toda a serie</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="entrada-fields" class="hidden space-y-3">
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Tipo de Entrada</label><select
                                id="form-earning-type" class="w-full text-sm">
                                <option>Salário</option>
                                <option>Hora Extra</option>
                                <option>DSR</option>
                                <option>13º</option>
                                <option>Bônus</option>
                                <option>Alimentação</option>
                                <option>Café</option>
                                <option>Outros Benefícios</option>
                                <option>INSS (dedução)</option>
                                <option>IRPF (dedução)</option>
                                <option>Outras Deduções</option>
                            </select>
                        </div>
                        <div id="hour-extra-fields" class="hidden rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h3 class="text-sm font-semibold text-textPrimary">Configuração da Hora Extra</h3>
                                    <p class="text-xs text-textSecondary mt-1">O lançamento salva um snapshot do tipo, percentual e valores calculados para preservar o histórico.</p>
                                </div>
                                <span id="hour-extra-mode-badge" class="px-2 py-1 rounded-full text-[11px] font-semibold bg-accent/10 text-accent">Financeiro</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Tipo de H.E.</label>
                                    <select id="form-he-type" class="w-full text-sm">
                                        <option value="">Selecione um tipo ativo</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Percentual aplicado</label>
                                    <input id="form-he-percentage" type="number" step="0.01" readonly placeholder="0,00" class="w-full text-sm bg-surfaceLight/60">
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Hora inicial</label>
                                    <input id="form-he-start-time" type="time" class="w-full text-sm">
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Hora final</label>
                                    <input id="form-he-end-time" type="time" class="w-full text-sm">
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Quantidade de horas</label>
                                    <input id="form-he-hours" type="number" step="0.01" min="0" placeholder="0,00" class="w-full text-sm">
                                    <p class="text-[11px] text-textSecondary mt-1">Preencha manualmente só se não quiser usar o intervalo.</p>
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Total de horas</label>
                                    <input id="form-he-hours-formatted" type="text" readonly placeholder="00:00" class="w-full text-sm bg-surfaceLight/60">
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Salário base (R\$)</label>
                                    <input id="form-he-base-salary" type="number" step="0.01" min="0" placeholder="0,00" class="w-full text-sm">
                                    <p class="text-[11px] text-textSecondary mt-1">Preenchido automaticamente a partir das configurações da pessoa.</p>
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Horas mensais padrão</label>
                                    <input id="form-he-monthly-hours" type="number" step="0.01" min="0" value="220" class="w-full text-sm">
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Valor base da hora (R\$)</label>
                                    <input id="form-he-base-hour" type="number" step="0.01" readonly placeholder="0,00" class="w-full text-sm bg-surfaceLight/60">
                                </div>
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Valor total calculado (R\$)</label>
                                    <input id="form-he-total-value" type="number" step="0.01" readonly placeholder="0,00" class="w-full text-sm bg-surfaceLight/60">
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-1 gap-3">
                                <div>
                                    <label class="text-xs text-textSecondary mb-1 block">Valor da hora calculado (R\$)</label>
                                    <input id="form-he-hour-value" type="number" step="0.01" readonly placeholder="0,00" class="w-full text-sm bg-surfaceLight/60">
                                </div>
                            </div>
                            <p id="hour-extra-empty-state" class="hidden text-xs text-warn">Nenhum tipo ativo cadastrado. Configure um tipo de H.E. antes de lançar.</p>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Descrição</label><input
                                id="form-earning-desc" type="text" placeholder="Detalhes" class="w-full text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Valor (R\$)</label><input
                                    id="form-earning-amount" type="number" step="0.01" min="0" placeholder="0,00"
                                    class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-xs text-textSecondary mb-1 block">Competência</label><input
                                    id="form-earning-comp" type="month" class="w-full text-sm">
                            </div>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-2 block">Ciclo</label>
                            <div class="flex gap-2" id="form-cycle-group-entrada">
                                <button type="button" id="cycle-entrada-inicio-mes"
                                    class="px-3 py-2 rounded-full text-sm font-medium transition-colors bg-transparent text-textSecondary hover:bg-surfaceLight">
                                    Início do mês
                                </button>
                                <button type="button" id="cycle-entrada-quinzena"
                                    class="px-3 py-2 rounded-full text-sm font-medium transition-colors bg-transparent text-textSecondary hover:bg-surfaceLight">
                                    Quinzena
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="pt-2">
                        <button type="submit" id="btn-submit"
                            class="w-full bg-accent hover:bg-accentDark text-bg font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"><i
                                data-lucide="save" class="w-4 h-4"></i> Salvar Lançamento</button>
                    </div>
                    <div id="toast"
                        class="hidden fixed bottom-4 right-4 bg-success text-bg px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50">
                    </div>
                </form>
            </section>`;
}
