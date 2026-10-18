const TAX_SETTINGS_STORAGE_KEY = 'finance-control-tax-settings-v1';
        const DEFAULT_TAX_SETTINGS = {
            inssBrackets: [
                { limit: 1621.00, rate: 0.075 },
                { limit: 2902.84, rate: 0.09 },
                { limit: 4354.27, rate: 0.12 },
                { limit: 8475.55, rate: 0.14 }
            ],
            irrfReduction: {
                exemptLimit: 5000.00,
                maxReductionLimit: 7350.00,
                formulaFixed: 978.62,
                formulaFactor: 0.133145,
                zeroTaxCap: 312.89
            },
            irrfTraditionalBrackets: [
                { limit: 2259.20, rate: 0, deduction: 0 },
                { limit: 2826.65, rate: 0.075, deduction: 182.16 },
                { limit: 3751.05, rate: 0.15, deduction: 394.16 },
                { limit: 4664.68, rate: 0.225, deduction: 675.49 },
                { limit: 999999999, rate: 0.275, deduction: 908.73 }
            ]
        };

        function loadTaxSettings() {
            try {
                const raw = localStorage.getItem(TAX_SETTINGS_STORAGE_KEY);
                if (!raw) return JSON.parse(JSON.stringify(DEFAULT_TAX_SETTINGS));
                const parsed = JSON.parse(raw);
                return {
                    inssBrackets: Array.isArray(parsed.inssBrackets) && parsed.inssBrackets.length ? parsed.inssBrackets : DEFAULT_TAX_SETTINGS.inssBrackets,
                    irrfReduction: { ...DEFAULT_TAX_SETTINGS.irrfReduction, ...(parsed.irrfReduction || {}) },
                    irrfTraditionalBrackets: Array.isArray(parsed.irrfTraditionalBrackets) && parsed.irrfTraditionalBrackets.length ? parsed.irrfTraditionalBrackets : DEFAULT_TAX_SETTINGS.irrfTraditionalBrackets
                };
            } catch (error) {
                return JSON.parse(JSON.stringify(DEFAULT_TAX_SETTINGS));
            }
        }

        let taxSettings = loadTaxSettings();

        function persistTaxSettings() {
            localStorage.setItem(TAX_SETTINGS_STORAGE_KEY, JSON.stringify(taxSettings));
        }

        function calculateINSSDetailed(base = 0) {
            const value = Number(base) || 0;
            const result = window.financeApp?.taxEngine?.CalculateINSS?.({
                competence: window.thisMonth || '',
                grossIncomeCents: Math.round(value * 100),
                context: { allowLegacyWithoutCompetence: true }
            });

            return {
                base,
                total: roundCurrency((result?.amountCents || 0) / 100),
                parameterVersion: result?.parameterVersion || '',
                breakdown: (result?.breakdown || []).map((item) => ({
                    faixa: `Faixa ${item.order || ''}`.trim(),
                    base: roundCurrency((item.baseCents || 0) / 100),
                    aliquota: Number(item.rate) || 0,
                    valor: roundCurrency((item.amountCents || 0) / 100)
                }))
            };
        }

        function calculateIRRFDetailed(baseBruta = 0, inss = 0) {
            const bruto = Number(baseBruta) || 0;
            const result = window.financeApp?.taxEngine?.CalculateIRRF?.({
                competence: window.thisMonth || '',
                grossIncomeCents: Math.round(bruto * 100),
                inssCents: Math.round((Number(inss) || 0) * 100),
                context: { allowLegacyWithoutCompetence: true }
            });
            const bracket = (result?.breakdown || []).find((item) => item.code === 'IRRF_SELECTED_BRACKET') || {};

            return {
                baseBruta: bruto,
                baseTradicional: roundCurrency((result?.taxableIncomeCents || 0) / 100),
                irrfTradicional: roundCurrency((result?.traditionalCents || 0) / 100),
                reducao: roundCurrency((result?.reductionCents || 0) / 100),
                irrfFinal: roundCurrency((result?.amountCents || 0) / 100),
                aliquota: Number(bracket.rate) || 0,
                deducao: roundCurrency((bracket.deductionCents || 0) / 100),
                parameterVersion: result?.parameterVersion || ''
            };
        }

        calcularINSS = function (base, options = {}) {
            return window.financeApp?.taxEngine?.calcularINSS?.(base, options) || 0;
        };

        calcularIRRF = function (base, inss, options = {}) {
            return window.financeApp?.taxEngine?.calcularIRRF?.(base, inss, options) || 0;
        };

        function ensureModalDetached(modalId) {
            const modal = document.getElementById(modalId);
            if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
            return modal;
        }

        function renderTaxSettingsPanel() {
            const settingsWrap = document.querySelector('#view-configuracoes .space-y-6');
            if (!settingsWrap) return;

            const existing = document.getElementById('tax-settings-panel');
            if (existing) existing.remove();

            const panel = document.createElement('div');
            panel.id = 'tax-settings-panel';
            panel.className = 'bg-surface rounded-xl p-4 border border-surfaceLight';
            panel.innerHTML = `
                <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div>
                        <h3 class="font-semibold text-sm">Parâmetros INSS e IRRF</h3>
                        <p class="text-xs text-textSecondary mt-1">Ajuste as faixas conforme os materiais oficiais usados pelo sistema.</p>
                    </div>
                    <button type="button" data-legacy-click="saveTaxSettings" class="px-3 py-1.5 text-xs rounded-lg bg-accent text-white font-semibold">Salvar parâmetros</button>
                </div>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4">
                        <h4 class="font-semibold text-sm mb-3">INSS</h4>
                        <div class="space-y-3">
                            ${taxSettings.inssBrackets.map((item, index) => `
                                <div class="grid grid-cols-2 gap-3">
                                    <div>
                                        <label class="text-[11px] text-textSecondary mb-1 block">Teto faixa ${index + 1}</label>
                                        <input data-tax="inss-limit" data-index="${index}" type="number" step="0.01" value="${Number(item.limit).toFixed(2)}" class="w-full text-sm">
                                    </div>
                                    <div>
                                        <label class="text-[11px] text-textSecondary mb-1 block">Alíquota</label>
                                        <input data-tax="inss-rate" data-index="${index}" type="number" step="0.0001" value="${Number(item.rate).toFixed(4)}" class="w-full text-sm">
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4">
                        <h4 class="font-semibold text-sm mb-3">IRRF 2026</h4>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-[11px] text-textSecondary mb-1 block">Limite isenção</label>
                                <input id="irrf-exempt-limit" type="number" step="0.01" value="${Number(taxSettings.irrfReduction.exemptLimit).toFixed(2)}" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-[11px] text-textSecondary mb-1 block">Limite máximo redução</label>
                                <input id="irrf-max-reduction-limit" type="number" step="0.01" value="${Number(taxSettings.irrfReduction.maxReductionLimit).toFixed(2)}" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-[11px] text-textSecondary mb-1 block">Valor fixo redução</label>
                                <input id="irrf-formula-fixed" type="number" step="0.01" value="${Number(taxSettings.irrfReduction.formulaFixed).toFixed(2)}" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-[11px] text-textSecondary mb-1 block">Fator redução</label>
                                <input id="irrf-formula-factor" type="number" step="0.000001" value="${Number(taxSettings.irrfReduction.formulaFactor).toFixed(6)}" class="w-full text-sm">
                            </div>
                            <div>
                                <label class="text-[11px] text-textSecondary mb-1 block">Redução máxima até a isenção</label>
                                <input id="irrf-zero-tax-cap" type="number" step="0.01" value="${Number(taxSettings.irrfReduction.zeroTaxCap).toFixed(2)}" class="w-full text-sm">
                            </div>
                        </div>
                        <h5 class="font-semibold text-xs mt-4 mb-3 text-textSecondary uppercase tracking-[0.16em]">Tabela tradicional 2025</h5>
                        <div class="space-y-3">
                            ${taxSettings.irrfTraditionalBrackets.map((item, index) => `
                                <div class="grid grid-cols-3 gap-3">
                                    <div>
                                        <label class="text-[11px] text-textSecondary mb-1 block">Teto faixa ${index + 1}</label>
                                        <input data-tax="irrf-limit" data-index="${index}" type="number" step="0.01" value="${Number(item.limit).toFixed(2)}" class="w-full text-sm">
                                    </div>
                                    <div>
                                        <label class="text-[11px] text-textSecondary mb-1 block">Alíquota</label>
                                        <input data-tax="irrf-rate" data-index="${index}" type="number" step="0.0001" value="${Number(item.rate).toFixed(4)}" class="w-full text-sm">
                                    </div>
                                    <div>
                                        <label class="text-[11px] text-textSecondary mb-1 block">Dedução</label>
                                        <input data-tax="irrf-deduction" data-index="${index}" type="number" step="0.01" value="${Number(item.deduction).toFixed(2)}" class="w-full text-sm">
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            settingsWrap.prepend(panel);
        }

        function saveTaxSettings() {
            const next = {
                inssBrackets: taxSettings.inssBrackets.map((_, index) => ({
                    limit: Number(document.querySelector(`[data-tax="inss-limit"][data-index="${index}"]`)?.value || 0),
                    rate: Number(document.querySelector(`[data-tax="inss-rate"][data-index="${index}"]`)?.value || 0)
                })),
                irrfReduction: {
                    exemptLimit: Number(document.getElementById('irrf-exempt-limit')?.value || 0),
                    maxReductionLimit: Number(document.getElementById('irrf-max-reduction-limit')?.value || 0),
                    formulaFixed: Number(document.getElementById('irrf-formula-fixed')?.value || 0),
                    formulaFactor: Number(document.getElementById('irrf-formula-factor')?.value || 0),
                    zeroTaxCap: Number(document.getElementById('irrf-zero-tax-cap')?.value || 0)
                },
                irrfTraditionalBrackets: taxSettings.irrfTraditionalBrackets.map((_, index) => ({
                    limit: Number(document.querySelector(`[data-tax="irrf-limit"][data-index="${index}"]`)?.value || 0),
                    rate: Number(document.querySelector(`[data-tax="irrf-rate"][data-index="${index}"]`)?.value || 0),
                    deduction: Number(document.querySelector(`[data-tax="irrf-deduction"][data-index="${index}"]`)?.value || 0)
                }))
            };
            taxSettings = next;
            persistTaxSettings();
            showToast('Parâmetros fiscais atualizados!');
            if (currentTab === 'configuracoes') renderTaxSettingsPanel();
            renderCurrentTab();
        }

        const originalOpenSalaryHistoryModal = openSalaryHistoryModal;
        openSalaryHistoryModal = function (personId, personName) {
            ensureModalDetached('salary-history-modal');
            return originalOpenSalaryHistoryModal(personId, personName);
        };

        openHourControlModal = function () {
            ensureModalDetached('hour-control-modal');
            syncHourControlPersonOptions();
            document.getElementById('hour-control-title').textContent = 'Novo Lançamento de Horas';
            document.getElementById('hour-competence').value = document.getElementById('controle-horas-competencia')?.value || thisMonth;
            document.getElementById('hour-date').value = today;
            document.getElementById('hour-type').value = 'Hora Extra';
            document.getElementById('hour-start').value = '';
            document.getElementById('hour-end').value = '';
            document.getElementById('hour-quantity').value = '';
            document.getElementById('hour-bank-nature').value = 'Débito';
            document.getElementById('hour-percentage').value = '50';
            document.getElementById('hour-note').value = '';
            handleHourControlTypeChange();
            document.getElementById('hour-control-modal').classList.remove('hidden');
            lucide.createIcons();
        };

        openHourDetailModal = function (key) {
            const modal = ensureModalDetached('hour-detail-modal');
            const [person, competencia] = key.split('|');
            const records = allRecords
                .filter((record) => record.type === 'controle_horas' && record.person === person && normalizeCompetenceKey(record.competence) === normalizeCompetenceKey(competencia))
                .sort((a, b) => (b.occurred_date || '').localeCompare(a.occurred_date || ''));
            const saldo = calcularSaldoBanco(person, competencia);
            document.getElementById('hour-detail-title').textContent = `${person} • ${formatCompetence(competencia)}`;
            document.getElementById('hour-detail-subtitle').textContent = 'Detalhamento do período';
            document.getElementById('hour-detail-content').innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">${['Saldo anterior', 'Horas débito', 'Horas crédito', 'Saldo atual'].map((label, index) => { const values = [formatHoursDecimal(Math.abs(saldo.saldoAnterior)), formatHoursDecimal(saldo.horasDebito), formatHoursDecimal(saldo.horasCredito), `${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}`]; return `<div class="bank-metric-card"><p class="text-xs text-textSecondary">${label}</p><p class="text-lg font-semibold mt-2">${values[index]}</p></div>`; }).join('')}</div><div class="space-y-3 mt-4">${records.map((item) => `<div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><div class="flex items-center justify-between gap-3"><div><p class="text-sm font-semibold ${(item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra') ? 'text-accent' : 'text-warn'}">${item.hour_control_type || item.hour_entry_type}${item.bank_nature ? ` • ${item.bank_nature}` : ''}</p><p class="text-xs text-textSecondary mt-1">${item.occurred_date || '-'} • ${item.start_time || item.horaInicial || '--:--'} às ${item.end_time || item.horaFinal || '--:--'} • ${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}</p></div><div class="text-right"><p class="text-sm font-semibold ${(item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra') ? 'text-success' : 'text-warn'}">${(item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra') ? fmt(item.financial_total || item.valorTotalCalculado || 0) : `${String(item.bank_nature || '').toLowerCase().startsWith('d') ? '+' : '-'}${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}`}</p>${item.observation || item.description ? `<p class="text-xs text-textSecondary mt-1">${escapeHtml(item.observation || item.description)}</p>` : ''}</div></div></div>`).join('')}</div>`;
            modal?.classList.remove('hidden');
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
            detail.innerHTML = `<div class="money-metric-card mb-4"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Resumo principal</p><div class="entry-consolidated-grid mt-3"><div><p class="text-xs text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-2">${fmt(consolidated.liquido)}</p></div><div><p class="text-xs text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-2">${fmt(consolidated.salaryBase)}</p></div><div><p class="text-xs text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-2">${fmt(consolidated.hourExtra)}</p></div><div><p class="text-xs text-textSecondary">Base Total</p><p class="kpi-value text-textPrimary mt-2">${fmt(consolidated.baseTotal)}</p></div></div></div><div class="entry-detail-grid"><div class="money-metric-card"><h4 class="font-semibold text-sm">Bloco financeiro</h4><div class="space-y-2 text-sm mt-3"><div class="flex justify-between"><span>Salário Bruto</span><strong>${fmt(consolidated.salaryBase)}</strong></div><div class="flex justify-between"><span>Hora Extra</span><strong class="text-accent">${fmt(consolidated.hourExtra)}</strong></div><div class="flex justify-between"><span>Base Total</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>INSS</span><strong class="text-danger">-${fmt(consolidated.inss)}</strong></div><div class="flex justify-between"><span>Base do cálculo tradicional do IRRF</span><strong>${fmt(irrfDetail.baseTradicional)}</strong></div><div class="flex justify-between"><span>IRRF tradicional</span><strong class="text-danger">-${fmt(irrfDetail.irrfTradicional)}</strong></div><div class="flex justify-between"><span>Redução IRRF 2026</span><strong class="text-accent">${fmt(irrfDetail.reducao)}</strong></div><div class="flex justify-between"><span>IRRF final</span><strong class="text-danger">-${fmt(consolidated.irrf)}</strong></div><div class="flex justify-between"><span>Outros descontos</span><strong class="text-danger">-${fmt(consolidated.outrosDescontos)}</strong></div><div class="flex justify-between pt-2 border-t border-surfaceLight"><span>Líquido final</span><strong class="text-success">${fmt(consolidated.liquido)}</strong></div></div></div><div class="time-metric-card"><h4 class="font-semibold text-sm">Bloco Hora Extra</h4><div class="space-y-2 text-sm mt-3">${consolidated.hourEntries.length ? consolidated.hourEntries.map((item) => `<div class="rounded-lg border border-surfaceLight bg-surface/50 p-3"><div class="flex justify-between gap-3"><span>${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)} • ${((Number(item.overtime_percentage || item.percentualUsado || 0) > 1 ? Number(item.overtime_percentage || item.percentualUsado || 0) : Number(item.overtime_percentage || item.percentualUsado || 0) * 100)).toFixed(0)}%</span><strong class="text-success">${fmt(item.financial_total || item.valorTotalCalculado || 0)}</strong></div></div>`).join('') : '<p class="text-textSecondary">Nenhum lançamento de hora extra no mês.</p>'}</div></div><div class="bank-metric-card"><h4 class="font-semibold text-sm">Bloco Banco de Horas</h4><div class="grid grid-cols-2 gap-3 mt-3 text-sm"><div><p class="text-xs text-textSecondary">Saldo anterior</p><p class="text-lg font-semibold">${formatHoursDecimal(Math.abs(consolidated.banco.saldoAnterior))}</p></div><div><p class="text-xs text-textSecondary">Horas débito</p><p class="text-lg font-semibold text-accent">${formatHoursDecimal(consolidated.banco.horasDebito)}</p></div><div><p class="text-xs text-textSecondary">Horas crédito</p><p class="text-lg font-semibold text-danger">${formatHoursDecimal(consolidated.banco.horasCredito)}</p></div><div><p class="text-xs text-textSecondary">Saldo atual</p><p class="text-lg font-semibold text-warn">${consolidated.banco.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(consolidated.banco.saldoAtual))}</p></div></div></div><div class="money-metric-card"><h4 class="font-semibold text-sm">Bloco Descontos</h4><div class="space-y-2 text-sm mt-3">${consolidated.descontoRecords.length ? consolidated.descontoRecords.map((item) => `<div class="flex justify-between gap-3"><span>${escapeHtml(item.description || item.subcategory || item.earning_type || 'Desconto')}</span><strong class="text-danger">-${fmt(item.amount)}</strong></div>`).join('') : '<p class="text-textSecondary">Nenhum desconto detalhado no mês.</p>'}</div></div><div class="time-metric-card"><h4 class="font-semibold text-sm">Memória de cálculo</h4><div class="space-y-2 text-sm mt-3"><div class="flex justify-between"><span>Base Bruta</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>Hora Extra</span><strong>${fmt(consolidated.hourExtra)}</strong></div><div class="flex justify-between"><span>Base Total</span><strong>${fmt(consolidated.baseTotal)}</strong></div><div class="flex justify-between"><span>INSS</span><strong class="text-danger">-${fmt(inssDetail.total)}</strong></div>${inssDetail.breakdown.map((item) => `<div class="flex justify-between"><span>${item.faixa} (${(item.aliquota * 100).toFixed(1)}%)</span><strong>${fmt(item.valor)}</strong></div>`).join('')}<div class="flex justify-between"><span>Base do cálculo tradicional</span><strong>${fmt(irrfDetail.baseTradicional)}</strong></div><div class="flex justify-between"><span>IRRF tradicional</span><strong>${fmt(irrfDetail.irrfTradicional)}</strong></div><div class="flex justify-between"><span>Valor da Redução</span><strong>${fmt(irrfDetail.reducao)}</strong></div><div class="flex justify-between"><span>IRRF final</span><strong>${fmt(irrfDetail.irrfFinal)}</strong></div><div class="flex justify-between"><span>Outros descontos</span><strong>${fmt(consolidated.outrosDescontos)}</strong></div><div class="flex justify-between"><span>Salário líquido final</span><strong class="text-success">${fmt(consolidated.liquido)}</strong></div></div></div></div>`;
            document.getElementById('entry-detail-modal').classList.remove('hidden');
            lucide.createIcons();
        };

        renderControleHoras = function () {
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
                const totalHE = roundCurrency(items.filter((item) => (item.hour_entry_type || item.hour_control_type) === 'Hora Extra').reduce((sum, item) => sum + (Number(item.financial_total || item.valorTotalCalculado) || 0), 0));
                const saldoBanco = calcularSaldoBanco(person, competence);
                return { person, competence, totalHE, saldoBanco, items: sortRecordsNewestFirst(items) };
            }).sort((a, b) => `${b.competence}|${b.person}`.localeCompare(`${a.competence}|${a.person}`));
            list.innerHTML = groups.map((group) => `<div class="rounded-2xl border border-surfaceLight bg-surface p-4"><div class="flex items-start justify-between gap-3 flex-wrap"><div><h3 class="font-semibold text-sm">${escapeHtml(group.person)} • ${formatCompetence(group.competence)}</h3><p class="text-xs text-textSecondary mt-1">Total H.E.: ${fmt(group.totalHE)} • Saldo banco: ${group.saldoBanco.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(group.saldoBanco.saldoAtual))}</p></div><button type="button" data-open-hour-detail="${escapeHtml(group.person)}|${group.competence}" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Detalhar</button></div></div>`).join('');
            const people = [...new Set(allRecords.filter((record) => record.type === 'pessoa').map((record) => record.person))].sort((a, b) => a.localeCompare(b));
            const competence = filter?.value || thisMonth;
            saldosWrap.innerHTML = people.map((person) => { const saldo = calcularSaldoBanco(person, competence); return `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${escapeHtml(person)}</p><p class="kpi-value text-warn mt-2">${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}</p><div class="grid grid-cols-2 gap-2 mt-3 text-xs"><div><span class="text-textSecondary">Anterior</span><p class="font-semibold">${formatHoursDecimal(Math.abs(saldo.saldoAnterior))}</p></div><div><span class="text-textSecondary">Débito</span><p class="font-semibold text-accent">${formatHoursDecimal(saldo.horasDebito)}</p></div><div><span class="text-textSecondary">Crédito</span><p class="font-semibold text-danger">${formatHoursDecimal(saldo.horasCredito)}</p></div><div><span class="text-textSecondary">Atual</span><p class="font-semibold text-warn">${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}</p></div></div></div>`; }).join('') || '<p class="text-sm text-textSecondary text-center py-6">Nenhuma pessoa cadastrada.</p>';
            empty.classList.toggle('hidden', groups.length > 0);
            meta.textContent = `${records.length} lançamento(s) • competência ${formatCompetence(competence)}`;
            lucide.createIcons();
        };

        renderEntradas = function () {
            const entries = getEntradasConsolidadas();
            const list = document.getElementById('entradas-list');
            const empty = document.getElementById('entradas-empty');
            const meta = document.getElementById('entradas-meta');
            const pagination = document.getElementById('entradas-pagination');
            if (!list || !empty || !meta) return;
            list.innerHTML = entries.map((entry) => `<div class="glass rounded-2xl p-4 border border-surfaceLight"><div class="flex items-start justify-between gap-3 flex-wrap mb-4"><div><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Competência</p><h3 class="text-lg font-semibold mt-1">${formatCompetence(entry.competencia)} • ${escapeHtml(entry.person)}</h3></div><button type="button" data-open-entry-detail-person="${escapeHtml(entry.person)}" data-open-entry-detail-competence="${entry.competencia}" class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors">Visualizar</button></div><div class="entry-consolidated-grid"><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Salário Base</p><p class="kpi-value text-textPrimary mt-3">${fmt(entry.salaryBase)}</p></div><div class="time-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Hora Extra</p><p class="kpi-value text-accent mt-3">${fmt(entry.hourExtra)}</p></div><div class="money-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Líquido Final</p><p class="kpi-value text-success mt-3">${fmt(entry.liquido)}</p></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-textSecondary"><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">Descontos: <strong class="text-danger">-${fmt(entry.outrosDescontos)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">INSS: <strong class="text-danger">-${fmt(entry.inss)}</strong></div><div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">IRRF: <strong class="text-danger">-${fmt(entry.irrf)}</strong></div></div></div>`).join('');
            meta.textContent = `${entries.length} competência(s) consolidadas${listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : ''}`;
            empty.classList.toggle('hidden', entries.length > 0);
            if (pagination) pagination.classList.add('hidden');
            lucide.createIcons();
        };

        const originalRenderConfiguracoesWithTax = renderConfiguracoes;
        renderConfiguracoes = function () {
            originalRenderConfiguracoesWithTax();
            renderTaxSettingsPanel();
        };
