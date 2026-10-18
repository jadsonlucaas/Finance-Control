renderEntradas = function () {
            const competenceFilter = normalizeCompetenceKey(document.getElementById('entradas-competence-filter')?.value || '');
            const allEntries = getEntradasConsolidadas();
            const entries = allEntries.filter((entry) => !competenceFilter || normalizeCompetenceKey(entry.competencia) === competenceFilter);
            const list = document.getElementById('entradas-list');
            const empty = document.getElementById('entradas-empty');
            const meta = document.getElementById('entradas-meta');
            const pagination = document.getElementById('entradas-pagination');
            if (!list || !empty || !meta) return;

            list.innerHTML = entries.map((entry) => {
                const adjustment = getEntryDiscountAdjustmentRecord(entry.person, entry.competencia);
                const adjustmentValue = adjustment ? Number(adjustment.amount || 0).toFixed(2) : '';
                const inputId = buildEntryDiscountInputId(entry.person, entry.competencia);
                const personAttr = escapeHtml(entry.person);
                const competenciaAttr = escapeHtml(entry.competencia);

                return `<div class="glass rounded-2xl p-4 border border-surfaceLight">
                    <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Competência</p>
                            <h3 class="text-lg font-semibold mt-1">${formatCompetence(entry.competencia)} • ${personAttr}</h3>
                        </div>
                        <button
                            data-entry-action="view"
                            data-person="${personAttr}"
                            data-competencia="${competenciaAttr}"
                            class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
                        >Visualizar</button>
                    </div>
                    <div class="entry-consolidated-grid">
                        <div class="money-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Salário Base</p>
                            <p class="kpi-value text-textPrimary mt-3">${fmt(entry.salaryBase)}</p>
                        </div>
                        <div class="time-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Hora Extra</p>
                            <p class="kpi-value text-accent mt-3">${fmt(entry.hourExtra)}</p>
                        </div>
                        <div class="money-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Líquido Final</p>
                            <p class="kpi-value text-success mt-3">${fmt(entry.liquido)}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-textSecondary">
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">Descontos: <strong class="text-danger">-${fmt(entry.outrosDescontos)}</strong></div>
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">INSS: <strong class="text-danger">-${fmt(entry.inss)}</strong></div>
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">IRRF: <strong class="text-danger">-${fmt(entry.irrf)}</strong></div>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3 mt-4">
                        <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Outros descontos</p>
                            <p class="text-[11px] text-textSecondary">Informe o valor total do ajuste deste mês</p>
                        </div>
                        <div class="flex gap-2 flex-col sm:flex-row">
                            <input id="${inputId}" type="number" step="0.01" min="0" value="${adjustmentValue}" placeholder="0,00" class="flex-1 bg-surface border border-surfaceLight rounded-xl px-3 py-2 text-sm text-textPrimary">
                            <button
                                data-entry-action="save-discount"
                                data-person="${personAttr}"
                                data-competencia="${competenciaAttr}"
                                class="px-3 py-2 text-xs rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors font-semibold"
                            >Salvar desconto</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            list.querySelectorAll('[data-entry-action="view"]').forEach((button) => {
                button.addEventListener('click', () => {
                    openEntryDetailModal(button.dataset.person || '', button.dataset.competencia || '');
                });
            });

            list.querySelectorAll('[data-entry-action="save-discount"]').forEach((button) => {
                button.addEventListener('click', () => {
                    saveEntryDiscountAdjustmentByEntry(button.dataset.person || '', button.dataset.competencia || '');
                });
            });

            meta.textContent = `${entries.length} competência(s) consolidadas${competenceFilter ? ` • ${formatCompetence(competenceFilter)}` : ''}${listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : ''}`;
            empty.classList.toggle('hidden', entries.length > 0);
            if (pagination) pagination.classList.add('hidden');
            lucide.createIcons();
        };
