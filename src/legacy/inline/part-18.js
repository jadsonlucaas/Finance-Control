renderControleHoras = function () {
            const cycleFlags = document.getElementById('controle-horas-cycle-flags');
            if (cycleFlags) cycleFlags.remove();

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
                const totalHE = roundCurrency(items
                    .filter((item) => (item.hour_entry_type || item.hour_control_type) === 'Hora Extra')
                    .reduce((sum, item) => sum + (Number(item.financial_total || item.valorTotalCalculado) || 0), 0));
                const saldoBanco = calcularSaldoBanco(person, competence);
                return { person, competence, totalHE, saldoBanco, items: sortRecordsNewestFirst(items) };
            }).sort((a, b) => `${b.competence}|${b.person}`.localeCompare(`${a.competence}|${a.person}`));

            list.innerHTML = groups.map((group) => `<div class="rounded-2xl border border-surfaceLight bg-surface p-4"><div class="flex items-start justify-between gap-3 flex-wrap"><div><h3 class="font-semibold text-sm">${escapeHtml(group.person)} • ${formatCompetence(group.competence)}</h3><p class="text-xs text-textSecondary mt-1">Total H.E.: ${fmt(group.totalHE)} • Saldo banco: ${group.saldoBanco.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(group.saldoBanco.saldoAtual))}</p></div><button type="button" data-open-hour-detail="${escapeHtml(group.person)}|${group.competence}" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Detalhar</button></div></div>`).join('');

            const people = [...new Set(allRecords.filter((record) => record.type === 'pessoa').map((record) => record.person))].sort((a, b) => a.localeCompare(b));
            const competence = filter?.value || thisMonth;
            saldosWrap.innerHTML = people.map((person) => {
                const saldo = calcularSaldoBanco(person, competence);
                return `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${escapeHtml(person)}</p><p class="kpi-value text-warn mt-2">${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}</p><div class="grid grid-cols-2 gap-2 mt-3 text-xs"><div><span class="text-textSecondary">Anterior</span><p class="font-semibold">${formatHoursDecimal(Math.abs(saldo.saldoAnterior))}</p></div><div><span class="text-textSecondary">Débito</span><p class="font-semibold text-accent">${formatHoursDecimal(saldo.horasDebito)}</p></div><div><span class="text-textSecondary">Crédito</span><p class="font-semibold text-danger">${formatHoursDecimal(saldo.horasCredito)}</p></div><div><span class="text-textSecondary">Atual</span><p class="font-semibold text-warn">${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}</p></div></div></div>`;
            }).join('') || '<p class="text-sm text-textSecondary text-center py-6">Nenhuma pessoa cadastrada.</p>';

            empty.classList.toggle('hidden', groups.length > 0);
            meta.textContent = `${records.length} lançamento(s) • competência ${formatCompetence(competence)}`;
            lucide.createIcons();
        };
