function renderControleHoras() {
            const list = document.getElementById('controle-horas-list');
            const empty = document.getElementById('controle-horas-empty');
            const saldosWrap = document.getElementById('controle-horas-saldos');
            const meta = document.getElementById('controle-horas-meta');
            const filter = document.getElementById('controle-horas-competencia');
            if (filter && !filter.value) filter.value = thisMonth;
            if (!list || !empty || !saldosWrap || !meta) return;

            const records = getControleHorasRecords();
            const grouped = new Map();
            records.forEach((record) => {
                const key = `${record.person}|${record.competence}`;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key).push(record);
            });

            const groups = [...grouped.entries()].map(([key, items]) => {
                const [person, competence] = key.split('|');
                const totalHE = roundCurrency(items.filter((item) => item.hour_entry_type === 'Hora Extra').reduce((sum, item) => sum + (Number(item.financial_total) || 0), 0));
                const saldoBanco = calcularSaldoBanco(person, competence);
                return { person, competence, totalHE, saldoBanco, items: sortRecordsNewestFirst(items) };
            }).sort((a, b) => `${b.competence}|${b.person}`.localeCompare(`${a.competence}|${a.person}`));

            window.financeApp.financeUiAdapters.setHtml('controle-horas-list', groups.map((group) => `<div class="rounded-2xl border border-surfaceLight bg-surface p-4"><div class="flex items-start justify-between gap-3 flex-wrap"><div><h3 class="font-semibold text-sm">${escapeHtml(group.person)} • ${formatCompetence(group.competence)}</h3><p class="text-xs text-textSecondary mt-1">Total H.E.: ${fmt(group.totalHE)} • Saldo banco: ${formatHoursDecimal(group.saldoBanco.saldoAtual)}</p></div><button type="button" data-toggle-hour-control-details-person="${escapeHtml(group.person)}" data-toggle-hour-control-details-competence="${group.competence}" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Detalhar</button></div><div id="hour-detail-${slugifySharedId(`${group.person}-${group.competence}`)}" class="hidden mt-4 space-y-2">${group.items.map((item) => `<div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><div class="flex items-center justify-between gap-3"><div><p class="text-sm font-semibold ${item.hour_entry_type === 'Hora Extra' ? 'text-accent' : 'text-warn'}">${item.hour_entry_type}${item.bank_nature ? ` • ${item.bank_nature}` : ''}</p><p class="text-xs text-textSecondary mt-1">${item.occurred_date || '-'} • ${item.start_time || '--:--'} às ${item.end_time || '--:--'} • ${item.hours_formatted || formatHoursDecimal(item.hours_quantity)}</p></div><div class="text-right"><p class="text-sm font-semibold ${item.hour_entry_type === 'Hora Extra' ? 'text-success' : 'text-warn'}">${item.hour_entry_type === 'Hora Extra' ? fmt(item.financial_total) : formatHoursDecimal(item.hours_quantity)}</p>${item.observation ? `<p class="text-xs text-textSecondary mt-1">${escapeHtml(item.observation)}</p>` : ''}</div></div></div>`).join('')}</div></div>`).join(''));

            const people = [...new Set(allRecords.filter((record) => record.type === 'pessoa').map((record) => record.person))].sort((a, b) => a.localeCompare(b));
            const competence = filter?.value || thisMonth;
            window.financeApp.financeUiAdapters.setHtml('controle-horas-saldos', people.map((person) => {
                const saldo = calcularSaldoBanco(person, competence);
                return `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${escapeHtml(person)}</p><p class="kpi-value text-warn mt-2">${formatHoursDecimal(saldo.saldoAtual)}</p><div class="grid grid-cols-2 gap-2 mt-3 text-xs"><div><span class="text-textSecondary">Anterior</span><p class="font-semibold">${formatHoursDecimal(saldo.saldoAnterior)}</p></div><div><span class="text-textSecondary">Débito</span><p class="font-semibold text-accent">${formatHoursDecimal(saldo.horasDebito)}</p></div><div><span class="text-textSecondary">Crédito</span><p class="font-semibold text-danger">${formatHoursDecimal(saldo.horasCredito)}</p></div><div><span class="text-textSecondary">Atual</span><p class="font-semibold text-warn">${formatHoursDecimal(saldo.saldoAtual)}</p></div></div></div>`;
            }).join('') || '<p class="text-sm text-textSecondary text-center py-6">Nenhuma pessoa cadastrada.</p>');

            window.financeApp.financeUiAdapters.setHidden('controle-horas-empty', groups.length > 0);
            window.financeApp.financeUiAdapters.setText('controle-horas-meta', `${records.length} lançamento(s) • competência ${formatCompetence(competence)}`);
            lucide.createIcons();
        }

        function openEntryDetailModal(person, competencia) {
            const modal = document.getElementById('entry-detail-modal');
            const appRoot = document.getElementById('app');
            if (modal && appRoot && modal.parentElement?.id === 'view-configuracoes') appRoot.appendChild(modal);
            const consolidated = consolidarEntradaMensal(person, competencia);
            const detail = document.getElementById('entry-detail-content');
            if (!detail) return;
            document.getElementById('entry-detail-title').textContent = `${person} • ${formatCompetence(competencia)}`;
            document.getElementById('entry-detail-subtitle').textContent = 'Folha simplificada consolidada do mês';
            detail.innerHTML = `<div class="money-metric-card mb-4"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Resumo principal</p><div class="entry-consolidated-grid mt-3"><div><p class="text-xs text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-2">${fmt(consolidated.liquido)}</p></div><div><p class="text-xs text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-2">${fmt(consolidated.salaryBase)}</p></div><div><p class="text-xs text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-2">${fmt(consolidated.hourExtra)}</p></div><div><p class="text-xs text-textSecondary">Base Total</p><p class="kpi-value text-textPrimary mt-2">${fmt(consolidated.baseTotal)}</p></div></div></div><div class="entry-detail-grid"><div class="money-metric-card"><h4 class="font-semibold text-sm">Bloco financeiro</h4><div class="space-y-2 text-sm mt-3"><div class="flex justify-between"><span>Salário Base</span><strong>${fmt(consolidated.salaryBase)}</strong></div><div class="flex justify-between"><span>Hora Extra</span><strong class="text-accent">${fmt(consolidated.hourExtra)}</strong></div><div class="flex justify-between"><span>Base Total</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>INSS</span><strong class="text-danger">-${fmt(consolidated.inss)}</strong></div><div class="flex justify-between"><span>IRRF</span><strong class="text-danger">-${fmt(consolidated.irrf)}</strong></div><div class="flex justify-between"><span>Outros descontos</span><strong class="text-danger">-${fmt(consolidated.outrosDescontos)}</strong></div><div class="flex justify-between pt-2 border-t border-surfaceLight"><span>Líquido final</span><strong class="text-success">${fmt(consolidated.liquido)}</strong></div></div></div><div class="time-metric-card"><h4 class="font-semibold text-sm">Bloco Hora Extra</h4><div class="space-y-2 text-sm mt-3">${consolidated.hourEntries.length ? consolidated.hourEntries.map((item) => `<div class="rounded-lg border border-surfaceLight bg-surface/50 p-3"><div class="flex justify-between gap-3"><span>${item.hours_formatted || formatHoursDecimal(item.hours_quantity)} • ${(Number(item.overtime_percentage || 0) * 100).toFixed(0)}%</span><strong class="text-success">${fmt(item.financial_total)}</strong></div></div>`).join('') : '<p class="text-textSecondary">Nenhum lançamento de hora extra no mês.</p>'}</div></div><div class="bank-metric-card"><h4 class="font-semibold text-sm">Bloco Banco de Horas</h4><div class="grid grid-cols-2 gap-3 mt-3 text-sm"><div><p class="text-xs text-textSecondary">Saldo anterior</p><p class="text-lg font-semibold">${formatHoursDecimal(consolidated.banco.saldoAnterior)}</p></div><div><p class="text-xs text-textSecondary">Horas débito</p><p class="text-lg font-semibold text-accent">${formatHoursDecimal(consolidated.banco.horasDebito)}</p></div><div><p class="text-xs text-textSecondary">Horas crédito</p><p class="text-lg font-semibold text-danger">${formatHoursDecimal(consolidated.banco.horasCredito)}</p></div><div><p class="text-xs text-textSecondary">Saldo atual</p><p class="text-lg font-semibold text-warn">${formatHoursDecimal(consolidated.banco.saldoAtual)}</p></div></div></div><div class="money-metric-card"><h4 class="font-semibold text-sm">Bloco Descontos</h4><div class="space-y-2 text-sm mt-3">${consolidated.descontoRecords.length ? consolidated.descontoRecords.map((item) => `<div class="flex justify-between gap-3"><span>${escapeHtml(item.description || item.subcategory || item.earning_type || 'Desconto')}</span><strong class="text-danger">-${fmt(item.amount)}</strong></div>`).join('') : '<p class="text-textSecondary">Nenhum desconto detalhado no mês.</p>'}</div></div><div class="time-metric-card"><h4 class="font-semibold text-sm">Memória de cálculo</h4><div class="space-y-2 text-sm mt-3"><div class="flex justify-between"><span>Valor hora normal</span><strong>${fmt(calcularHoraExtra({ person, competencia, horas: 1, percentual: 0, salaryBase: consolidated.salaryBase }).valorHoraNormal)}</strong></div><div class="flex justify-between"><span>Base INSS</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>Base IRRF</span><strong>${fmt(Math.max(0, consolidated.baseTotal - consolidated.inss))}</strong></div><div class="flex justify-between"><span>Cálculo do INSS</span><strong class="text-danger">-${fmt(consolidated.inss)}</strong></div><div class="flex justify-between"><span>Cálculo do IRRF</span><strong class="text-danger">-${fmt(consolidated.irrf)}</strong></div></div></div></div>`;
            document.getElementById('entry-detail-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeHourDetailModal() {
            const modal = document.getElementById('hour-detail-modal');
            if (modal) modal.classList.add('hidden');
        }

        function openHourDetailModal(key) {
            const modal = document.getElementById('hour-detail-modal');
            const appRoot = document.getElementById('app');
            if (modal && appRoot && modal.parentElement?.id === 'view-configuracoes') appRoot.appendChild(modal);
            const [person, competencia] = key.split('|');
            const records = allRecords
                .filter((record) => record.type === 'controle_horas' && record.person === person && normalizeCompetenceKey(record.competence) === normalizeCompetenceKey(competencia))
                .sort((a, b) => (b.occurred_date || '').localeCompare(a.occurred_date || ''));
            const saldo = calcularSaldoBanco(person, competencia);
            document.getElementById('hour-detail-title').textContent = `${person} • ${formatCompetence(competencia)}`;
            document.getElementById('hour-detail-subtitle').textContent = 'Detalhamento do período';
            document.getElementById('hour-detail-content').innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">${['Saldo anterior', 'Horas débito', 'Horas crédito', 'Saldo atual'].map((label, index) => { const values = [formatHoursDecimal(Math.abs(saldo.saldoAnterior)), formatHoursDecimal(saldo.horasDebito), formatHoursDecimal(saldo.horasCredito), `${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}`]; return `<div class="bank-metric-card"><p class="text-xs text-textSecondary">${label}</p><p class="text-lg font-semibold mt-2">${values[index]}</p></div>`; }).join('')}</div><div class="space-y-3 mt-4">${records.map((item) => `<div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><div class="flex items-center justify-between gap-3"><div><p class="text-sm font-semibold ${item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra' ? 'text-accent' : 'text-warn'}">${item.hour_control_type || item.hour_entry_type}${item.bank_nature ? ` • ${item.bank_nature}` : ''}</p><p class="text-xs text-textSecondary mt-1">${item.occurred_date || '-'} • ${item.start_time || item.horaInicial || '--:--'} às ${item.end_time || item.horaFinal || '--:--'} • ${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}</p></div><div class="text-right"><p class="text-sm font-semibold ${item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra' ? 'text-success' : 'text-warn'}">${item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra' ? fmt(item.financial_total || item.valorTotalCalculado || 0) : `${String(item.bank_nature || '').toLowerCase().startsWith('d') ? '+' : '-'}${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}`}</p>${item.observation || item.description ? `<p class="text-xs text-textSecondary mt-1">${escapeHtml(item.observation || item.description)}</p>` : ''}</div></div></div>`).join('')}</div>`;
            modal?.classList.remove('hidden');
            lucide.createIcons();
        }

        function closeEntryDetailModal() { document.getElementById('entry-detail-modal').classList.add('hidden'); }

        function renderEntradas() {
            ['active', 'archived', 'all'].forEach((mode) => {
                const button = document.getElementById(`entradas-filter-${mode}`);
                if (button) button.className = `px-3 py-1.5 text-xs rounded-md ${listArchiveFilters.entradas === mode ? 'bg-success text-bg' : 'text-textSecondary'}`;
            });
            const entries = getEntradasConsolidadas();
            const pagination = document.getElementById('entradas-pagination');
            const visibleEntries = entries;
            const searchLabel = listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : '';
            window.financeApp.financeUiAdapters.renderListState({
                listId: 'entradas-list',
                emptyId: 'entradas-empty',
                metaId: 'entradas-meta',
                html: visibleEntries.map((entry) => `<div class="glass rounded-2xl p-4 border border-surfaceLight"><div class="flex items-start justify-between gap-3 flex-wrap mb-4"><div><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Competência</p><h3 class="text-lg font-semibold mt-1">${formatCompetence(entry.competencia)} • ${escapeHtml(entry.person)}</h3></div><button type="button" data-open-entry-detail-person="${escapeHtml(entry.person)}" data-open-entry-detail-competence="${entry.competencia}" class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors">Visualizar</button></div><div class="entry-consolidated-grid"><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-3">${fmt(entry.salaryBase)}</p></div><div class="time-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-3">${fmt(entry.hourExtra)}</p></div><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-3">${fmt(entry.liquido)}</p></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-textSecondary"><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">Descontos: <strong class="text-danger">-${fmt(entry.outrosDescontos)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">INSS: <strong class="text-danger">-${fmt(entry.inss)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">IRRF: <strong class="text-danger">-${fmt(entry.irrf)}</strong></div></div></div>`).join(''),
                hasItems: entries.length > 0,
                metaText: `${visibleEntries.length} competência(s) consolidadas${searchLabel}`
            });
            if (pagination) pagination.classList.add('hidden');
            lucide.createIcons();
        }
