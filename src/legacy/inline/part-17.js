function ensureControleHorasCycleFlags() {
            const actions = document.querySelector('#view-controle-horas .mobile-section-actions');
            const search = document.getElementById('controle-horas-search');
            if (!actions || !search || document.getElementById('controle-horas-cycle-flags')) return;

            const wrap = document.createElement('div');
            wrap.id = 'controle-horas-cycle-flags';
            wrap.className = 'flex gap-1 bg-surfaceLight/40 rounded-lg p-1 border border-surfaceLight';
            wrap.innerHTML = `
                <button type="button" id="controle-horas-cycle-inicio" class="px-3 py-1.5 text-xs rounded-md bg-accent text-white" data-set-controle-horas-cycle="INICIO_MES">Início do mês</button>
                <button type="button" id="controle-horas-cycle-quinzena" class="px-3 py-1.5 text-xs rounded-md text-textSecondary" data-set-controle-horas-cycle="QUINZENA">Quinzena</button>
            `;
            actions.insertBefore(wrap, search);
        }

        let controleHorasCycleFilter = 'INICIO_MES';

        function setControleHorasCycleFilter(value = 'INICIO_MES') {
            controleHorasCycleFilter = value === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
            renderControleHoras();
        }

        function getControleHorasCycleFromRecord(record) {
            const explicitCycle = String(record?.cycle || '').toUpperCase();
            if (explicitCycle === 'QUINZENA' || explicitCycle === 'INICIO_MES') return explicitCycle;
            const dateValue = String(record?.occurred_date || '').trim();
            const day = Number(dateValue.split('-')[2] || 0);
            if (!day) return 'INICIO_MES';
            return day <= 15 ? 'QUINZENA' : 'INICIO_MES';
        }

        renderControleHoras = function () {
            ensureControleHorasCycleFlags();
            const list = document.getElementById('controle-horas-list');
            const empty = document.getElementById('controle-horas-empty');
            const saldosWrap = document.getElementById('controle-horas-saldos');
            const meta = document.getElementById('controle-horas-meta');
            const filter = document.getElementById('controle-horas-competencia');
            const btnInicio = document.getElementById('controle-horas-cycle-inicio');
            const btnQuinzena = document.getElementById('controle-horas-cycle-quinzena');
            if (filter && !filter.value) filter.value = thisMonth;
            if (!list || !empty || !saldosWrap || !meta) return;

            if (btnInicio) btnInicio.className = controleHorasCycleFilter === 'INICIO_MES'
                ? 'px-3 py-1.5 text-xs rounded-md bg-accent text-white'
                : 'px-3 py-1.5 text-xs rounded-md text-textSecondary';
            if (btnQuinzena) btnQuinzena.className = controleHorasCycleFilter === 'QUINZENA'
                ? 'px-3 py-1.5 text-xs rounded-md bg-accent text-white'
                : 'px-3 py-1.5 text-xs rounded-md text-textSecondary';

            const competence = filter?.value || thisMonth;
            const searchTerm = normalizeListSearchValue(document.getElementById('controle-horas-search')?.value || '');
            const records = allRecords
                .filter((record) => record?.type === 'controle_horas')
                .filter((record) => !competence || normalizeCompetenceKey(record.competence) === normalizeCompetenceKey(competence))
                .filter((record) => getControleHorasCycleFromRecord(record) === controleHorasCycleFilter)
                .filter((record) => {
                    if (!searchTerm) return true;
                    return normalizeListSearchValue(`${record.person} ${record.competence} ${record.hour_entry_type || record.hour_control_type || ''} ${record.bank_nature || ''} ${record.observation || record.description || ''}`).includes(searchTerm);
                })
                .sort((a, b) => `${b.competence}|${b.occurred_date || ''}|${b.person}`.localeCompare(`${a.competence}|${a.occurred_date || ''}|${a.person}`));

            list.innerHTML = records.map((item) => {
                const typeLabel = item.hour_control_type || item.hour_entry_type || '-';
                const isHoraExtra = typeLabel === 'Hora Extra';
                const hoursLabel = item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras || 0);
                const valueLabel = isHoraExtra
                    ? fmt(item.financial_total || item.valorTotalCalculado || 0)
                    : `${String(item.bank_nature || '').toLowerCase().startsWith('d') ? '+' : '-'}${hoursLabel}`;

                return `<div class="rounded-2xl border border-surfaceLight bg-surface p-4">
                    <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="font-semibold text-sm">${escapeHtml(item.person || '-')} • ${formatCompetence(item.competence || competence)}</h3>
                                <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${controleHorasCycleFilter === 'QUINZENA' ? 'bg-accent/10 text-accent' : 'bg-surfaceLight text-textSecondary'}">${controleHorasCycleFilter === 'QUINZENA' ? 'Quinzena' : 'Início do mês'}</span>
                            </div>
                            <p class="text-xs text-textSecondary mt-1">${item.occurred_date || '-'} • ${item.start_time || item.horaInicial || '--:--'} às ${item.end_time || item.horaFinal || '--:--'} • ${hoursLabel}</p>
                            <p class="text-sm font-semibold mt-2 ${isHoraExtra ? 'text-accent' : 'text-warn'}">${typeLabel}${item.bank_nature ? ` • ${item.bank_nature}` : ''}</p>
                            ${(item.observation || item.description) ? `<p class="text-xs text-textSecondary mt-2">${escapeHtml(item.observation || item.description)}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-bold ${isHoraExtra ? 'text-success' : 'text-warn'}">${valueLabel}</p>
                            <button type="button" data-open-hour-detail="${escapeHtml(item.person || '')}|${item.competence || competence}" class="mt-3 px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Detalhar</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            const people = [...new Set(allRecords.filter((record) => record.type === 'pessoa').map((record) => record.person))].sort((a, b) => a.localeCompare(b));
            saldosWrap.innerHTML = people.map((person) => {
                const saldo = calcularSaldoBanco(person, competence);
                return `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${escapeHtml(person)}</p><p class="kpi-value text-warn mt-2">${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}</p><div class="grid grid-cols-2 gap-2 mt-3 text-xs"><div><span class="text-textSecondary">Anterior</span><p class="font-semibold">${formatHoursDecimal(Math.abs(saldo.saldoAnterior))}</p></div><div><span class="text-textSecondary">Débito</span><p class="font-semibold text-accent">${formatHoursDecimal(saldo.horasDebito)}</p></div><div><span class="text-textSecondary">Crédito</span><p class="font-semibold text-danger">${formatHoursDecimal(saldo.horasCredito)}</p></div><div><span class="text-textSecondary">Atual</span><p class="font-semibold text-warn">${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}</p></div></div></div>`;
            }).join('') || '<p class="text-sm text-textSecondary text-center py-6">Nenhuma pessoa cadastrada.</p>';

            empty.classList.toggle('hidden', records.length > 0);
            meta.textContent = `${records.length} lançamento(s) • ${controleHorasCycleFilter === 'QUINZENA' ? 'Quinzena' : 'Início do mês'} • competência ${formatCompetence(competence)}`;
            lucide.createIcons();
        };
