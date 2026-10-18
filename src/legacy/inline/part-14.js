function getPersonReceivingType(personName = '') {
            const personRecord = allRecords.find((record) => record?.type === 'pessoa' && record.person === personName);
            return personRecord?.receiving_type === 'quinzenal' ? 'quinzenal' : 'mensal';
        }

        function calculateSalaryAdvance(personName = '', salaryBase = 0) {
            if (getPersonReceivingType(personName) !== 'quinzenal') return 0;
            return roundCurrency((Number(salaryBase) || 0) * 0.4);
        }

        function ensureReceivingTypeField() {
            const modal = document.getElementById('add-person-modal');
            const noteWrap = document.getElementById('person-salary-note')?.parentElement;
            if (!modal || !noteWrap || document.getElementById('person-receiving-type')) return;
            const wrap = document.createElement('div');
            wrap.className = 'mb-4';
            wrap.innerHTML = `
                <label class="text-xs text-textSecondary mb-1 block">Tipo de recebimento</label>
                <select id="person-receiving-type" class="w-full text-sm">
                    <option value="mensal">Uma vez ao mês</option>
                    <option value="quinzenal">Quinzenal</option>
                </select>
            `;
            noteWrap.parentElement.insertBefore(wrap, noteWrap);
        }

        async function updatePersonReceivingType(personId, value) {
            const current = allRecords.find((record) => record.id === personId && record.type === 'pessoa');
            if (!current) return;
            const result = await window.dataSdk.update({
                ...current,
                id: current.id,
                receiving_type: value === 'quinzenal' ? 'quinzenal' : 'mensal'
            });
            if (!result?.isOk) {
                showToast('Erro ao atualizar tipo de recebimento', true);
                return;
            }
            const index = allRecords.findIndex((record) => record.id === current.id);
            if (index >= 0) allRecords[index] = { ...allRecords[index], receiving_type: value === 'quinzenal' ? 'quinzenal' : 'mensal' };
            renderCurrentTab();
        }

        addPerson = function () {
            document.getElementById('person-input').value = '';
            document.getElementById('person-base-salary').value = '';
            document.getElementById('person-salary-start').value = today;
            document.getElementById('person-salary-note').value = '';
            ensureReceivingTypeField();
            document.getElementById('person-receiving-type').value = 'mensal';
            document.getElementById('add-person-modal').classList.remove('hidden');
            document.getElementById('person-input').focus();
        };

        savePerson = async function () {
            const name = document.getElementById('person-input').value.trim();
            const salaryBase = Number(document.getElementById('person-base-salary').value) || 0;
            const salaryStart = document.getElementById('person-salary-start').value || today;
            const note = document.getElementById('person-salary-note').value || '';
            const receivingType = document.getElementById('person-receiving-type')?.value === 'quinzenal' ? 'quinzenal' : 'mensal';
            if (!name) { showToast('Informe um nome', true); return; }
            if (countRecordsByType('pessoa') >= MAX_PEOPLE_RECORDS) { showToast(`Limite de ${MAX_PEOPLE_RECORDS} pessoas atingido!`, true); return; }

            const personResult = await window.dataSdk.create({
                type: 'pessoa',
                person: name,
                macro_category: '',
                subcategory: '',
                description: '',
                amount: 0,
                status: '',
                payment_method: '',
                occurred_date: '',
                due_date: '',
                competence: '',
                paid_at: '',
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                earning_type: '',
                recurrence: '',
                created_at: new Date().toISOString(),
                category_id: '',
                category_name: '',
                category_color: '',
                category_icon: '',
                salary_base: roundCurrency(salaryBase),
                receiving_type: receivingType,
                ...getHourExtraRecordDefaults()
            });

            if (!personResult.isOk) { showToast('Erro ao adicionar', true); return; }
            if (salaryBase > 0) {
                await window.dataSdk.create({ type: 'salario_historico', person: name, salary_base: roundCurrency(salaryBase), start_date: salaryStart, end_date: '', observation: note, created_at: new Date().toISOString() });
            }
            showToast('Pessoa adicionada!');
            closeAddPersonModal();
        };

        const _currentRenderConfiguracoes = renderConfiguracoes;
        renderConfiguracoes = function () {
            _currentRenderConfiguracoes();
            ensureReceivingTypeField();
            const pessoas = allRecords.filter((record) => record.type === 'pessoa');
            const pessoasList = document.getElementById('pessoas-list');
            const pessoasEmpty = document.getElementById('pessoas-empty');
            if (!pessoasList || !pessoasEmpty) return;

            if (!pessoas.length) {
                pessoasList.innerHTML = '';
                pessoasEmpty.classList.toggle('hidden', false);
            } else {
                pessoasEmpty.classList.toggle('hidden', true);
                pessoasList.innerHTML = pessoas.map((p) => {
                    const salary = getSalarioVigente(p.person, thisMonth).salario;
                    const history = getSalaryHistoryRecords(p.person);
                    const currentHistory = history.find((item) => !item.end_date) || history[0];
                    const receivingType = p.receiving_type === 'quinzenal' ? 'quinzenal' : 'mensal';
                    return `<div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><div class="flex items-start justify-between gap-3 flex-wrap"><div><p class="text-sm font-semibold">${escapeHtml(p.person)}</p><p class="text-xl font-bold text-success mt-2">${fmt(salary)}</p><p class="text-xs text-textSecondary mt-1">${currentHistory?.start_date ? `Vigente desde ${currentHistory.start_date}` : 'Sem histórico definido'}</p><div class="mt-3"><label class="text-[11px] text-textSecondary mb-1 block">Tipo de recebimento</label><select data-update-person-receiving-type="${p.id}" class="w-full text-sm"><option value="mensal" ${receivingType === 'mensal' ? 'selected' : ''}>Uma vez ao mês</option><option value="quinzenal" ${receivingType === 'quinzenal' ? 'selected' : ''}>Quinzenal</option></select></div></div><div class="flex gap-2 flex-wrap"><button type="button" data-open-salary-history-id="${p.id}" data-open-salary-history-person="${escapeHtml(p.person)}" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Ver histórico</button><button type="button" data-open-salary-history-id="${p.id}" data-open-salary-history-person="${escapeHtml(p.person)}" class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white">Adicionar novo salário</button><button type="button" data-delete-person-id="${p.id}" class="text-textSecondary hover:text-danger p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></div>`;
                }).join('');
            }
            lucide.createIcons();
        };

        openEntryDetailModal = function (person, competencia) {
            ensureModalDetached('entry-detail-modal');
            const consolidated = consolidarEntradaMensal(person, competencia);
            const calculationBase = consolidated.baseTrabalho || consolidated.baseTotal;
            const inssDetail = calculateINSSDetailed(calculationBase);
            const irrfDetail = calculateIRRFDetailed(calculationBase, consolidated.inss);
            const detail = document.getElementById('entry-detail-content');
            if (!detail) return;
            document.getElementById('entry-detail-title').textContent = `${person} • ${formatCompetence(competencia)}`;
            document.getElementById('entry-detail-subtitle').textContent = 'Folha simplificada consolidada do mês';
            detail.innerHTML = `<div class="money-metric-card mb-4"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Resumo principal</p><div class="entry-consolidated-grid mt-3"><div><p class="text-xs text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-2">${fmt(consolidated.liquido)}</p></div><div><p class="text-xs text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-2">${fmt(consolidated.salaryBase)}</p></div><div><p class="text-xs text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-2">${fmt(consolidated.hourExtra)}</p></div><div><p class="text-xs text-textSecondary">Base Total</p><p class="kpi-value text-textPrimary mt-2">${fmt(consolidated.baseTotal)}</p></div></div></div><div class="entry-detail-grid"><div class="money-metric-card"><h4 class="font-semibold text-sm">Bloco financeiro</h4><div class="space-y-2 text-sm mt-3"><div class="flex justify-between"><span>Tipo de recebimento</span><strong>${consolidated.receivingType === 'quinzenal' ? 'Quinzenal' : 'Uma vez ao mês'}</strong></div><div class="flex justify-between"><span>Salário Bruto</span><strong>${fmt(consolidated.salaryBase)}</strong></div><div class="flex justify-between"><span>Hora Extra</span><strong class="text-accent">${fmt(consolidated.hourExtra)}</strong></div><div class="flex justify-between"><span>Base Total</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>INSS</span><strong class="text-danger">-${fmt(consolidated.inss)}</strong></div><div class="flex justify-between"><span>Base do cálculo tradicional do IRRF</span><strong>${fmt(irrfDetail.baseTradicional)}</strong></div><div class="flex justify-between"><span>IRRF tradicional</span><strong class="text-danger">-${fmt(irrfDetail.irrfTradicional)}</strong></div><div class="flex justify-between"><span>Redução IRRF 2026</span><strong class="text-accent">${fmt(irrfDetail.reducao)}</strong></div><div class="flex justify-between"><span>IRRF final</span><strong class="text-danger">-${fmt(consolidated.irrf)}</strong></div>${consolidated.adiantamentoQuinzena > 0 ? `<div class="flex justify-between"><span>Adiantamento quinzena (40%)</span><strong class="text-danger">-${fmt(consolidated.adiantamentoQuinzena)}</strong></div>` : ''}<div class="flex justify-between"><span>Outros descontos</span><strong class="text-danger">-${fmt(consolidated.outrosDescontosManuais || 0)}</strong></div><div class="flex justify-between pt-2 border-t border-surfaceLight"><span>Líquido final</span><strong class="text-success">${fmt(consolidated.liquido)}</strong></div></div></div><div class="time-metric-card"><h4 class="font-semibold text-sm">Bloco Hora Extra</h4><div class="space-y-2 text-sm mt-3">${consolidated.hourEntries.length ? consolidated.hourEntries.map((item) => `<div class="rounded-lg border border-surfaceLight bg-surface/50 p-3"><div class="flex justify-between gap-3"><span>${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)} • ${((Number(item.overtime_percentage || item.percentualUsado || 0) > 1 ? Number(item.overtime_percentage || item.percentualUsado || 0) : Number(item.overtime_percentage || item.percentualUsado || 0) * 100)).toFixed(0)}%</span><strong class="text-success">${fmt(item.financial_total || item.valorTotalCalculado || 0)}</strong></div></div>`).join('') : '<p class="text-textSecondary">Nenhum lançamento de hora extra no mês.</p>'}</div></div><div class="bank-metric-card"><h4 class="font-semibold text-sm">Bloco Banco de Horas</h4><div class="grid grid-cols-2 gap-3 mt-3 text-sm"><div><p class="text-xs text-textSecondary">Saldo anterior</p><p class="text-lg font-semibold">${formatHoursDecimal(Math.abs(consolidated.banco.saldoAnterior))}</p></div><div><p class="text-xs text-textSecondary">Horas débito</p><p class="text-lg font-semibold text-accent">${formatHoursDecimal(consolidated.banco.horasDebito)}</p></div><div><p class="text-xs text-textSecondary">Horas crédito</p><p class="text-lg font-semibold text-danger">${formatHoursDecimal(consolidated.banco.horasCredito)}</p></div><div><p class="text-xs text-textSecondary">Saldo atual</p><p class="text-lg font-semibold text-warn">${consolidated.banco.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(consolidated.banco.saldoAtual))}</p></div></div></div><div class="money-metric-card"><h4 class="font-semibold text-sm">Bloco Descontos</h4><div class="space-y-2 text-sm mt-3">${consolidated.adiantamentoQuinzena > 0 ? `<div class="flex justify-between gap-3"><span>Adiantamento quinzena (40%)</span><strong class="text-danger">-${fmt(consolidated.adiantamentoQuinzena)}</strong></div>` : ''}${consolidated.descontoRecords.length ? consolidated.descontoRecords.map((item) => `<div class="flex justify-between gap-3"><span>${escapeHtml(item.description || item.subcategory || item.earning_type || 'Desconto')}</span><strong class="text-danger">-${fmt(item.amount)}</strong></div>`).join('') : '<p class="text-textSecondary">Nenhum desconto detalhado no mês.</p>'}</div></div><div class="time-metric-card"><h4 class="font-semibold text-sm">Memória de cálculo</h4><div class="space-y-2 text-sm mt-3"><div class="flex justify-between"><span>Base Bruta</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>Hora Extra</span><strong>${fmt(consolidated.hourExtra)}</strong></div><div class="flex justify-between"><span>Base Total</span><strong>${fmt(consolidated.baseTotal)}</strong></div>${consolidated.adiantamentoQuinzena > 0 ? `<div class="flex justify-between"><span>Adiantamento 40% do salário base</span><strong>${fmt(consolidated.adiantamentoQuinzena)}</strong></div>` : ''}<div class="flex justify-between"><span>INSS</span><strong class="text-danger">-${fmt(inssDetail.total)}</strong></div>${inssDetail.breakdown.map((item) => `<div class="flex justify-between"><span>${item.faixa} (${(item.aliquota * 100).toFixed(1)}%)</span><strong>${fmt(item.valor)}</strong></div>`).join('')}<div class="flex justify-between"><span>Base do cálculo tradicional</span><strong>${fmt(irrfDetail.baseTradicional)}</strong></div><div class="flex justify-between"><span>IRRF tradicional</span><strong>${fmt(irrfDetail.irrfTradicional)}</strong></div><div class="flex justify-between"><span>Valor da Redução</span><strong>${fmt(irrfDetail.reducao)}</strong></div><div class="flex justify-between"><span>IRRF final</span><strong>${fmt(irrfDetail.irrfFinal)}</strong></div><div class="flex justify-between"><span>Outros descontos</span><strong>${fmt(consolidated.outrosDescontosManuais || 0)}</strong></div><div class="flex justify-between"><span>Salário líquido final</span><strong class="text-success">${fmt(consolidated.liquido)}</strong></div></div></div></div>`;
            document.getElementById('entry-detail-modal').classList.remove('hidden');
            lucide.createIcons();
        };
