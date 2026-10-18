export function viewParcelamentosTemplate() {
    return `
<section class="min-h-full flex flex-col fade-in relative hidden" id="view-parcelamentos">
    <div class="mb-4">
        <h2 class="text-xl font-bold mb-1">Parcelamentos</h2>
        <p class="text-sm text-textSecondary">Gerencie suas compras parceladas e compromissos futuros</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <button type="button" data-parcelamentos-detail="comprometido" class="p-3 bg-surfaceLight rounded-xl border border-surfaceLight/50 flex items-center justify-between text-left cursor-pointer hover:border-accent/40 hover:bg-surfaceLight/80 transition-colors">
            <div>
                <p class="text-xs text-textSecondary mb-0.5">Total Comprometido</p>
                <p class="text-lg font-bold text-danger" id="parcelamentos-total-comprometido">R$ 0,00</p>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-danger mt-2">Ver detalhes <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
            </div>
            <div class="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center text-danger">
                <i data-lucide="credit-card" class="w-4 h-4"></i>
            </div>
        </button>
        <button type="button" data-parcelamentos-detail="mes" class="p-3 bg-surfaceLight rounded-xl border border-surfaceLight/50 flex items-center justify-between text-left cursor-pointer hover:border-accent/40 hover:bg-surfaceLight/80 transition-colors">
            <div>
                <p class="text-xs text-textSecondary mb-0.5">Parcelas deste mes</p>
                <p class="text-lg font-bold text-textPrimary" id="parcelamentos-total-mes">R$ 0,00</p>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-accent mt-2">Ver detalhes <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
            </div>
            <div class="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <i data-lucide="calendar" class="w-4 h-4"></i>
            </div>
        </button>
        <button type="button" data-parcelamentos-detail="pago" class="p-3 bg-surfaceLight rounded-xl border border-surfaceLight/50 flex items-center justify-between text-left cursor-pointer hover:border-accent/40 hover:bg-surfaceLight/80 transition-colors">
            <div>
                <p class="text-xs text-textSecondary mb-0.5">Total ja Pago</p>
                <p class="text-lg font-bold text-success" id="parcelamentos-total-pago">R$ 0,00</p>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-success mt-2">Ver detalhes <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
            </div>
            <div class="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
            </div>
        </button>
        <button type="button" data-parcelamentos-detail="meses" class="p-3 bg-surfaceLight rounded-xl border border-surfaceLight/50 flex items-center justify-between text-left cursor-pointer hover:border-accent/40 hover:bg-surfaceLight/80 transition-colors">
            <div>
                <p class="text-xs text-textSecondary mb-0.5">Meses com Parcelas</p>
                <p class="text-lg font-bold text-textPrimary" id="parcelamentos-meses-ativos">0</p>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-textSecondary mt-2">Ver detalhes <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
            </div>
            <div class="w-8 h-8 rounded-full bg-surface/50 flex items-center justify-center text-textSecondary">
                <i data-lucide="calendar-days" class="w-4 h-4"></i>
            </div>
        </button>
    </div>

    <div class="bg-surfaceLight/20 rounded-xl p-4 border border-surfaceLight mb-4">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
                <h3 class="text-sm font-semibold text-textPrimary">Evolucao mensal dos parcelamentos</h3>
                <p id="parcelamentos-chart-caption" class="text-xs text-textSecondary mt-1">Valores por competencia</p>
            </div>
            <span id="parcelamentos-chart-total" class="text-sm font-semibold text-accent">R$ 0,00</span>
        </div>
        <div class="relative h-[220px]">
            <canvas id="parcelamentos-monthly-chart"></canvas>
            <div id="parcelamentos-chart-empty" class="hidden absolute inset-0 items-center justify-center text-sm text-textSecondary text-center">
                Nenhum valor mensal para exibir.
            </div>
        </div>
    </div>

    <div class="bg-surfaceLight/30 rounded-xl p-3 border border-surfaceLight mb-4 flex flex-col md:flex-row gap-3">
        <div class="flex-1">
            <label class="text-xs text-textSecondary mb-1 block">Pesquisar</label>
            <input type="text" id="parcelamentos-search" placeholder="Nome da compra ou cartao..." class="w-full text-sm">
        </div>
        <div class="w-full md:w-48">
            <label class="text-xs text-textSecondary mb-1 block">Status</label>
            <select id="parcelamentos-status-filter" class="w-full text-sm">
                <option value="ativos">Em andamento</option>
                <option value="concluidos">Concluidos</option>
                <option value="todos">Todos</option>
            </select>
        </div>
        <div class="w-full md:w-48">
            <label class="text-xs text-textSecondary mb-1 block">Cartao</label>
            <select id="parcelamentos-card-filter" class="w-full text-sm">
                <option value="">Todos</option>
            </select>
        </div>
        <div class="w-full md:w-48">
            <label class="text-xs text-textSecondary mb-1 block">Pessoa</label>
            <select id="parcelamentos-person-filter" class="w-full text-sm">
                <option value="">Todas</option>
            </select>
        </div>
    </div>

    <div class="flex-1 min-h-[320px] overflow-auto bg-surfaceLight/10 rounded-xl border border-surfaceLight">
        <div class="min-w-[600px]">
            <div class="grid grid-cols-12 gap-3 p-3 border-b border-surfaceLight text-xs font-semibold text-textSecondary sticky top-0 bg-surface z-10">
                <div class="col-span-3">Compra</div>
                <div class="col-span-2">Cartao</div>
                <div class="col-span-2">Progresso</div>
                <div class="col-span-2 text-right">Valor Total</div>
                <div class="col-span-3 text-right">Ainda Falta</div>
            </div>
            <div id="parcelamentos-list" class="divide-y divide-surfaceLight/50 relative">
                <!-- Conteudo gerado via JS -->
            </div>
        </div>
    </div>
</section>
`;
}
