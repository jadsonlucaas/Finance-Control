const _renderEntradasWithMonthFilter = renderEntradas;
        renderEntradas = function () {
            const competenceFilter = normalizeCompetenceKey(document.getElementById('entradas-competence-filter')?.value || '');
            const allEntries = getEntradasConsolidadas();
            const entries = allEntries.filter((entry) => !competenceFilter || normalizeCompetenceKey(entry.competencia) === competenceFilter);
            const list = document.getElementById('entradas-list');
            const empty = document.getElementById('entradas-empty');
            const meta = document.getElementById('entradas-meta');
            const pagination = document.getElementById('entradas-pagination');
            if (!list || !empty || !meta) return;

            list.innerHTML = entries.map((entry) => `<div class="glass rounded-2xl p-4 border border-surfaceLight"><div class="flex items-start justify-between gap-3 flex-wrap mb-4"><div><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Competência</p><h3 class="text-lg font-semibold mt-1">${formatCompetence(entry.competencia)} • ${escapeHtml(entry.person)}</h3></div><button type="button" data-open-entry-detail-person="${escapeHtml(entry.person)}" data-open-entry-detail-competence="${entry.competencia}" class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors">Visualizar</button></div><div class="entry-consolidated-grid"><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-3">${fmt(entry.salaryBase)}</p></div><div class="time-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-3">${fmt(entry.hourExtra)}</p></div><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-3">${fmt(entry.liquido)}</p></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-textSecondary"><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">Descontos: <strong class="text-danger">-${fmt(entry.outrosDescontos)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">INSS: <strong class="text-danger">-${fmt(entry.inss)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">IRRF: <strong class="text-danger">-${fmt(entry.irrf)}</strong></div></div></div>`).join('');

            meta.textContent = `${entries.length} competência(s) consolidadas${competenceFilter ? ` • ${formatCompetence(competenceFilter)}` : ''}${listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : ''}`;
            empty.classList.toggle('hidden', entries.length > 0);
            if (pagination) pagination.classList.add('hidden');
            lucide.createIcons();
        };
