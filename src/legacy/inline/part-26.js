const PLANNER_EVENTS_STORAGE_KEY = 'finance-control-planner-events-v1';

        function loadPlannerEvents() {
            try {
                const scopedEvents = window.financeApp?.plannerStorage?.listOwnerEvents?.();
                if (Array.isArray(scopedEvents)) return scopedEvents;
            } catch (error) {}
            try {
                const parsed = JSON.parse(localStorage.getItem(PLANNER_EVENTS_STORAGE_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        function savePlannerEvents(events = []) {
            const ownerUid = window.financeApp?.plannerStorage?.ownerProvider?.();
            const localEventStore = window.financeApp?.plannerStorage?.localEventStore;
            if (ownerUid && localEventStore?.replaceAll) {
                localEventStore.replaceAll(events, { ownerUid });
                return;
            }
            localStorage.setItem(PLANNER_EVENTS_STORAGE_KEY, JSON.stringify(events));
            const holidayDates = [...new Set(events
                .filter((event) => event.type === 'holiday' && /^\d{4}-\d{2}-\d{2}$/.test(event.date || ''))
                .map((event) => event.date)
            )].sort();
            localStorage.setItem('finance-control-custom-holidays-v1', holidayDates.join('\n'));
        }

        function getPlannerMonth() {
            return document.getElementById('planner-month')?.value || document.getElementById('f-comp-start')?.value || thisMonth;
        }

        function getPlannerSelectedDate() {
            return document.getElementById('planner-date')?.dataset?.selectedPlannerDate || '';
        }

        function getPlannerEventVisual(event = {}) {
            if (event.type === 'holiday') {
                return {
                    chipClass: 'bg-warn/15 text-warn',
                    titleClass: 'text-warn',
                    shortLabel: 'F',
                    kindLabel: 'Feriado',
                    dotClass: 'bg-warn'
                };
            }
            if (event.planner_kind === 'hour_extra') {
                return {
                    chipClass: 'bg-success/15 text-success',
                    titleClass: 'text-success',
                    shortLabel: 'HE',
                    kindLabel: 'Hora extra',
                    dotClass: 'bg-success'
                };
            }
            if (event.planner_kind === 'bank_hours') {
                return {
                    chipClass: 'bg-sky-500/15 text-sky-600',
                    titleClass: 'text-sky-600',
                    shortLabel: 'BH',
                    kindLabel: 'Banco de horas',
                    dotClass: 'bg-sky-500'
                };
            }
            return {
                chipClass: 'bg-accent/15 text-accent',
                titleClass: 'text-accent',
                shortLabel: 'C',
                kindLabel: 'Compromisso',
                dotClass: 'bg-accent'
            };
        }

        function formatPlannerDateLabel(date = '') {
            const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return date || '';
            return `${match[3]}/${match[2]}/${match[1]}`;
        }

        function getPlannerTodayIso() {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        function getPlannerDerivedHourEvents(month = getPlannerMonth()) {
            if (!Array.isArray(allRecords)) return [];

            return allRecords
                .filter((record) =>
                    record &&
                    record.type === 'controle_horas' &&
                    record.archived !== true &&
                    String(record.occurred_date || '').startsWith(`${month}-`)
                )
                .map((record) => {
                    const isHourExtra = record.hour_entry_type === 'Hora Extra' || record.hour_control_type === 'Hora Extra';
                    const hoursFormatted = record.hours_formatted || record.quantidadeHorasFormatada || formatHoursDecimal(record.hours_quantity || record.quantidadeHoras || 0);
                    const financialTotal = Number(record.financial_total || record.valorTotalCalculado || 0);
                    const isDebit = String(record.bank_nature || '').toLowerCase().startsWith('d');
                    const breakdown = Array.isArray(record.overtime_breakdown) ? record.overtime_breakdown : [];

                    return {
                        id: `planner-hour-${record.id || `${record.person || ''}-${record.occurred_date || ''}`}`,
                        date: record.occurred_date || '',
                        type: 'commitment',
                        planner_kind: isHourExtra ? 'hour_extra' : 'bank_hours',
                        title: isHourExtra
                            ? `Hora Extra - ${hoursFormatted}`
                            : `Banco de Horas - ${isDebit ? 'Debito' : 'Credito'}`,
                        note: isHourExtra
                            ? `${hoursFormatted} - ${fmt(financialTotal)}`
                            : `${isDebit ? 'Debito' : 'Credito'} - ${hoursFormatted}`,
                        hours_formatted: hoursFormatted,
                        financial_total: financialTotal,
                        bank_nature: record.bank_nature || '',
                        overtime_breakdown: breakdown,
                        person: record.person || '',
                        derived: true,
                        source_record_id: record.id || '',
                        created_at: record.updated_at || record.created_at || ''
                    };
                });
        }

        function getPlannerEventsForMonth(month = getPlannerMonth()) {
            return [
                ...loadPlannerEvents().filter((event) => String(event.date || '').startsWith(month)),
                ...getPlannerDerivedHourEvents(month)
            ].sort((a, b) => `${a.date || ''}${a.title || ''}`.localeCompare(`${b.date || ''}${b.title || ''}`));
        }

        function renderPlannerBreakdownLines(event = {}) {
            if (event.planner_kind !== 'hour_extra' || !Array.isArray(event.overtime_breakdown) || !event.overtime_breakdown.length) {
                return '';
            }

            return `
                <div class="mt-2 space-y-1">
                    ${event.overtime_breakdown.map((segment) => `
                        <div class="flex justify-between gap-3 text-xs text-textSecondary">
                            <span>${escapeHtml(segment.label || `${segment.percentage || 0}%`)}</span>
                            <span>${escapeHtml(segment.hoursFormatted || '')} - ${fmt(segment.total || 0)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderPlannerEventDetailCard(event = {}) {
            const visual = getPlannerEventVisual(event);
            const metric = visual.kindLabel || 'Compromisso';
            return `
                <div class="planner-detail-card rounded-xl border border-surfaceLight bg-surfaceLight/25 p-3">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-sm font-semibold ${visual.titleClass}">${escapeHtml(event.title || metric)}</p>
                    <p class="text-xs text-textSecondary mt-1">${metric}${event.person ? ` • ${escapeHtml(event.person)}` : ''}</p>
                            <p class="text-[11px] text-textSecondary mt-1">${escapeHtml(formatPlannerDateLabel(event.date))}</p>
                        </div>
                        <span class="planner-detail-badge ${visual.chipClass}">${escapeHtml(visual.shortLabel || metric)}</span>
                    </div>
                    ${event.note ? `<p class="text-sm text-textPrimary mt-2">${escapeHtml(event.note)}</p>` : ''}
                    ${renderPlannerBreakdownLines(event)}
                    ${event.derived ? '' : `<div class="mt-3 flex justify-end"><button type="button" data-delete-planner-event="${event.id}" class="p-2 rounded-lg text-textSecondary hover:text-danger hover:bg-danger/10"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`}
                </div>
            `;
        }

        function renderPlannerDetails(month, events = [], selectedDate = '') {
            const title = document.getElementById('planner-detail-title');
            const label = document.getElementById('planner-selected-date-label');
            const details = document.getElementById('planner-selected-date-details');
            if (!details) return;

            if (selectedDate) {
                const dayEvents = events.filter((event) => event.date === selectedDate);
                if (title) title.textContent = 'Detalhes do dia';
                if (label) label.textContent = formatPlannerDateLabel(selectedDate);
                details.innerHTML = dayEvents.length
                    ? dayEvents.map((event) => renderPlannerEventDetailCard(event)).join('')
                    : '<p class="text-sm text-textSecondary text-center py-4">Nenhum item no dia selecionado.</p>';
                return;
            }

            if (title) title.textContent = 'Resumo do mês';
            if (label) label.textContent = typeof formatCompetence === 'function' ? formatCompetence(month) : month;
            details.innerHTML = events.length
                ? events.map((event) => renderPlannerEventDetailCard(event)).join('')
                : '<p class="text-sm text-textSecondary text-center py-4">Nenhum item cadastrado neste mês.</p>';
        }

        function ensurePlannerModal() {
            if (document.getElementById('planner-modal')) return;

            const modal = document.createElement('div');
            modal.id = 'planner-modal';
            modal.className = 'hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4';
            modal.innerHTML = `
                <div class="glass-panel rounded-2xl border border-surfaceLight max-w-6xl w-full max-h-[92vh] overflow-y-auto p-5">
                    <div class="planner-modal-header flex items-start justify-between gap-4 mb-5">
                        <div>
                            <p class="text-xs uppercase tracking-[0.18em] text-accent font-semibold">Planner Mensal</p>
                            <h3 class="text-xl font-bold text-textPrimary mt-1">Feriados e compromissos</h3>
                            <p class="text-sm text-textSecondary mt-1">Organize eventos do mes e identifique feriados usados no controle de horas.</p>
                        </div>
                        <button data-legacy-click="closePlannerModal" class="planner-modal-close p-2 rounded-lg hover:bg-surfaceLight text-textSecondary">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>

                    <div class="planner-layout grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-4">
                        <div class="planner-calendar-panel rounded-2xl border border-surfaceLight bg-surface/80 p-4">
                            <div class="planner-toolbar flex items-center justify-between gap-3 flex-wrap mb-4">
                                <div class="planner-month-nav flex items-center gap-2">
                                    <button type="button" data-shift-planner-month="-1" class="w-9 h-9 rounded-lg bg-surfaceLight hover:bg-surfaceLight/80 flex items-center justify-center text-textSecondary">
                                        <i data-lucide="chevron-left" class="w-4 h-4"></i>
                                    </button>
                                    <input id="planner-month" type="month" class="text-sm min-w-[160px]" data-legacy-change="renderPlannerModal">
                                    <button type="button" data-shift-planner-month="1" class="w-9 h-9 rounded-lg bg-surfaceLight hover:bg-surfaceLight/80 flex items-center justify-center text-textSecondary">
                                        <i data-lucide="chevron-right" class="w-4 h-4"></i>
                                    </button>
                                </div>
                                <div class="planner-legend flex items-center gap-2 text-xs">
                                    <span class="planner-legend-item inline-flex items-center gap-1 text-warn"><span class="w-2 h-2 rounded-full bg-warn"></span>Feriado</span>
                                    <span class="planner-legend-item inline-flex items-center gap-1 text-accent"><span class="w-2 h-2 rounded-full bg-accent"></span>Compromisso</span>
                                    <span class="planner-legend-item inline-flex items-center gap-1 text-success"><span class="w-2 h-2 rounded-full bg-success"></span>Hora extra</span>
                                    <span class="planner-legend-item inline-flex items-center gap-1 text-sky-600"><span class="w-2 h-2 rounded-full bg-sky-500"></span>Banco de horas</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.12em] text-textSecondary mb-2">
                                <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
                            </div>
                            <p class="planner-mobile-hint text-xs text-textSecondary mb-3">Toque em um dia para ver os detalhes e organizar seus eventos.</p>
                            <div id="planner-calendar-grid" class="grid grid-cols-7 gap-2"></div>
                        </div>

                        <div class="planner-side-panel space-y-4">
                            <div class="planner-form-panel rounded-2xl border border-surfaceLight bg-surface/80 p-4">
                                <h4 class="text-sm font-semibold mb-3">Novo item</h4>
                                <div class="planner-form-grid space-y-3">
                                    <div class="planner-field">
                                        <label class="text-xs text-textSecondary mb-1 block">Data</label>
                                        <input id="planner-date" type="date" class="w-full text-sm">
                                    </div>
                                    <div class="planner-field">
                                        <label class="text-xs text-textSecondary mb-1 block">Tipo</label>
                                        <select id="planner-type" class="w-full text-sm">
                                            <option value="commitment">Compromisso</option>
                                            <option value="holiday">Feriado</option>
                                        </select>
                                    </div>
                                    <div class="planner-field planner-field-full">
                                        <label class="text-xs text-textSecondary mb-1 block">Titulo</label>
                                        <input id="planner-title" type="text" class="w-full text-sm" placeholder="Ex.: Consulta, Feriado municipal">
                                    </div>
                                    <div class="planner-field planner-field-full">
                                        <label class="text-xs text-textSecondary mb-1 block">Observacao</label>
                                        <textarea id="planner-note" rows="3" class="w-full text-sm" placeholder="Opcional"></textarea>
                                    </div>
                                    <button type="button" data-legacy-click="savePlannerEvent" class="planner-save-button w-full px-3 py-2 rounded-xl bg-accent text-bg font-semibold text-sm hover:bg-accentDark transition-colors">
                                        Salvar no planner
                                    </button>
                                </div>
                            </div>

                            <div class="planner-detail-panel rounded-2xl border border-surfaceLight bg-surface/80 p-4">
                                <div class="flex items-center justify-between gap-3 mb-3">
                                    <h4 id="planner-detail-title" class="text-sm font-semibold">Resumo do mês</h4>
                                    <span id="planner-selected-date-label" class="text-xs text-textSecondary"></span>
                                </div>
                                <div id="planner-selected-date-details" class="space-y-2 max-h-[520px] overflow-y-auto pr-1"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('app')?.appendChild(modal);
        }

        function openPlannerModal() {
            ensurePlannerModal();
            const monthInput = document.getElementById('planner-month');
            if (monthInput) monthInput.value = document.getElementById('f-comp-start')?.value || thisMonth;
            const dateInput = document.getElementById('planner-date');
            if (dateInput && !dateInput.value) dateInput.value = `${getPlannerMonth()}-01`;
            if (dateInput) delete dateInput.dataset.selectedPlannerDate;
            renderPlannerModal();
            document.getElementById('planner-modal')?.classList.remove('hidden');
            lucide.createIcons();
        }

        function closePlannerModal() {
            document.getElementById('planner-modal')?.classList.add('hidden');
        }

        function shiftPlannerMonth(delta) {
            const input = document.getElementById('planner-month');
            if (!input) return;
            input.value = shiftMonthValue(input.value || thisMonth, delta) || input.value || thisMonth;
            const dateInput = document.getElementById('planner-date');
            if (dateInput) dateInput.value = `${input.value}-01`;
            if (dateInput) delete dateInput.dataset.selectedPlannerDate;
            renderPlannerModal();
        }

        function selectPlannerDate(date) {
            const input = document.getElementById('planner-date');
            if (input) input.value = date;
            if (input) {
                if (input.dataset.selectedPlannerDate === date) delete input.dataset.selectedPlannerDate;
                else input.dataset.selectedPlannerDate = date;
            }
            renderPlannerModal();
        }

        function renderPlannerModal() {
            const month = getPlannerMonth();
            const [year, monthNumber] = month.split('-').map(Number);
            const firstDate = new Date(year, monthNumber - 1, 1);
            const daysInMonth = getDaysInCompetenceMonth(month);
            const startOffset = firstDate.getDay();
            const events = getPlannerEventsForMonth(month);
            const todayIso = getPlannerTodayIso();
            const eventsByDate = events.reduce((acc, event) => {
                if (!acc[event.date]) acc[event.date] = [];
                acc[event.date].push(event);
                return acc;
            }, {});

            const grid = document.getElementById('planner-calendar-grid');
            if (grid) {
                const cells = [];
                for (let i = 0; i < startOffset; i++) {
                    cells.push('<div class="planner-calendar-blank min-h-[92px] rounded-xl border border-transparent"></div>');
                }
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = `${month}-${String(day).padStart(2, '0')}`;
                    const dayEvents = eventsByDate[date] || [];
                    const dayVisuals = dayEvents.map((event) => getPlannerEventVisual(event));
                    const uniqueDots = [...new Set(dayVisuals.map((visual) => visual.dotClass).filter(Boolean))];
                    const isSelected = getPlannerSelectedDate() === date;
                    const isToday = date === todayIso;
                    const weekday = new Date(year, monthNumber - 1, day).getDay();
                    const isWeekend = weekday === 0 || weekday === 6;
                    cells.push(`
                        <button
                            type="button"
                            data-select-planner-date="${date}"
                            aria-label="${escapeHtml(formatPlannerDateLabel(date))}"
                            class="planner-day-cell ${isSelected ? 'planner-day-cell-selected border-accent bg-accent/5' : 'border-surfaceLight bg-surfaceLight/25'} ${isToday ? 'planner-day-cell-today' : ''} ${dayEvents.length ? 'planner-day-cell-has-events' : ''} ${isWeekend ? 'planner-day-cell-weekend' : ''} min-h-[92px] text-left rounded-xl border hover:border-accent/50 hover:bg-surfaceLight/45 transition-colors p-2"
                        >
                            <div class="planner-day-head flex items-center justify-between">
                                <span class="planner-day-number text-sm font-semibold text-textPrimary">${day}</span>
                                ${dayEvents.length ? `<span class="planner-day-count text-[10px] text-textSecondary">${dayEvents.length}</span>` : isToday ? '<span class="planner-day-count planner-day-today-label">Hoje</span>' : ''}
                            </div>
                            <div class="planner-day-badges mt-2">
                                ${dayEvents.slice(0, 2).map((event) => {
                                    const visual = getPlannerEventVisual(event);
                                    return `<div class="planner-day-badge ${visual.chipClass}" title="${escapeHtml(event.title || visual.kindLabel || 'Item')}">${escapeHtml(visual.shortLabel || 'Item')}</div>`;
                                }).join('')}
                                ${dayEvents.length > 2 ? `<div class="planner-day-more">+${dayEvents.length - 2}</div>` : ''}
                            </div>
                            <div class="planner-day-dots flex gap-1 mt-2">
                                ${uniqueDots.map((dotClass) => `<span class="w-2 h-2 rounded-full ${dotClass}"></span>`).join('')}
                            </div>
                        </button>
                    `);
                }
                grid.innerHTML = cells.join('');
            }

            renderPlannerDetails(month, events, getPlannerSelectedDate());
            lucide.createIcons();
        }

        function savePlannerEvent() {
            const date = document.getElementById('planner-date')?.value || '';
            const type = document.getElementById('planner-type')?.value === 'holiday' ? 'holiday' : 'commitment';
            const titleInput = document.getElementById('planner-title');
            const noteInput = document.getElementById('planner-note');
            const title = titleInput?.value?.trim() || (type === 'holiday' ? 'Feriado' : 'Compromisso');
            const note = noteInput?.value?.trim() || '';

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                showToast('Informe a data do planner', true);
                return;
            }

            const events = loadPlannerEvents();
            events.push({
                id: `planner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                date,
                type,
                title,
                note,
                created_at: new Date().toISOString()
            });
            savePlannerEvents(events);

            if (titleInput) titleInput.value = '';
            if (noteInput) noteInput.value = '';
            const monthInput = document.getElementById('planner-month');
            if (monthInput) monthInput.value = date.slice(0, 7);
            renderPlannerModal();
            showToast('Item adicionado ao planner!');
        }

        function deletePlannerEvent(id) {
            const events = loadPlannerEvents().filter((event) => event.id !== id);
            savePlannerEvents(events);
            renderPlannerModal();
            showToast('Item removido do planner!');
        }
