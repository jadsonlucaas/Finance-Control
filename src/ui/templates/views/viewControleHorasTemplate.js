export function viewControleHorasTemplate() {
  return `
<section id="view-controle-horas" class="fade-in hidden">
                <div class="flex justify-between items-center mb-3 gap-3 flex-wrap">
                    <div>
                        <h2 class="font-semibold">Controle de Horas</h2>
                        <p id="controle-horas-meta" class="text-xs text-textSecondary mt-1">Lance horas extras e banco de horas sem misturar tempo com dinheiro.</p>
                    </div>
                    <div class="mobile-section-actions flex gap-2 flex-wrap">
                        <input id="controle-horas-search" type="search" class="text-xs rounded-lg min-w-[180px]" placeholder="Buscar pessoa ou competência">
                        <input id="controle-horas-competencia" type="month" class="text-xs rounded-lg min-w-[150px]">
                        <button id="btn-new-hour-control" type="button" class="bg-accent hover:bg-accentDark text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><i data-lucide="plus" class="w-4 h-4"></i> Novo lançamento</button>
                    </div>
                </div>
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                    <div class="glass rounded-xl p-4 xl:col-span-2">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 class="text-sm font-semibold text-textSecondary">Resumo por pessoa e competência</h3>
                                <p class="text-xs text-textSecondary mt-1">Hora extra financeira entra nas entradas. Banco de horas fica isolado do financeiro.</p>
                            </div>
                        </div>
                        <div id="controle-horas-list" class="space-y-3"></div>
                        <p id="controle-horas-empty" class="text-textSecondary text-sm text-center py-8 hidden">Nenhum lançamento de horas cadastrado.</p>
                    </div>
                    <div class="glass rounded-xl p-4">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 class="text-sm font-semibold text-textSecondary">Saldo do Banco</h3>
                                <p class="text-xs text-textSecondary mt-1">Débito soma no saldo. Crédito reduz o saldo.</p>
                            </div>
                        </div>
                        <div id="controle-horas-saldos" class="space-y-3"></div>
                    </div>
                </div>
            </section>`;
}
