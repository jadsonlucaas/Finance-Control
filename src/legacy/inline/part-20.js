const CUSTOM_HOLIDAYS_STORAGE_KEY = 'finance-control-custom-holidays-v1';

        function getFixedBrazilHolidayDates(year) {
            const y = Number(year) || new Date().getFullYear();
            return [
                `${y}-01-01`,
                `${y}-04-21`,
                `${y}-05-01`,
                `${y}-09-07`,
                `${y}-10-12`,
                `${y}-11-02`,
                `${y}-11-15`,
                `${y}-11-20`,
                `${y}-12-25`
            ];
        }

        function getCustomHolidayDates() {
            const scopedDates = window.financeApp?.plannerStorage?.listOwnerHolidayDates?.();
            if (Array.isArray(scopedDates)) return scopedDates;
            try {
                const raw = localStorage.getItem(CUSTOM_HOLIDAYS_STORAGE_KEY) || '';
                return raw
                    .split(/[\n,;]+/)
                    .map((item) => item.trim())
                    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
            } catch (error) {
                return [];
            }
        }

        function isSaturdayOrHoliday(dateValue = '') {
            if (!dateValue) return false;
            const parts = String(dateValue).split('-').map(Number);
            if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return false;
            const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
            const isSaturday = localDate.getDay() === 6;
            const holidays = new Set([...getFixedBrazilHolidayDates(parts[0]), ...getCustomHolidayDates()]);
            return isSaturday || holidays.has(dateValue);
        }

        function calculateHourWorkSummary({ date = '', startTime = '', endTime = '', breakStart = '', breakEnd = '' } = {}) {
            const calc = calcularHoras(startTime, endTime, {
                allowCrossMidnight: true,
                breakStartTime: breakStart,
                breakEndTime: breakEnd
            });
            if (!calc || Number(calc.minutos || 0) <= 0) {
                return {
                    grossMinutes: 0,
                    breakMinutes: 0,
                    autoLunchMinutes: 0,
                    netMinutes: 0,
                    quantity: 0,
                    grossFormatted: '00:00',
                    breakFormatted: '00:00',
                    autoLunchFormatted: '00:00',
                    quantityFormatted: '00:00',
                    autoLunchApplied: false,
                    crossesMidnight: false,
                    endedDate: date || '',
                    errors: calc?.errors || []
                };
            }

            const autoLunchApplied = false;
            const autoLunchMinutes = 0;
            const grossMinutes = Number(calc.grossMinutes || calc.minutos || 0);
            const breakMinutes = Number(calc.breakMinutes || 0);
            const netMinutes = Number(calc.minutos || 0);
            const quantity = roundCurrency(netMinutes / 60);

            return {
                grossMinutes,
                breakMinutes,
                autoLunchMinutes,
                netMinutes,
                quantity,
                grossFormatted: formatHoursDecimal(grossMinutes / 60),
                breakFormatted: formatHoursDecimal(breakMinutes / 60),
                autoLunchFormatted: formatHoursDecimal(autoLunchMinutes / 60),
                quantityFormatted: formatHoursDecimal(quantity),
                autoLunchApplied,
                crossesMidnight: Boolean(calc.crossesMidnight),
                endedDate: calc.crossesMidnight && /^\d{4}-\d{2}-\d{2}$/.test(date)
                    ? new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString().slice(0, 10)
                    : date || '',
                errors: []
            };
        }

        let editingHourControlRecordId = '';
        let editingHourControlDetailKey = '';
        let isSavingHourControlRecord = false;

        function getHourControlRecordKind(record = {}) {
            return record.hour_entry_type || record.hour_control_type || 'Hora Extra';
        }

        function calculateHourControlOvertime({ person = '', competence = '', quantityHours = 0, percentage = 0, salaryBase = 0 } = {}) {
            const calc = calcularHoraExtra({ salaryBase, quantityHours, percentage });
            return {
                person,
                competencia: competence,
                salarioBase: Number(salaryBase) || 0,
                valorHoraNormal: calc.valorHoraNormal,
                percentualAplicado: calc.percentualAplicado,
                adicional: calc.adicional,
                valorHoraExtra: calc.valorHoraExtra,
                total: calc.totalHoraExtra,
                totalHoraExtra: calc.totalHoraExtra,
                baseHourlyRateCents: calc.baseHourlyRateCents,
                calculatedValueCents: calc.calculatedValueCents,
                netMinutes: calc.netMinutes
            };
        }

        function getHourControlSalaryBase(person = '', competence = '', record = null) {
            const recordBase = Number(record?.salary_base_snapshot ?? record?.salary_base_reference ?? record?.valorBaseHoraBase ?? 0) || 0;
            if (recordBase > 0) return recordBase;
            const salaryInfo = getSalarioVigente(person, competence) || {};
            return Number(salaryInfo.salario ?? salaryInfo.salary_base ?? salaryInfo.amount ?? salaryInfo.salarioBase ?? 0) || 0;
        }

        function getHourControlRecordFinancialTotal(record = {}) {
            const storedTotal = Number(record.financial_total ?? record.valorTotalCalculado ?? record.amount ?? 0) || 0;
            if (storedTotal > 0) return roundCurrency(storedTotal);
            if (getHourControlRecordKind(record) !== 'Hora Extra') return 0;

            const quantityHours = Number(record.hours_quantity ?? record.quantidadeHoras ?? 0) || 0;
            const salaryBase = getHourControlSalaryBase(record.person || '', record.competence || '', record);
            const percentage = Number(record.overtime_percentage ?? record.percentualUsado ?? 0) || 0;
            if (quantityHours <= 0 || salaryBase <= 0 || percentage <= 0) return 0;

            const summary = {
                quantity: quantityHours,
                netMinutes: Number(record.net_minutes || Math.round(quantityHours * 60)) || 0,
                quantityFormatted: record.hours_formatted || record.quantidadeHorasFormatada || formatHoursDecimal(quantityHours)
            };
            const preview = getHourControlOvertimePreview({
                person: record.person || '',
                competence: record.competence || '',
                date: record.occurred_date || '',
                summary,
                salaryBase,
                percentage
            });
            return roundCurrency(preview.total || 0);
        }

        function findGeneratedHourEntry(record = {}) {
            if (!record?.id) return null;
            if (record.generated_entry_id) {
                const linked = allRecords.find((item) => item?.id === record.generated_entry_id && item.type === 'entrada');
                if (linked) return linked;
            }
            return allRecords.find((item) =>
                item?.type === 'entrada' &&
                item.generated_from_hour_control === true &&
                (
                    item.source_hour_control_id === record.id ||
                    (
                        item.person === record.person &&
                        normalizeCompetenceKey(item.competence) === normalizeCompetenceKey(record.competence) &&
                        item.occurred_date === record.occurred_date &&
                        String(item.earning_type || item.subcategory || '').toLowerCase().includes('hora extra') &&
                        Math.abs((Number(item.amount) || 0) - (Number(record.financial_total || record.valorTotalCalculado) || 0)) < 0.01
                    )
                )
            ) || null;
        }

        function buildHourGeneratedEntryPayload(hourPayload = {}, existingEntry = null) {
            return {
                ...(existingEntry || {}),
                type: 'entrada',
                person: hourPayload.person,
                macro_category: 'Rendimento',
                subcategory: 'Hora Extra',
                description: hourPayload.observation || hourPayload.description || `Hora Extra • ${hourPayload.hours_formatted || hourPayload.quantidadeHorasFormatada || ''}`,
                amount: roundCurrency(getHourControlRecordFinancialTotal(hourPayload) || hourPayload.financial_total || hourPayload.valorTotalCalculado || 0),
                status: 'Pago',
                payment_method: '',
                occurred_date: hourPayload.occurred_date,
                due_date: hourPayload.occurred_date,
                competence: hourPayload.competence,
                paid_at: hourPayload.occurred_date,
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                earning_type: 'Hora Extra',
                cycle: '',
                recurrence: '',
                created_at: existingEntry?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                category_id: '',
                category_name: '',
                category_color: '',
                category_icon: '',
                generated_from_hour_control: true,
                source_hour_control_id: hourPayload.id || '',
                ...getHourExtraRecordDefaults()
            };
        }

        function getHourControlOvertimePreview({ person = '', competence = '', date = '', summary = null, salaryBase = 0, percentage = 0 } = {}) {
            const workSummary = summary || calculateHourWorkSummary({ date });
            const quantityHours = Number(workSummary.quantity || 0);
            const netMinutes = Number(workSummary.netMinutes || Math.round(quantityHours * 60) || 0);
            const normalHourValue = salaryBase > 0 ? roundCurrency(salaryBase / 220) : 0;
            const isSpecialDay = isSaturdayOrHoliday(date);
            const usesProgressiveSplit = isSpecialDay && netMinutes > 0;
            const segments = [];

            if (usesProgressiveSplit) {
                const firstMinutes = Math.min(netMinutes, 8 * 60);
                const extraMinutes = Math.max(0, netMinutes - firstMinutes);
                const segmentConfigs = [
                    { minutes: firstMinutes, percentage: 110, label: 'Ate 8h a 110%' },
                    { minutes: extraMinutes, percentage: 150, label: 'Excedente a 150%' }
                ];

                segmentConfigs.forEach((segment) => {
                    if (segment.minutes <= 0) return;
                    const quantity = roundCurrency(segment.minutes / 60);
                    const calc = calculateHourControlOvertime({
                        person,
                        competence,
                        salaryBase,
                        quantityHours: quantity,
                        percentage: segment.percentage
                    });
                    segments.push({
                        label: segment.label,
                        percentage: segment.percentage,
                        minutes: segment.minutes,
                        quantity,
                        hoursFormatted: formatHoursDecimal(quantity),
                        hourValue: calc.valorHoraExtra,
                        total: calc.totalHoraExtra || calc.total || 0
                    });
                });
            } else {
                const calc = calculateHourControlOvertime({
                    person,
                    competence,
                    salaryBase,
                    quantityHours,
                    percentage
                });
                segments.push({
                    label: `${Number(percentage || 0)}%`,
                    percentage: Number(percentage || 0),
                    minutes: netMinutes,
                    quantity: quantityHours,
                    hoursFormatted: workSummary.quantityFormatted || formatHoursDecimal(quantityHours),
                    hourValue: calc.valorHoraExtra,
                    total: calc.totalHoraExtra || calc.total || 0
                });
            }

            const total = roundCurrency(segments.reduce((sum, segment) => sum + Number(segment.total || 0), 0));
            const effectiveHourValue = quantityHours > 0 ? roundCurrency(total / quantityHours) : 0;

            return {
                person,
                competence,
                date,
                quantityHours,
                netMinutes,
                normalHourValue,
                isSpecialDay,
                usesProgressiveSplit,
                dayLabel: usesProgressiveSplit ? 'sabado/feriado' : 'dia comum',
                segments,
                total,
                effectiveHourValue
            };
        }

        function renderHourControlOvertimeBreakdown(previewData = {}) {
            const segmentCards = (previewData.segments || []).map((segment) => `
                <div class="rounded-xl border border-surfaceLight bg-surface p-3">
                    <p class="text-xs text-textSecondary">${segment.label}</p>
                    <p class="text-base font-semibold text-accent mt-2">${segment.hoursFormatted}</p>
                    <p class="text-xs text-textSecondary mt-1">${segment.percentage}% • ${fmt(segment.total)}</p>
                </div>
            `).join('');

            if (!segmentCards) return '';

            return `
                <div class="md:col-span-3">
                    <p class="text-xs text-textSecondary mb-2">Quebra por multiplicador</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        ${segmentCards}
                    </div>
                </div>
            `;
        }

        async function syncGeneratedHourEntry(previousRecord = null, hourPayload = {}, resultId = '') {
            const payload = { ...hourPayload, id: hourPayload.id || resultId };
            const type = getHourControlRecordKind(payload);
            const existingEntry = findGeneratedHourEntry(previousRecord || payload);

            if (type !== 'Hora Extra') {
                if (existingEntry) {
                    const deleteResult = await window.dataSdk.delete(existingEntry);
                    if (!deleteResult?.isOk) showToast('Banco de horas salvo, mas a entrada automática anterior não pôde ser removida', true);
                }
                return null;
            }

            const entryPayload = buildHourGeneratedEntryPayload(payload, existingEntry);
            if (existingEntry?.id) {
                const updateResult = await window.dataSdk.update({ ...entryPayload, id: existingEntry.id });
                if (!updateResult?.isOk) showToast('Hora salva, mas houve erro ao atualizar a entrada automática', true);
                return existingEntry.id;
            }

            const createResult = await window.dataSdk.create(entryPayload);
            if (!createResult?.isOk) {
                showToast('Hora salva, mas houve erro ao gerar a entrada automática', true);
                return null;
            }
            return createResult.id || null;
        }

        function setHourControlFormMode(record = null) {
            const isEditing = Boolean(record?.id);
            editingHourControlRecordId = isEditing ? record.id : '';
            editingHourControlDetailKey = isEditing ? `${record.person || ''}|${normalizeCompetenceKey(record.competence || '')}` : '';
            const title = document.getElementById('hour-control-title');
            const saveButton = document.getElementById('btn-save-hour-control');
            if (title) title.textContent = isEditing ? 'Editar Lançamento de Horas' : 'Novo Lançamento de Horas';
            if (saveButton) saveButton.textContent = isEditing ? 'Salvar alterações' : 'Salvar';
        }

        const _openHourControlModalWithInterval = openHourControlModal;
        openHourControlModal = function () {
            _openHourControlModalWithInterval();
            setHourControlFormMode(null);
            const breakStart = document.getElementById('hour-break-start');
            const breakEnd = document.getElementById('hour-break-end');
            if (breakStart) breakStart.value = '';
            if (breakEnd) breakEnd.value = '';
            updateHourControlCalculatedFields();
        };

        const _closeHourControlModalWithEditReset = closeHourControlModal;
        closeHourControlModal = function () {
            editingHourControlRecordId = '';
            editingHourControlDetailKey = '';
            setHourControlFormMode(null);
            _closeHourControlModalWithEditReset();
        };

        openEditHourControlRecord = function (recordId, groupKey = '') {
            const record = allRecords.find((item) => item?.id === recordId && item.type === 'controle_horas');
            if (!record) {
                showToast('Lançamento não encontrado para edição', true);
                return;
            }

            const modal = typeof ensureModalDetached === 'function'
                ? ensureModalDetached('hour-control-modal')
                : document.getElementById('hour-control-modal');
            if (!modal) {
                showToast('Modal de edição de horas não disponível', true);
                return;
            }

            const people = getPeopleRecords();
            const personSelect = document.getElementById('hour-person');
            if (personSelect) {
                personSelect.innerHTML = people.map((person) => `<option value="${escapeHtml(person.person)}">${escapeHtml(person.person)}</option>`).join('');
            }

            setHourControlFormMode(record);
            editingHourControlDetailKey = groupKey || `${record.person || ''}|${normalizeCompetenceKey(record.competence || '')}`;

            document.getElementById('hour-person').value = record.person || '';
            document.getElementById('hour-competence').value = normalizeCompetenceKey(record.competence || '') || thisMonth;
            document.getElementById('hour-date').value = record.occurred_date || '';
            document.getElementById('hour-start').value = record.start_time || record.horaInicial || '';
            document.getElementById('hour-end').value = record.end_time || record.horaFinal || '';
            document.getElementById('hour-break-start').value = record.break_start || '';
            document.getElementById('hour-break-end').value = record.break_end || '';
            document.getElementById('hour-type').value = getHourControlRecordKind(record);
            document.getElementById('hour-bank-nature').value = record.bank_nature || 'Débito';
            document.getElementById('hour-percentage').value = Number(record.overtime_percentage ?? record.percentualUsado ?? 110) || 0;
            document.getElementById('hour-note').value = record.observation || record.description || '';
            handleHourControlTypeChange();
            document.getElementById('hour-detail-modal')?.classList.add('hidden');
            modal.classList.remove('hidden');
            lucide.createIcons();
        };

        updateHourControlCalculatedFields = function () {
            const person = document.getElementById('hour-person')?.value || '';
            const competence = document.getElementById('hour-competence')?.value || thisMonth;
            const type = document.getElementById('hour-type')?.value || 'Hora Extra';
            const occurredDate = document.getElementById('hour-date')?.value || '';
            const summary = calculateHourWorkSummary({
                date: occurredDate,
                startTime: document.getElementById('hour-start')?.value || '',
                endTime: document.getElementById('hour-end')?.value || '',
                breakStart: document.getElementById('hour-break-start')?.value || '',
                breakEnd: document.getElementById('hour-break-end')?.value || ''
            });
            const salary = getHourControlSalaryBase(person, competence);
            document.getElementById('hour-quantity').value = summary.quantity ? summary.quantity.toFixed(2) : '';
            document.getElementById('hour-salary-base').value = salary ? salary.toFixed(2) : '';
            const preview = document.getElementById('hour-calculation-preview');
            if (!preview) return;

            const deductionRows = `
                <div><p class="text-xs text-textSecondary">Horas brutas</p><p class="text-lg font-semibold text-textPrimary">${summary.grossFormatted}</p></div>
                <div><p class="text-xs text-textSecondary">Intervalo</p><p class="text-lg font-semibold text-warn">-${summary.breakFormatted}</p></div>
                <div><p class="text-xs text-textSecondary">Horas líquidas</p><p class="text-lg font-semibold text-accent">${summary.quantityFormatted}</p></div>
            `;

            if (type === 'Banco de Horas') {
                const natureza = document.getElementById('hour-bank-nature')?.value || 'Débito';
                preview.innerHTML = `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Banco de Horas</p><div class="entry-consolidated-grid mt-3">${deductionRows}</div><p class="text-xs text-textSecondary mt-3">${natureza} ${natureza === 'Débito' ? 'soma' : 'reduz'} no saldo e não gera valor financeiro.</p></div>`;
                return;
            }

            const calc = calculateHourControlOvertime({
                person,
                competence,
                quantityHours: summary.quantity,
                percentage: Number(document.getElementById('hour-percentage')?.value || 0),
                salaryBase: salary
            });
            const overtimePreview = getHourControlOvertimePreview({
                person,
                competence,
                date: occurredDate,
                summary,
                salaryBase: salary,
                percentage: Number(document.getElementById('hour-percentage')?.value || 0)
            });

            preview.innerHTML = `<div class="time-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Memória de cálculo da H.E.</p><div class="entry-consolidated-grid mt-3">${deductionRows}<div><p class="text-xs text-textSecondary">Valor hora normal</p><p class="text-lg font-semibold text-textPrimary">${fmt(calc.valorHoraNormal)}</p></div><div><p class="text-xs text-textSecondary">Valor hora extra</p><p class="text-lg font-semibold text-success">${fmt(overtimePreview.effectiveHourValue || calc.valorHoraExtra)}</p></div><div><p class="text-xs text-textSecondary">Total</p><p class="text-lg font-semibold text-success">${fmt(overtimePreview.total || calc.totalHoraExtra || 0)}</p></div>${renderHourControlOvertimeBreakdown(overtimePreview)}</div><p class="text-xs text-textSecondary mt-3">${overtimePreview.usesProgressiveSplit ? 'Sábado/feriado: primeiras 8h a 110% e excedente a 150%.' : 'Se houver pausa, informe o período de intervalo para descontar das horas líquidas.'}</p></div>`;
        };

        saveHourControlRecord = async function () {
            if (isSavingHourControlRecord) return;
            const editingRecord = editingHourControlRecordId
                ? allRecords.find((item) => item?.id === editingHourControlRecordId && item.type === 'controle_horas')
                : null;
            const person = document.getElementById('hour-person').value || '';
            const competence = document.getElementById('hour-competence').value || '';
            const occurredDate = document.getElementById('hour-date').value || '';
            const type = document.getElementById('hour-type').value || 'Hora Extra';
            const startTime = document.getElementById('hour-start').value || '';
            const endTime = document.getElementById('hour-end').value || '';
            const breakStart = document.getElementById('hour-break-start')?.value || '';
            const breakEnd = document.getElementById('hour-break-end')?.value || '';
            const summary = calculateHourWorkSummary({ date: occurredDate, startTime, endTime, breakStart, breakEnd });
            const note = document.getElementById('hour-note').value || '';
            if (!person || !competence || !occurredDate) { showToast('Preencha pessoa, competência e data', true); return; }
            if (!summary.quantity || summary.quantity <= 0) { showToast('Informe um intervalo de horas válido', true); return; }

            const salaryBase = getHourControlSalaryBase(person, competence, editingRecord);
            if (type === 'Hora Extra' && salaryBase <= 0) {
                showToast('Cadastre um salário vigente para calcular a hora extra', true);
                return;
            }

            isSavingHourControlRecord = true;
            const saveButton = document.getElementById('btn-save-hour-control');
            if (saveButton) saveButton.disabled = true;

            try {
            const payload = {
                ...(editingRecord || {}),
                type: 'controle_horas',
                person,
                competence,
                occurred_date: occurredDate,
                start_time: startTime,
                end_time: endTime,
                horaInicial: startTime,
                horaFinal: endTime,
                crosses_midnight: Boolean(summary.crossesMidnight),
                ended_date: summary.endedDate || '',
                break_start: breakStart,
                break_end: breakEnd,
                break_start_time: breakStart,
                break_end_time: breakEnd,
                gross_minutes: summary.grossMinutes,
                break_minutes: summary.breakMinutes,
                net_minutes: summary.netMinutes,
                auto_lunch_minutes: summary.autoLunchMinutes,
                lunch_discount_reason: summary.autoLunchApplied ? 'sábado/feriado' : '',
                hours_quantity: summary.quantity,
                hours_formatted: summary.quantityFormatted,
                quantidadeHoras: summary.quantity,
                quantidadeHorasFormatada: summary.quantityFormatted,
                gross_hours_formatted: summary.grossFormatted,
                hour_entry_type: type,
                hour_control_type: type,
                observation: note,
                description: note,
                salary_base_snapshot: salaryBase,
                salary_base_reference: salaryBase,
                monthly_hours_reference: 220,
                calculation_version: 1,
                created_at: editingRecord?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                id: editingRecord?.id
            };

            if (type === 'Hora Extra') {
                const percentual = Number(document.getElementById('hour-percentage').value || 0);
                const calc = calculateHourControlOvertime({ person, competence, quantityHours: summary.quantity, percentage: percentual, salaryBase });
                const overtimePreview = getHourControlOvertimePreview({
                    person,
                    competence,
                    date: occurredDate,
                    summary,
                    salaryBase,
                    percentage: percentual
                });
                Object.assign(payload, {
                    overtime_percentage: percentual,
                    percentualUsado: percentual,
                    bank_nature: '',
                    financial_hour_value: overtimePreview.effectiveHourValue || calc.valorHoraExtra,
                    financial_total: overtimePreview.total || calc.totalHoraExtra || calc.total,
                    hour_value_base: calc.valorHoraNormal,
                    base_hourly_rate_cents: calc.baseHourlyRateCents || Math.round((calc.valorHoraNormal || 0) * 100),
                    calculated_value_cents: Math.round((overtimePreview.total || calc.totalHoraExtra || calc.total || 0) * 100),
                    valorBaseHora: calc.valorHoraNormal,
                    valorHoraCalculado: overtimePreview.effectiveHourValue || calc.valorHoraExtra,
                    valorTotalCalculado: overtimePreview.total || calc.totalHoraExtra || calc.total,
                    amount: overtimePreview.total || calc.totalHoraExtra || calc.total,
                    overtime_split_mode: overtimePreview.usesProgressiveSplit ? 'special-day-progressive' : 'single-rate',
                    overtime_is_special_day: overtimePreview.isSpecialDay,
                    overtime_breakdown: overtimePreview.segments,
                    overtime_day_label: overtimePreview.dayLabel
                });
            } else {
                const bankNature = document.getElementById('hour-bank-nature').value || 'Débito';
                const bankCalc = calcularBancoHoras({ quantityHours: summary.quantity, natureza: bankNature });
                Object.assign(payload, {
                    bank_nature: bankNature,
                    bank_minutes: bankCalc.minutes || 0,
                    overtime_percentage: 0,
                    percentualUsado: 0,
                    financial_hour_value: 0,
                    financial_total: 0,
                    hour_value_base: 0,
                    base_hourly_rate_cents: 0,
                    calculated_value_cents: 0,
                    valorBaseHora: 0,
                    valorHoraCalculado: 0,
                    valorTotalCalculado: 0,
                    amount: 0,
                    overtime_split_mode: '',
                    overtime_is_special_day: false,
                    overtime_breakdown: [],
                    overtime_day_label: ''
                });
            }

            const result = editingRecord
                ? await window.dataSdk.update(payload)
                : await window.dataSdk.create(payload);
            if (!result?.isOk) { showToast(`Erro ao ${editingRecord ? 'atualizar' : 'salvar'} lançamento de horas${result?.error ? `: ${result.error}` : ''}`, true); return; }

            const shouldReopenDetail = Boolean(editingRecord && editingHourControlDetailKey);
            const savedId = editingRecord?.id || result.id || '';
            await syncGeneratedHourEntry(editingRecord, { ...payload, id: savedId }, savedId);

            showToast(editingRecord ? 'Lançamento de horas atualizado!' : 'Lançamento de horas salvo!');
            const keyToRefresh = shouldReopenDetail ? editingHourControlDetailKey : '';
            editingHourControlRecordId = '';
            editingHourControlDetailKey = '';
            setHourControlFormMode(null);
            closeHourControlModal();
            renderControleHoras();
            renderEntradas();
            if (document.getElementById('planner-modal')) renderPlannerModal();
            if (keyToRefresh) openHourDetailModal(keyToRefresh);
            } finally {
                isSavingHourControlRecord = false;
                if (saveButton) saveButton.disabled = false;
            }
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
            document.getElementById('hour-detail-content').innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    ${['Saldo anterior', 'Horas débito', 'Horas crédito', 'Saldo atual'].map((label, index) => {
                        const values = [
                            formatHoursDecimal(Math.abs(saldo.saldoAnterior)),
                            formatHoursDecimal(saldo.horasDebito),
                            formatHoursDecimal(saldo.horasCredito),
                            `${saldo.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(saldo.saldoAtual))}`
                        ];
                        return `<div class="bank-metric-card"><p class="text-xs text-textSecondary">${label}</p><p class="text-lg font-semibold mt-2">${values[index]}</p></div>`;
                    }).join('')}
                </div>
                <div class="space-y-3 mt-4">
                    ${records.map((item) => {
                        const isHoraExtra = (item.hour_entry_type === 'Hora Extra' || item.hour_control_type === 'Hora Extra');
                        const valueLabel = isHoraExtra
                            ? fmt(getHourControlRecordFinancialTotal(item))
                            : `${String(item.bank_nature || '').toLowerCase().startsWith('d') ? '+' : '-'}${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}`;
                        const intervalLabel = item.break_start && item.break_end ? ` • intervalo ${item.break_start} às ${item.break_end}` : '';
                        const lunchLabel = Number(item.auto_lunch_minutes || 0) > 0 ? ` • almoço auto ${formatHoursDecimal((Number(item.auto_lunch_minutes || 0) / 60))}` : '';
                        const grossLabel = item.gross_hours_formatted ? ` • bruto ${item.gross_hours_formatted}` : '';
                        const overtimeBreakdown = Array.isArray(item.overtime_breakdown) && item.overtime_breakdown.length
                            ? `<div class="mt-2 space-y-1">${item.overtime_breakdown.map((segment) => `<div class="text-[11px] text-textSecondary flex justify-between gap-3"><span>${escapeHtml(segment.label || `${segment.percentage || 0}%`)}</span><span>${escapeHtml(segment.hoursFormatted || formatHoursDecimal(segment.quantity || 0))} • ${fmt(segment.total || 0)}</span></div>`).join('')}</div>`
                            : '';
                        return `<div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold ${isHoraExtra ? 'text-accent' : 'text-warn'}">${item.hour_control_type || item.hour_entry_type}${item.bank_nature ? ` • ${item.bank_nature}` : ''}</p><p class="text-xs text-textSecondary mt-1">${item.occurred_date || '-'} • ${item.start_time || item.horaInicial || '--:--'} às ${item.end_time || item.horaFinal || '--:--'}${grossLabel}${intervalLabel}${lunchLabel} • líquido ${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}</p>${overtimeBreakdown}${item.observation || item.description ? `<p class="text-xs text-textSecondary mt-1">${escapeHtml(item.observation || item.description)}</p>` : ''}</div><div class="flex items-start gap-3"><div class="text-right"><p class="text-sm font-semibold ${isHoraExtra ? 'text-success' : 'text-warn'}">${valueLabel}</p></div><button type="button" data-edit-hour-control-record="${item.id}" data-edit-hour-control-key="${key}" class="p-2 rounded-lg border border-surfaceLight text-textSecondary hover:text-accent hover:border-accent/40 transition-colors" title="Editar lançamento"><i data-lucide="pencil" class="w-4 h-4"></i></button><button type="button" data-delete-hour-control-record="${item.id}" data-delete-hour-control-key="${key}" class="p-2 rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/40 transition-colors" title="Excluir lançamento"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></div>`;
                    }).join('')}
                </div>
            `;
            modal?.classList.remove('hidden');
            lucide.createIcons();
        };
