function getEntryDiscountAdjustmentRecord(person = '', competencia = '') {
            return allRecords.find((record) =>
                record?.type === 'entrada' &&
                record.person === person &&
                record.competence === competencia &&
                record.entry_discount_adjustment === true
            ) || null;
        }

        function buildEntryDiscountInputId(person = '', competencia = '') {
            return `entry-discount-${encodeURIComponent(`${person}|${competencia}`).replace(/[^a-zA-Z0-9]/g, '_')}`;
        }

        function getDeductionMacroValue() {
            return allRecords.find((record) =>
                record?.type === 'entrada' &&
                String(record.macro_category || '').toUpperCase().includes('DEDU')
            )?.macro_category || 'Dedução';
        }

        async function saveEntryDiscountAdjustmentByEntry(person = '', competencia = '') {
            const input = document.getElementById(buildEntryDiscountInputId(person, competencia));
            if (!person || !competencia || !input) return;

            const amount = roundCurrency(Number(input.value || 0));
            if (Number.isNaN(amount) || amount < 0) {
                showToast('Informe um desconto válido', true);
                return;
            }

            const existing = getEntryDiscountAdjustmentRecord(person, competencia);
            const payload = {
                type: 'entrada',
                person,
                competence: competencia,
                macro_category: getDeductionMacroValue(),
                subcategory: 'Outros descontos',
                description: 'Outros descontos (ajuste manual)',
                amount,
                earning_type: 'Outros descontos',
                status: 'Pago',
                payment_method: '',
                occurred_date: '',
                due_date: '',
                paid_at: '',
                cycle: '',
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                recurrence: '',
                category_id: '',
                category_name: '',
                category_color: '',
                category_icon: '',
                archived: existing?.archived || false,
                archived_at: existing?.archived_at || '',
                entry_discount_adjustment: true,
                created_at: existing?.created_at || new Date().toISOString(),
                ...getHourExtraRecordDefaults()
            };

            const result = existing
                ? await window.dataSdk.update({ ...existing, ...payload, id: existing.id })
                : await window.dataSdk.create(payload);

            if (!result?.isOk) {
                showToast('Erro ao salvar desconto', true);
                return;
            }

            showToast('Desconto atualizado!');
            renderCurrentTab();
        }

        window.saveEntryDiscountAdjustmentByEntry = saveEntryDiscountAdjustmentByEntry;

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
                return `<div class="glass rounded-2xl p-4 border border-surfaceLight"><div class="flex items-start justify-between gap-3 flex-wrap mb-4"><div><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Competência</p><h3 class="text-lg font-semibold mt-1">${formatCompetence(entry.competencia)} • ${escapeHtml(entry.person)}</h3></div><button type="button" data-open-entry-detail-person="${escapeHtml(entry.person)}" data-open-entry-detail-competence="${entry.competencia}" class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors">Visualizar</button></div><div class="entry-consolidated-grid"><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-3">${fmt(entry.salaryBase)}</p></div><div class="time-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-3">${fmt(entry.hourExtra)}</p></div><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-3">${fmt(entry.liquido)}</p></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-textSecondary"><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">Descontos: <strong class="text-danger">-${fmt(entry.outrosDescontos)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">INSS: <strong class="text-danger">-${fmt(entry.inss)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">IRRF: <strong class="text-danger">-${fmt(entry.irrf)}</strong></div></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3 mt-4"><div class="flex items-center justify-between gap-3 flex-wrap mb-2"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Outros descontos</p><p class="text-[11px] text-textSecondary">Informe o valor total do ajuste deste mês</p></div><div class="flex gap-2 flex-col sm:flex-row"><input id="${inputId}" type="number" step="0.01" min="0" value="${adjustmentValue}" placeholder="0,00" class="flex-1 bg-surface border border-surfaceLight rounded-xl px-3 py-2 text-sm text-textPrimary"><button type="button" data-save-entry-discount-person="${escapeHtml(entry.person)}" data-save-entry-discount-competence="${entry.competencia}" class="px-3 py-2 text-xs rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors font-semibold">Salvar desconto</button></div></div></div>`;
            }).join('');

            meta.textContent = `${entries.length} competência(s) consolidadas${competenceFilter ? ` • ${formatCompetence(competenceFilter)}` : ''}${listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : ''}`;
            empty.classList.toggle('hidden', entries.length > 0);
            if (pagination) pagination.classList.add('hidden');
            lucide.createIcons();
        };
