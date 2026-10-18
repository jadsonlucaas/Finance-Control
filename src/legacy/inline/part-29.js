(function enhanceEntradasMonthAndIncomeSources() {
            const CUSTOM_ENTRY_SOURCES_STORAGE_KEY = 'finance-control-entry-sources-v1';
            const HIDDEN_ENTRY_SOURCES_STORAGE_KEY = 'finance-control-hidden-entry-sources-v1';
            let customEntrySources = [];
            let hiddenEntrySources = [];

            function normalizeEntrySourceName(value = '') {
                return String(value || '').trim().replace(/\s+/g, ' ');
            }

            function loadCustomEntrySources() {
                try {
                    const parsed = JSON.parse(localStorage.getItem(CUSTOM_ENTRY_SOURCES_STORAGE_KEY) || '[]');
                    customEntrySources = Array.isArray(parsed)
                        ? parsed.map(normalizeEntrySourceName).filter(Boolean)
                        : [];
                } catch (error) {
                    customEntrySources = [];
                }
            }

            function persistCustomEntrySources() {
                localStorage.setItem(CUSTOM_ENTRY_SOURCES_STORAGE_KEY, JSON.stringify(customEntrySources));
            }

            function loadHiddenEntrySources() {
                try {
                    const parsed = JSON.parse(localStorage.getItem(HIDDEN_ENTRY_SOURCES_STORAGE_KEY) || '[]');
                    hiddenEntrySources = Array.isArray(parsed)
                        ? parsed.map(normalizeEntrySourceName).filter(Boolean)
                        : [];
                } catch (error) {
                    hiddenEntrySources = [];
                }
            }

            function persistHiddenEntrySources() {
                localStorage.setItem(HIDDEN_ENTRY_SOURCES_STORAGE_KEY, JSON.stringify(hiddenEntrySources));
            }

            function getBaseEntrySourceOptions(select) {
                if (!select) return [];
                if (!select.dataset.baseEntryOptions) {
                    select.dataset.baseEntryOptions = JSON.stringify(
                        Array.from(select.options).map((option) => option.value || option.textContent || '').filter(Boolean)
                    );
                }
                try {
                    return JSON.parse(select.dataset.baseEntryOptions || '[]');
                } catch (error) {
                    return [];
                }
            }

            function getAllEntrySourceOptions(select) {
                const map = new Map();
                const hidden = new Set(hiddenEntrySources.map((name) => name.toLowerCase()));
                getBaseEntrySourceOptions(select).forEach((name) => {
                    const normalized = normalizeEntrySourceName(name);
                    if (normalized && !hidden.has(normalized.toLowerCase())) map.set(normalized.toLowerCase(), normalized);
                });
                customEntrySources.forEach((name) => {
                    const normalized = normalizeEntrySourceName(name);
                    if (normalized) map.set(normalized.toLowerCase(), normalized);
                });
                return [...map.values()];
            }

            function syncEntryIncomeSourceOptions() {
                const select = document.getElementById('form-earning-type');
                if (!select) return;
                loadCustomEntrySources();
                loadHiddenEntrySources();
                const currentValue = select.value || '';
                const options = getAllEntrySourceOptions(select);
                if (currentValue && !options.some((name) => name.toLowerCase() === currentValue.toLowerCase())) {
                    options.push(currentValue);
                }
                select.innerHTML = options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
                if (currentValue) select.value = currentValue;
            }

            function renderEntrySourcesSettings() {
                const list = document.getElementById('entry-sources-list');
                const empty = document.getElementById('entry-sources-empty');
                if (!list || !empty) return;
                const select = document.getElementById('form-earning-type');
                loadCustomEntrySources();
                loadHiddenEntrySources();
                const hidden = new Set(hiddenEntrySources.map((name) => name.toLowerCase()));
                const baseItems = getBaseEntrySourceOptions(select)
                    .map(normalizeEntrySourceName)
                    .filter((source) => source && !hidden.has(source.toLowerCase()))
                    .map((source) => ({ source, kind: 'padrao' }));
                const customItems = customEntrySources
                    .map(normalizeEntrySourceName)
                    .filter(Boolean)
                    .map((source) => ({ source, kind: 'custom' }));
                const sorted = [...baseItems, ...customItems]
                    .filter((item, index, items) => items.findIndex((other) => other.source.toLowerCase() === item.source.toLowerCase()) === index)
                    .sort((a, b) => a.source.localeCompare(b.source, 'pt-BR'));
                empty.classList.toggle('hidden', sorted.length > 0);
                list.innerHTML = sorted.map(({ source, kind }) => `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3 flex items-center justify-between gap-3">
                        <div>
                            <p class="text-sm font-semibold text-textPrimary">${escapeHtml(source)}</p>
                            <p class="text-xs text-textSecondary mt-1">${kind === 'padrao' ? 'Opcao padrao do sistema' : 'Fonte de renda adicional'}</p>
                        </div>
                        <button type="button" data-delete-entry-income-source="${escapeHtml(source)}" class="px-3 py-1.5 text-xs rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors">Excluir</button>
                    </div>
                `).join('');
            }

            function ensureEntrySourcesSettingsPanel() {
                const overtimePanel = document.getElementById('overtime-types-list')?.closest('.bg-surface');
                if (!overtimePanel || document.getElementById('entry-sources-panel')) return;
                const panel = document.createElement('div');
                panel.id = 'entry-sources-panel';
                panel.className = 'bg-surface rounded-xl p-4 border border-surfaceLight';
                panel.innerHTML = `
                    <div class="flex justify-between items-start mb-3 gap-3 flex-wrap">
                        <div>
                            <h3 class="font-semibold text-sm">Outras Fontes de Renda</h3>
                            <p class="text-xs text-textSecondary mt-1">Cadastre ou exclua as opções que aparecem no campo Tipo de Entrada.</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-3">
                        <input id="entry-source-name" type="text" placeholder="Ex: Freelance, aluguel, comissão" class="w-full text-sm">
                        <button type="button" data-legacy-click="saveEntryIncomeSource" class="bg-success hover:bg-success/80 text-bg text-xs font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1">
                            <i data-lucide="plus" class="w-3 h-3"></i> Adicionar
                        </button>
                    </div>
                    <div id="entry-sources-list" class="space-y-2"></div>
                    <p id="entry-sources-empty" class="text-textSecondary text-xs text-center py-4">Nenhuma opção de entrada disponível.</p>
                `;
                overtimePanel.insertAdjacentElement('afterend', panel);
                document.getElementById('entry-source-name')?.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        window.saveEntryIncomeSource();
                    }
                });
            }

            window.saveEntryIncomeSource = function () {
                const input = document.getElementById('entry-source-name');
                const name = normalizeEntrySourceName(input?.value || '');
                if (!name) {
                    showToast('Informe o nome da fonte de renda', true);
                    return;
                }
                loadCustomEntrySources();
                if (customEntrySources.some((item) => item.toLowerCase() === name.toLowerCase())) {
                    showToast('Essa fonte de renda ja existe', true);
                    return;
                }
                customEntrySources.push(name);
                persistCustomEntrySources();
                if (input) input.value = '';
                syncEntryIncomeSourceOptions();
                renderEntrySourcesSettings();
                showToast('Fonte de renda cadastrada!');
                lucide.createIcons();
            };

            window.deleteEntryIncomeSource = function (sourceName = '') {
                const normalized = normalizeEntrySourceName(sourceName).toLowerCase();
                loadCustomEntrySources();
                loadHiddenEntrySources();
                const beforeCustomLength = customEntrySources.length;
                customEntrySources = customEntrySources.filter((item) => item.toLowerCase() !== normalized);
                if (customEntrySources.length === beforeCustomLength && !hiddenEntrySources.some((item) => item.toLowerCase() === normalized)) {
                    hiddenEntrySources.push(normalizeEntrySourceName(sourceName));
                }
                persistCustomEntrySources();
                persistHiddenEntrySources();
                syncEntryIncomeSourceOptions();
                renderEntrySourcesSettings();
                showToast('Opcao removida do Tipo de Entrada!');
                lucide.createIcons();
            };

            function ensureEntradasMonthNavigator() {
                const input = document.getElementById('entradas-competence-filter');
                if (!input) return;
                if (!input.value) input.value = thisMonth;
                if (input.closest('#entradas-month-nav')) return;

                const wrap = document.createElement('div');
                wrap.id = 'entradas-month-nav';
                wrap.className = 'flex items-center gap-1';
                input.parentNode.insertBefore(wrap, input);
                wrap.appendChild(input);
                input.className = `${input.className || ''} min-w-[150px]`.trim();

                const prev = document.createElement('button');
                prev.type = 'button';
                prev.className = 'px-3 py-2 rounded-lg border border-surfaceLight bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-colors';
                prev.title = 'Mes anterior';
                prev.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4"></i>';
                prev.onclick = () => shiftEntradasMonthFilter(-1);

                const next = document.createElement('button');
                next.type = 'button';
                next.className = prev.className;
                next.title = 'Próximo mês';
                next.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4"></i>';
                next.onclick = () => shiftEntradasMonthFilter(1);

                wrap.insertBefore(prev, input);
                wrap.appendChild(next);
            }

            window.shiftEntradasMonthFilter = function (direction = 0) {
                const input = document.getElementById('entradas-competence-filter');
                if (!input) return;
                input.value = shiftMonthValue(input.value || thisMonth, Number(direction) || 0);
                renderEntradas();
            };

            function ensureControleHorasMonthNavigator() {
                const input = document.getElementById('controle-horas-competencia');
                if (!input) return;
                if (!input.value) input.value = thisMonth;
                if (input.closest('#controle-horas-month-nav')) return;

                const wrap = document.createElement('div');
                wrap.id = 'controle-horas-month-nav';
                wrap.className = 'flex items-center gap-1';
                input.parentNode.insertBefore(wrap, input);
                wrap.appendChild(input);
                input.className = `${input.className || ''} min-w-[150px]`.trim();

                const prev = document.createElement('button');
                prev.type = 'button';
                prev.className = 'px-3 py-2 rounded-lg border border-surfaceLight bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-colors';
                prev.title = 'Mes anterior';
                prev.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4"></i>';
                prev.onclick = () => shiftControleHorasMonthFilter(-1);

                const next = document.createElement('button');
                next.type = 'button';
                next.className = prev.className;
                next.title = 'Próximo mês';
                next.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4"></i>';
                next.onclick = () => shiftControleHorasMonthFilter(1);

                wrap.insertBefore(prev, input);
                wrap.appendChild(next);
            }

            window.shiftControleHorasMonthFilter = function (direction = 0) {
                const input = document.getElementById('controle-horas-competencia');
                if (!input) return;
                input.value = shiftMonthValue(input.value || thisMonth, Number(direction) || 0);
                renderControleHoras();
            };

            const PERCENTAGE_EXIT_RULES_STORAGE_KEY = 'finance-control-percentage-exit-rules-v1';
            const PERCENTAGE_EXIT_RULE_TYPE = 'percentage_rule';
            let percentageExitRules = [];
            let editingPercentageExitRuleId = '';
            let percentageExitRulesMigrationStarted = false;
            const percentageExitMaterializationKeys = new Set();
            const percentageExitRowActionRecords = new Map();
            let dashboardBreakdownCache = {
                macro: new Map(),
                subcategory: new Map(),
                person: new Map()
            };

            function normalizePercentageExitRule(rule = {}) {
                return {
                    id: rule.id || `pct_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                    name: normalizeEntrySourceName(rule.name || ''),
                    person: normalizeEntrySourceName(rule.person || ''),
                    percentage: Number(rule.percentage) || 0,
                    base: rule.base || 'liquido',
                    macro: normalizeEntrySourceName(rule.macro || 'RESERVA'),
                    category: normalizeEntrySourceName(rule.category || 'Reserva'),
                    cycle: rule.cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES',
                    status: rule.status === 'Pago' ? 'Pago' : 'Em aberto',
                    startCompetence: normalizeCompetenceKey(rule.startCompetence || thisMonth),
                    active: rule.active !== false,
                    createdAt: rule.createdAt || new Date().toISOString(),
                    updatedAt: rule.updatedAt || new Date().toISOString()
                };
            }

            function isPercentageExitRuleRecord(record) {
                return record?.type === PERCENTAGE_EXIT_RULE_TYPE || record?.type === 'regra_percentual_saida';
            }

            function getPercentageRuleRecordsFromFirebase() {
                return (Array.isArray(allRecords) ? allRecords : [])
                    .filter(isPercentageExitRuleRecord)
                    .map(normalizePercentageExitRule)
                    .filter((rule) => rule.name && rule.percentage > 0);
            }

            function getLocalPercentageExitRules() {
                try {
                    const parsed = JSON.parse(localStorage.getItem(PERCENTAGE_EXIT_RULES_STORAGE_KEY) || '[]');
                    return Array.isArray(parsed)
                        ? parsed.map(normalizePercentageExitRule).filter((rule) => rule.name && rule.percentage > 0)
                        : [];
                } catch (error) {
                    return [];
                }
            }

            function clearLocalPercentageExitRulesBackup() {
                localStorage.removeItem(PERCENTAGE_EXIT_RULES_STORAGE_KEY);
            }

            function getPercentageRuleIdentity(rule = {}) {
                const normalized = normalizePercentageExitRule(rule);
                return [
                    normalized.name,
                    normalized.person,
                    normalized.percentage,
                    normalized.base,
                    normalized.macro,
                    normalized.category,
                    normalized.cycle,
                    normalized.startCompetence
                ].join('|').toLowerCase();
            }

            function getPercentageRuleFirebaseId(rule = {}) {
                const identity = getPercentageRuleIdentity(rule)
                    .normalize('NFD')
                    .replace(/[̀-ͯ]/g, '')
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .slice(0, 140);
                return `percentage_rule_${identity || Date.now()}`;
            }

            function loadPercentageExitRules() {
                const firebaseRules = getPercentageRuleRecordsFromFirebase();
                const mergedRules = new Map();
                getLocalPercentageExitRules().forEach((rule) => {
                    mergedRules.set(getPercentageRuleIdentity(rule), rule);
                });
                firebaseRules.forEach((rule) => {
                    mergedRules.set(getPercentageRuleIdentity(rule), rule);
                });
                percentageExitRules = [...mergedRules.values()];
            }

            window.getSyncedPercentageExitRules = function () {
                loadPercentageExitRules();
                migrateLocalPercentageExitRulesToFirebase();
                return [...percentageExitRules];
            };

            function buildPercentageRulePayload(rule = {}) {
                const { id, ...normalizedRule } = normalizePercentageExitRule(rule);
                return {
                    ...normalizedRule,
                    type: PERCENTAGE_EXIT_RULE_TYPE,
                    person: normalizedRule.person || '',
                    macro_category: '',
                    subcategory: '',
                    description: normalizedRule.name,
                    amount: 0,
                    status: normalizedRule.status,
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
                    created_at: normalizedRule.createdAt || new Date().toISOString(),
                    category_id: '',
                    category_name: normalizedRule.category,
                    category_color: '',
                    category_icon: '',
                    ...getHourExtraRecordDefaults()
                };
            }

            async function upsertPercentageExitRule(rule = {}, preferredId = '') {
                if (!window.dataSdk?.upsert) return { isOk: false, error: 'UPSERT_UNAVAILABLE' };
                const normalizedRule = normalizePercentageExitRule(rule);
                const id = preferredId || normalizedRule.id || getPercentageRuleFirebaseId(normalizedRule);
                const payload = buildPercentageRulePayload({ ...normalizedRule, id });
                return window.dataSdk.upsert({ ...payload, id });
            }

            async function migrateLocalPercentageExitRulesToFirebase() {
                if (percentageExitRulesMigrationStarted || !window.dataSdk?.upsert || !window.authSdk?.getCurrentUser?.()) return;
                const localRules = getLocalPercentageExitRules();
                const firebaseRules = getPercentageRuleRecordsFromFirebase();
                const firebaseRuleKeys = new Set(firebaseRules.map(getPercentageRuleIdentity));
                const missingRules = localRules.filter((rule) => !firebaseRuleKeys.has(getPercentageRuleIdentity(rule)));
                if (!missingRules.length) {
                    if (localRules.length) clearLocalPercentageExitRulesBackup();
                    return;
                }

                percentageExitRulesMigrationStarted = true;
                let migratedCount = 0;
                try {
                    for (const rule of missingRules) {
                        const result = await upsertPercentageExitRule(rule, getPercentageRuleFirebaseId(rule));
                        if (!result.isOk) {
                            showToast('Erro ao migrar regra percentual para a nuvem', true);
                            return;
                        }
                        migratedCount += 1;
                    }
                } finally {
                    percentageExitRulesMigrationStarted = false;
                }
                if (migratedCount) {
                    clearLocalPercentageExitRulesBackup();
                    schedulePercentageExitMaterialization(
                        document.getElementById('f-comp-start')?.value || thisMonth,
                        document.getElementById('f-comp-end')?.value || thisMonth
                    );
                    showToast('Regras percentuais migradas para a nuvem.');
                }
            }

            async function refreshPercentageExitRulesFromCloudStorage() {
                if (!window.authSdk?.getCurrentUser?.()) return;
                loadPercentageExitRules();
                await migrateLocalPercentageExitRulesToFirebase();
                loadPercentageExitRules();
                if (currentTab === 'configuracoes') {
                    renderPercentageExitRules();
                }
                renderCurrentTab();
            }

            window.addEventListener('cloudLocalStorageChanged', (event) => {
                if (!event.detail?.changed) return;
                refreshPercentageExitRulesFromCloudStorage().catch((error) => {
                    console.error('Erro ao atualizar regras percentuais da nuvem', error);
                });
            });

            function getWorkIncomeBaseValue(consolidated = {}) {
                return roundCurrency(Number(consolidated.baseTrabalho || 0) ||
                    (Number(consolidated.salaryBase || consolidated.salarioBase || 0) +
                        Number(consolidated.hourExtra || 0) +
                        Number(consolidated.dsrHoraExtra || 0) +
                        Number(consolidated.dsrProventos || 0)));
            }

            function getWorkLiquidBaseValue(consolidated = {}) {
                return roundCurrency(
                    getWorkIncomeBaseValue(consolidated) -
                    Number(consolidated.inss || 0) -
                    Number(consolidated.irrf || 0) -
                    Number(consolidated.outrosDescontos || consolidated.outrosDescontosManuais || 0)
                );
            }

            function getPercentageBaseValue(consolidated, base) {
                if (base === 'base_total') return getWorkIncomeBaseValue(consolidated);
                if (base === 'bruta') return getWorkIncomeBaseValue(consolidated);
                if (base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
                if (base === 'extra') return roundCurrency((Number(consolidated.hourExtra || 0)) + (Number(consolidated.dsrHoraExtra || 0)) + (Number(consolidated.dsrProventos || 0)));
                return getWorkLiquidBaseValue(consolidated);
            }

            function getPercentageCycleBaseValue(consolidated = {}, base = 'liquido', cycle = 'INICIO_MES') {
                const normalizedCycle = cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
                if (base === 'base_total') return getWorkIncomeBaseValue(consolidated);
                if (base === 'bruta') return getWorkIncomeBaseValue(consolidated);
                if (base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
                if (base === 'extra') {
                    return normalizedCycle === 'QUINZENA'
                        ? 0
                        : roundCurrency((Number(consolidated.hourExtra || 0)) + (Number(consolidated.dsrHoraExtra || 0)) + (Number(consolidated.dsrProventos || 0)));
                }
                if (normalizedCycle === 'QUINZENA') {
                    return Number(consolidated.adiantamentoQuinzena || 0);
                }
                return getPercentageBaseValue(consolidated, base);
            }

            function isReserveOrInvestmentPercentageRule(rule = {}) {
                const text = [
                    rule.macro,
                    rule.category,
                    rule.name
                ].map((value) => String(value || '').trim().toUpperCase()).join(' ');
                return text.includes('RESERVA') || text.includes('INVEST');
            }

            function getPercentageRuleBaseValue(consolidated = {}, rule = {}) {
                const ruleCycle = rule.cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
                if (rule.base === 'base_total') return getWorkIncomeBaseValue(consolidated);
                if (rule.base === 'bruta') return getWorkIncomeBaseValue(consolidated);
                if (rule.base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
                if (rule.base === 'extra') return getPercentageCycleBaseValue(consolidated, 'extra', ruleCycle);
                if (isReserveOrInvestmentPercentageRule(rule)) {
                    return ruleCycle === 'QUINZENA'
                        ? Number(consolidated.adiantamentoQuinzena || 0)
                        : getWorkLiquidBaseValue(consolidated);
                }
                return getPercentageCycleBaseValue(consolidated, rule.base || 'liquido', ruleCycle);
            }

            function getPercentageRuleAmount(consolidated = {}, rule = {}) {
                const baseValue = getPercentageRuleBaseValue(consolidated, rule);
                return roundCurrency(baseValue * (Number(rule.percentage || 0) / 100));
            }

            function getPercentageGeneratedRecordId(rule = {}, personName = '', competence = '') {
                const raw = [
                    rule.id || getPercentageRuleFirebaseId(rule),
                    personName,
                    normalizeCompetenceKey(competence)
                ].join('|');
                const slug = raw
                    .normalize('NFD')
                    .replace(/[̀-ͯ]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .slice(0, 150);
                return `percentage_exit_${slug}`;
            }

            function isPersistedPercentageExitRecord(record = {}) {
                return record?.type === 'saida' && record?.generated_percentage_rule === true && record?.virtual_record !== true;
            }

            function getPercentageExitRecordKey(record = {}) {
                if (!record?.generated_percentage_rule) return '';
                const descriptionKey = String(record.description || record.subcategory || record.category_name || '').trim().toLowerCase();
                const personKey = String(record.person || '').trim().toLowerCase();
                const competenceKey = normalizeCompetenceKey(record.competence || record.due_date || '');
                const macroKey = String(record.macro_category || '').trim().toLowerCase();
                const categoryKey = String(record.subcategory || record.category_name || '').trim().toLowerCase();
                const rateKey = Number(record.percentage_rate || 0).toFixed(4);
                const baseKey = String(record.percentage_base || '').trim().toLowerCase();
                const cycleKey = String(record.cycle || '').trim().toLowerCase();
                return [descriptionKey, personKey, competenceKey, macroKey, categoryKey, rateKey, baseKey, cycleKey].join('|');
            }

            function getPercentageRuleRecordKey(rule = {}, personName = '', competence = '') {
                const normalizedRule = normalizePercentageExitRule(rule);
                return getPercentageExitRecordKey({
                    generated_percentage_rule: true,
                    description: `${normalizedRule.name} (${Number(normalizedRule.percentage || 0).toFixed(2).replace('.', ',')}%)`,
                    person: personName,
                    competence,
                    macro_category: normalizedRule.macro,
                    subcategory: normalizedRule.category,
                    percentage_rate: normalizedRule.percentage,
                    percentage_base: normalizedRule.base,
                    cycle: normalizedRule.cycle
                });
            }

            function isCanonicalPercentageExitRecord(record = {}) {
                return Boolean(record?.generated_percentage_rule && String(record.id || '').startsWith('percentage_exit_'));
            }

            function getPercentageExitRecordRank(record = {}) {
                let rank = 0;
                if (isCanonicalPercentageExitRecord(record)) rank += 8;
                if (record.virtual_record !== true) rank += 4;
                if (record.updated_at) rank += 2;
                if (Number(record.percentage_base_amount || 0) > 0) rank += 1;
                return rank;
            }

            function dedupePercentageExitRecords(records = []) {
                const result = [];
                const percentageIndexByKey = new Map();

                records.forEach((record) => {
                    if (!record?.generated_percentage_rule) {
                        result.push(record);
                        return;
                    }

                    const key = getPercentageExitRecordKey(record);
                    if (!key) {
                        result.push(record);
                        return;
                    }

                    if (percentageIndexByKey.has(key)) {
                        const existingIndex = percentageIndexByKey.get(key);
                        const existing = result[existingIndex];
                        if (getPercentageExitRecordRank(record) > getPercentageExitRecordRank(existing)) {
                            result[existingIndex] = record;
                        }
                        return;
                    }
                    percentageIndexByKey.set(key, result.length);
                    result.push(record);
                });

                return result;
            }

            function hasPersistedPercentageExitRecord(rule = {}, personName = '', competence = '') {
                return Boolean(findPersistedPercentageExitRecord(rule, personName, competence));
            }

            function findPersistedPercentageExitRecord(rule = {}, personName = '', competence = '') {
                const targetId = getPercentageGeneratedRecordId(rule, personName, competence);
                const targetRuleId = String(rule.id || '').trim();
                const targetSemanticKey = getPercentageRuleRecordKey(rule, personName, competence);
                return (Array.isArray(allRecords) ? allRecords : []).find((record) => {
                    if (!isPersistedPercentageExitRecord(record)) return false;
                    if (record.id === targetId) return true;
                    if (targetSemanticKey && getPercentageExitRecordKey(record) === targetSemanticKey) return true;
                    return targetRuleId &&
                        String(record.percentage_rule_id || '').trim() === targetRuleId &&
                        String(record.person || '').trim() === String(personName || '').trim() &&
                        normalizeCompetenceKey(record.competence || record.due_date || '') === normalizeCompetenceKey(competence);
                }) || null;
            }

            function preservePersistedPercentageExitState(nextRecord = {}, persistedRecord = null) {
                if (!persistedRecord) return nextRecord;
                return {
                    ...nextRecord,
                    id: persistedRecord.id || nextRecord.id,
                    status: persistedRecord.status || nextRecord.status,
                    paid_at: persistedRecord.paid_at || '',
                    archived: Boolean(persistedRecord.archived),
                    archived_at: persistedRecord.archived_at || '',
                    created_at: persistedRecord.created_at || nextRecord.created_at,
                    virtual_record: false
                };
            }

            function isPercentageExitRecordLinkedToRule(record = {}, rule = {}) {
                if (!record?.generated_percentage_rule || !rule) return false;
                const recordRuleId = String(record.percentage_rule_id || '').trim();
                const ruleId = String(rule.id || '').trim();
                if (recordRuleId && ruleId && recordRuleId === ruleId) return true;
                const competence = normalizeCompetenceKey(record.competence || record.due_date || '');
                if (rule.person && String(record.person || '').trim() !== rule.person) return false;
                return getPercentageExitRecordKey(record) === getPercentageRuleRecordKey(rule, record.person || '', competence);
            }

            function isPercentageExitRecordLinkedToActiveRule(record = {}) {
                if (!record?.generated_percentage_rule) return true;
                const competence = normalizeCompetenceKey(record.competence || record.due_date || '');
                return getPercentageRuleRecordsFromFirebase()
                    .filter((rule) => rule.active !== false)
                    .some((rule) => {
                        if (rule.startCompetence && competence && competence < rule.startCompetence) return false;
                        return isPercentageExitRecordLinkedToRule(record, rule);
                    });
            }

            function filterOrphanPercentageExitRecords(records = []) {
                return records.filter((record) =>
                    !record?.generated_percentage_rule ||
                    isPersistedPercentageExitRecord(record) ||
                    isPercentageExitRecordLinkedToActiveRule(record)
                );
            }

            async function deleteGeneratedPercentageExitRecordsForRule(rule = {}) {
                if (!rule?.id || !window.dataSdk?.delete) return 0;
                const targets = (Array.isArray(allRecords) ? allRecords : [])
                    .filter(isPersistedPercentageExitRecord)
                    .filter((record) => isPercentageExitRecordLinkedToRule(record, rule));

                let deleted = 0;
                for (const record of targets) {
                    const result = await window.dataSdk.delete(record);
                    if (result?.isOk) deleted += 1;
                }
                return deleted;
            }

            function buildPercentageExitRecord(rule = {}, personName = '', competence = '', options = {}) {
                const normalizedCompetence = normalizeCompetenceKey(competence);
                if (!personName || !normalizedCompetence) return null;
                if (rule.startCompetence && normalizedCompetence < rule.startCompetence) return null;

                const consolidated = consolidarEntradaMensal(personName, normalizedCompetence);
                const baseValue = roundCurrency(getPercentageRuleBaseValue(consolidated, rule));
                const amount = getPercentageRuleAmount(consolidated, rule);
                if (amount <= 0) return null;

                const ruleCycle = rule.cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
                return {
                    id: getPercentageGeneratedRecordId(rule, personName, normalizedCompetence),
                    type: 'saida',
                    person: personName,
                    macro_category: rule.macro,
                    subcategory: rule.category,
                    description: `${rule.name} (${Number(rule.percentage).toFixed(2).replace('.', ',')}%)`,
                    amount,
                    status: rule.status,
                    payment_method: 'Regra percentual',
                    occurred_date: '',
                    due_date: `${normalizedCompetence}-01`,
                    competence: normalizedCompetence,
                    paid_at: rule.status === 'Pago' ? `${normalizedCompetence}-01` : '',
                    installment_no: 0,
                    total_installments: 0,
                    parent_id: '',
                    earning_type: '',
                    recurrence: 'mensal_percentual',
                    cycle: ruleCycle,
                    created_at: rule.createdAt,
                    category_id: '',
                    category_name: rule.category,
                    category_color: '',
                    category_icon: '',
                    archived: false,
                    generated_percentage_rule: true,
                    percentage_rule_id: rule.id,
                    percentage_rate: rule.percentage,
                    percentage_base: rule.base,
                    percentage_base_amount: baseValue,
                    virtual_record: options.virtual === true,
                    updated_at: new Date().toISOString(),
                    ...getHourExtraRecordDefaults()
                };
            }

            function getRegisteredPercentageExitRecord(recordId = '') {
                const id = String(recordId || '');
                if (!id) return null;
                return percentageExitRowActionRecords.get(id)
                    || (Array.isArray(allRecords) ? allRecords.find((record) => String(record?.id || '') === id) : null)
                    || getPercentageRuleGeneratedRecords({
                        start: document.getElementById('f-comp-start')?.value || thisMonth,
                        end: document.getElementById('f-comp-end')?.value || document.getElementById('f-comp-start')?.value || thisMonth
                    }).find((record) => String(record?.id || '') === id)
                    || null;
            }

            async function persistPercentageExitOccurrence(record = {}, overrides = {}) {
                if (!record?.generated_percentage_rule) return record;
                if (!window.dataSdk?.upsert) {
                    showToast('Banco de dados ainda não está pronto para salvar este fixo mensal.', true);
                    return null;
                }

                const now = new Date().toISOString();
                const persisted = {
                    ...record,
                    ...overrides,
                    type: 'saida',
                    virtual_record: false,
                    archived: overrides.archived ?? Boolean(record.archived),
                    created_at: record.created_at || now,
                    updated_at: now
                };

                const result = await window.dataSdk.upsert(persisted);
                if (!result?.isOk) {
                    showToast(`Erro ao salvar fixo mensal${result?.error ? `: ${result.error}` : ''}`, true);
                    return null;
                }

                const index = Array.isArray(allRecords)
                    ? allRecords.findIndex((item) => String(item?.id || '') === String(persisted.id || ''))
                    : -1;
                if (index >= 0) allRecords[index] = persisted;
                else allRecords.push(persisted);
                percentageExitRowActionRecords.set(String(persisted.id || ''), persisted);
                window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
                return persisted;
            }

            function excludeDashboardDetailRecord(record = {}) {
                if (!record?.id || !dashboardDetailContext) return;
                dashboardDetailContext.excludedIds = [...new Set([...(dashboardDetailContext.excludedIds || []), record.id])];
            }

            async function handlePercentageExitRowAction(action = '', recordId = '') {
                const record = getRegisteredPercentageExitRecord(recordId);
                if (!record) return;

                if (action === 'edit') {
                    const persisted = await persistPercentageExitOccurrence(record);
                    if (persisted) openEditRecord(persisted);
                    return;
                }

                if (action === 'toggle-paid') {
                    const nextStatus = record.status === 'Pago' ? 'Em aberto' : 'Pago';
                    const persisted = await persistPercentageExitOccurrence(record, {
                        status: nextStatus,
                        paid_at: nextStatus === 'Pago' ? today : ''
                    });
                    if (!persisted) return;
                    if (nextStatus === 'Pago') excludeDashboardDetailRecord(persisted);
                    showToast(nextStatus === 'Pago' ? 'Fixo mensal marcado como pago!' : 'Fixo mensal reaberto!');
                    renderAll();
                    setTimeout(refreshDashboardDetailAfterDataChange, 0);
                    return;
                }

                if (action === 'toggle-archive') {
                    const archived = !isArchivedRecord(record);
                    const persisted = await persistPercentageExitOccurrence(record, { archived });
                    if (!persisted) return;
                    if (archived) excludeDashboardDetailRecord(persisted);
                    showToast(archived ? 'Fixo mensal arquivado!' : 'Fixo mensal reaberto!');
                    renderAll();
                    setTimeout(refreshDashboardDetailAfterDataChange, 0);
                    return;
                }

                if (action === 'delete') {
                    const persisted = await persistPercentageExitOccurrence(record);
                    if (persisted) askDelete(persisted);
                }
            }

            window.__financeGetPercentageExitRecord = getRegisteredPercentageExitRecord;
            window.__financeHandlePercentageExitRowAction = handlePercentageExitRowAction;

            async function materializePercentageExitRulesForRange(start = '', end = '') {
                const rangeStart = normalizeCompetenceKey(start || document.getElementById('f-comp-start')?.value || thisMonth) || thisMonth;
                const rangeEnd = normalizeCompetenceKey(end || document.getElementById('f-comp-end')?.value || rangeStart) || rangeStart;
                const runner = window.financeApp?.percentageRuleMaterializationRunner;
                if (!runner?.runForRange || !window.authSdk?.getCurrentUser?.()) return null;
                return runner.runForRange({
                    startCompetence: rangeStart,
                    endCompetence: rangeEnd,
                    ownerUid: window.authSdk.getCurrentUser()?.uid || '',
                    executionContext: {
                        actorUid: window.authSdk.getCurrentUser()?.uid || '',
                        actorType: 'user',
                        sourceChannel: 'system'
                    }
                });
            }

            function schedulePercentageExitMaterialization(start = '', end = '') {
                const materializationKey = `${normalizeCompetenceKey(start || thisMonth)}|${normalizeCompetenceKey(end || start || thisMonth)}`;
                percentageExitMaterializationKeys.add(materializationKey);
            }

            Object.assign(window, {
                getPercentageGeneratedRecordId,
                getPercentageExitRecordKey,
                getPercentageRuleRecordKey,
                isCanonicalPercentageExitRecord,
                getPercentageExitRecordRank,
                isPersistedPercentageExitRecord,
                hasPersistedPercentageExitRecord,
                findPersistedPercentageExitRecord,
                preservePersistedPercentageExitState,
                isPercentageExitRecordLinkedToRule,
                isPercentageExitRecordLinkedToActiveRule,
                filterOrphanPercentageExitRecords,
                deleteGeneratedPercentageExitRecordsForRule,
                buildPercentageExitRecord,
                dedupePercentageExitRecords,
                schedulePercentageExitMaterialization,
                materializePercentageExitRulesForRange
            });

            function getPercentageRuleGeneratedRecords(options = {}) {
                loadPercentageExitRules();
                const start = normalizeCompetenceKey(options.start || document.getElementById('f-comp-start')?.value || thisMonth);
                const end = normalizeCompetenceKey(options.end || document.getElementById('f-comp-end')?.value || start);
                const competences = buildCompetenceSequence(start, end || start);
                const people = getPeopleRecords();
                const records = [];

                percentageExitRules
                    .filter((rule) => rule.active)
                    .forEach((rule) => {
                        const targetPeople = rule.person
                            ? people.filter((person) => person.person === rule.person)
                            : people;
                        targetPeople.forEach((person) => {
                            competences.forEach((competence) => {
                                if (hasPersistedPercentageExitRecord(rule, person.person, competence)) return;
                                const record = buildPercentageExitRecord(rule, person.person, competence, { virtual: true });
                                if (record) records.push(record);
                            });
                        });
                    });

                return records;
            }

            function getPercentageBaseLabel(base) {
                if (base === 'base_total') return 'Base trabalho';
                if (base === 'bruta') return 'Receita trabalho bruta';
                if (base === 'salario') return 'Salario base';
                if (base === 'extra') return 'H.E. + DSR';
                return 'Receita liquida';
            }

            function getCycleLabel(cycle = '') {
                return cycle === 'QUINZENA' ? 'Quinzena' : 'Início do mês';
            }

            function ensurePercentageExitRulesPanel() {
                const entrySourcesPanel = document.getElementById('entry-sources-panel');
                if (!entrySourcesPanel || document.getElementById('percentage-exit-rules-panel')) return;
                const panel = document.createElement('div');
                panel.id = 'percentage-exit-rules-panel';
                panel.className = 'bg-surface rounded-xl p-4 border border-surfaceLight';
                panel.innerHTML = `
                    <div class="flex justify-between items-start mb-3 gap-3 flex-wrap">
                        <div>
                            <h3 class="font-semibold text-sm">Regras Fixas Percentuais</h3>
                            <p class="text-xs text-textSecondary mt-1">Saídas mensais calculadas automaticamente sobre a receita de cada pessoa.</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Nome da regra</label>
                            <input id="percentage-rule-name" type="text" placeholder="Ex: Reserva mensal" class="w-full text-sm">
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Pessoa</label>
                            <select id="percentage-rule-person" class="w-full text-sm"></select>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Percentual</label>
                            <input id="percentage-rule-rate" type="number" step="0.01" min="0" placeholder="20" class="w-full text-sm">
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Base de calculo</label>
                            <select id="percentage-rule-base" class="w-full text-sm">
                                <option value="liquido">Receita trabalho liquida</option>
                                <option value="bruta">Receita trabalho bruta</option>
                                <option value="base_total">Base trabalho</option>
                                <option value="salario">Salario base</option>
                                <option value="extra">H.E. + DSR</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Categoria macro</label>
                            <select id="percentage-rule-macro" data-legacy-change="syncPercentageRuleCategoryOptions" class="w-full text-sm"></select>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Categoria</label>
                            <select id="percentage-rule-category" class="w-full text-sm"></select>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Ciclo</label>
                            <select id="percentage-rule-cycle" class="w-full text-sm">
                                <option value="INICIO_MES">Início do mês</option>
                                <option value="QUINZENA">Quinzena</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Status padrao</label>
                            <select id="percentage-rule-status" class="w-full text-sm">
                                <option value="Em aberto">Em aberto</option>
                                <option value="Pago">Pago</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-textSecondary mb-1 block">Vigente desde</label>
                            <input id="percentage-rule-start" type="month" class="w-full text-sm">
                        </div>
                    </div>
                    <div class="flex justify-end mb-4">
                        <button type="button" data-legacy-click="savePercentageExitRule" class="bg-success hover:bg-success/80 text-bg text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
                            <i data-lucide="plus" class="w-3 h-3"></i> <span id="percentage-rule-save-label">Salvar regra</span>
                        </button>
                        <button id="percentage-rule-cancel-edit" type="button" data-legacy-click="cancelEditPercentageExitRule" class="hidden ml-2 bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary text-xs font-semibold px-3 py-2 rounded-lg">Cancelar edição</button>
                    </div>
                    <div id="percentage-exit-rules-list" class="space-y-2"></div>
                    <p id="percentage-exit-rules-empty" class="text-textSecondary text-xs text-center py-4">Nenhuma regra percentual cadastrada.</p>
                `;
                entrySourcesPanel.insertAdjacentElement('afterend', panel);
            }

            function syncPercentageRuleFormOptions() {
                const personSelect = document.getElementById('percentage-rule-person');
                const macroSelect = document.getElementById('percentage-rule-macro');
                const startInput = document.getElementById('percentage-rule-start');
                if (personSelect) {
                    const current = personSelect.value || '';
                    const people = getPeopleRecords();
                    personSelect.innerHTML = '<option value="">Todas as pessoas</option>' +
                        people.map((person) => `<option value="${escapeHtml(person.person)}">${escapeHtml(person.person)}</option>`).join('');
                    personSelect.value = current;
                }
                if (macroSelect) {
                    const current = macroSelect.value || '';
                    const macros = [...new Set(allRecords.filter((record) => record.type === 'macro').map((record) => record.macro_category).filter(Boolean))].sort();
                    macroSelect.innerHTML = macros.map((macro) => `<option value="${escapeHtml(macro)}">${escapeHtml(macro)}</option>`).join('');
                    macroSelect.value = current || (macros.includes('RESERVA') ? 'RESERVA' : macros[0] || '');
                }
                syncPercentageRuleCategoryOptions();
                if (startInput && !startInput.value) startInput.value = thisMonth;
            }

            window.syncPercentageRuleCategoryOptions = function () {
                const macroSelect = document.getElementById('percentage-rule-macro');
                const categorySelect = document.getElementById('percentage-rule-category');
                if (!categorySelect) return;
                const current = categorySelect.value || '';
                const selectedMacro = macroSelect?.value || '';
                const categorySet = new Set();

                allRecords.forEach((record) => {
                    const macro = String(record.macro_category || '').trim();
                    const category = String(record.subcategory || record.category_name || '').trim();
                    if (!category) return;
                    if (selectedMacro && macro && macro !== selectedMacro) return;
                    categorySet.add(category);
                });

                getFiltered('saida', { archiveMode: 'all' }).forEach((record) => {
                    const macro = String(record.macro_category || '').trim();
                    const category = String(record.subcategory || record.description || '').trim();
                    if (!category) return;
                    if (selectedMacro && macro && macro !== selectedMacro) return;
                    categorySet.add(category);
                });

                const categories = [...categorySet].sort((a, b) => a.localeCompare(b, 'pt-BR'));
                if (current && !categories.some((category) => category.toLowerCase() === current.toLowerCase())) {
                    categories.push(current);
                }

                categorySelect.innerHTML = categories.length
                    ? categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')
                    : '<option value="">Nenhuma categoria encontrada</option>';
                categorySelect.value = current && categories.includes(current) ? current : (categories[0] || '');
            };

            function renderPercentageExitRules() {
                ensurePercentageExitRulesPanel();
                migrateLocalPercentageExitRulesToFirebase();
                syncPercentageRuleFormOptions();
                const list = document.getElementById('percentage-exit-rules-list');
                const empty = document.getElementById('percentage-exit-rules-empty');
                if (!list || !empty) return;
                loadPercentageExitRules();
                const rules = [...percentageExitRules].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                empty.classList.toggle('hidden', rules.length > 0);
                list.innerHTML = rules.map((rule) => `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3 flex items-center justify-between gap-3">
                        <div>
                            <p class="text-sm font-semibold text-textPrimary">${escapeHtml(rule.name)} • ${Number(rule.percentage).toFixed(2).replace('.', ',')}%</p>
                            <p class="text-xs text-textSecondary mt-1">${escapeHtml(rule.person || 'Todas as pessoas')} • ${getPercentageBaseLabel(rule.base)} • ${getCycleLabel(rule.cycle)} • ${escapeHtml(rule.macro)} / ${escapeHtml(rule.category)} • desde ${formatCompetence(rule.startCompetence)}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" data-edit-percentage-exit-rule="${rule.id}" title="Editar regra" class="p-2 rounded-lg text-textSecondary hover:text-accent hover:bg-surfaceLight transition-colors">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button type="button" data-delete-percentage-exit-rule="${rule.id}" class="px-3 py-1.5 text-xs rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors">Excluir</button>
                        </div>
                    </div>
                `).join('');
            }

            function clearPercentageExitRuleForm() {
                editingPercentageExitRuleId = '';
                ['percentage-rule-name', 'percentage-rule-rate', 'percentage-rule-category'].forEach((id) => {
                    const field = document.getElementById(id);
                    if (field) field.value = '';
                });
                const person = document.getElementById('percentage-rule-person');
                const base = document.getElementById('percentage-rule-base');
                const cycle = document.getElementById('percentage-rule-cycle');
                const status = document.getElementById('percentage-rule-status');
                const start = document.getElementById('percentage-rule-start');
                if (person) person.value = '';
                if (base) base.value = 'liquido';
                if (cycle) cycle.value = 'INICIO_MES';
                if (status) status.value = 'Em aberto';
                if (start) start.value = thisMonth;
                const label = document.getElementById('percentage-rule-save-label');
                const cancel = document.getElementById('percentage-rule-cancel-edit');
                if (label) label.textContent = 'Salvar regra';
                if (cancel) cancel.classList.add('hidden');
            }

            window.cancelEditPercentageExitRule = function () {
                clearPercentageExitRuleForm();
            };

            window.editPercentageExitRule = function (ruleId = '') {
                loadPercentageExitRules();
                const rule = percentageExitRules.find((item) => item.id === ruleId);
                if (!rule) return;
                editingPercentageExitRuleId = rule.id;
                syncPercentageRuleFormOptions();
                document.getElementById('percentage-rule-name').value = rule.name || '';
                document.getElementById('percentage-rule-person').value = rule.person || '';
                document.getElementById('percentage-rule-rate').value = rule.percentage || '';
                document.getElementById('percentage-rule-base').value = rule.base || 'liquido';
                document.getElementById('percentage-rule-macro').value = rule.macro || '';
                syncPercentageRuleCategoryOptions();
                document.getElementById('percentage-rule-category').value = rule.category || '';
                document.getElementById('percentage-rule-cycle').value = rule.cycle || 'INICIO_MES';
                document.getElementById('percentage-rule-status').value = rule.status || 'Em aberto';
                document.getElementById('percentage-rule-start').value = rule.startCompetence || thisMonth;
                const label = document.getElementById('percentage-rule-save-label');
                const cancel = document.getElementById('percentage-rule-cancel-edit');
                if (label) label.textContent = 'Atualizar regra';
                if (cancel) cancel.classList.remove('hidden');
                document.getElementById('percentage-rule-name')?.focus();
            };

            window.savePercentageExitRule = async function () {
                const previousRule = percentageExitRules.find((item) => item.id === editingPercentageExitRuleId);
                const rule = normalizePercentageExitRule({
                    id: editingPercentageExitRuleId || undefined,
                    name: document.getElementById('percentage-rule-name')?.value || '',
                    person: document.getElementById('percentage-rule-person')?.value || '',
                    percentage: document.getElementById('percentage-rule-rate')?.value || 0,
                    base: document.getElementById('percentage-rule-base')?.value || 'liquido',
                    macro: document.getElementById('percentage-rule-macro')?.value || 'RESERVA',
                    category: document.getElementById('percentage-rule-category')?.value || '',
                    cycle: document.getElementById('percentage-rule-cycle')?.value || 'INICIO_MES',
                    status: document.getElementById('percentage-rule-status')?.value || 'Em aberto',
                    startCompetence: document.getElementById('percentage-rule-start')?.value || thisMonth,
                    createdAt: previousRule?.createdAt
                });
                if (!rule.name) { showToast('Informe o nome da regra', true); return; }
                if (rule.percentage <= 0) { showToast('Informe um percentual valido', true); return; }
                if (!rule.category) { showToast('Informe a categoria da saida', true); return; }
                loadPercentageExitRules();
                const recordId = editingPercentageExitRuleId || getPercentageRuleFirebaseId(rule);
                const result = await upsertPercentageExitRule(rule, recordId);
                if (!result.isOk) { showToast('Erro ao salvar regra percentual', true); return; }
                const savedRule = { ...rule, id: result.id || recordId };
                clearLocalPercentageExitRulesBackup();
                if (editingPercentageExitRuleId) {
                    percentageExitRules = percentageExitRules.map((item) => item.id === editingPercentageExitRuleId ? savedRule : item);
                } else {
                    percentageExitRules.push(savedRule);
                }
                const wasEditing = Boolean(editingPercentageExitRuleId);
                clearPercentageExitRuleForm();
                renderPercentageExitRules();
                schedulePercentageExitMaterialization(
                    document.getElementById('f-comp-start')?.value || rule.startCompetence || thisMonth,
                    document.getElementById('f-comp-end')?.value || document.getElementById('f-comp-start')?.value || rule.startCompetence || thisMonth
                );
                renderCurrentTab();
                showToast(wasEditing ? 'Regra percentual atualizada!' : 'Regra fixa percentual salva!');
            };

            window.deletePercentageExitRule = async function (ruleId = '') {
                loadPercentageExitRules();
                const rule = percentageExitRules.find((item) => item.id === ruleId);
                if (rule && allRecords.some((record) => record.id === ruleId && isPercentageExitRuleRecord(record))) {
                    const result = await window.dataSdk.delete({ ...rule, id: ruleId, type: PERCENTAGE_EXIT_RULE_TYPE });
                    if (!result.isOk) { showToast('Erro ao remover regra percentual', true); return; }
                }
                clearLocalPercentageExitRulesBackup();
                percentageExitRules = percentageExitRules.filter((item) => item.id !== ruleId);
                renderPercentageExitRules();
                renderCurrentTab();
                showToast('Regra percentual removida!');
            };

            const settingsAccordionState = {};

            function getSettingsPanelTitle(panel) {
                return normalizeEntrySourceName(panel?.querySelector('h3')?.textContent || '');
            }

            function shouldUseSettingsAccordion(panel) {
                const title = getSettingsPanelTitle(panel).toLowerCase();
                return [
                    'parâmetros inss e irrf',
                    'parâmetros inss e irrf',
                    'pessoas',
                    'categorias macro',
                    'categorias personalizadas',
                    'configuracao de tipos de h.e.',
                    'configuração de tipos de h.e.',
                    'outras fontes de renda',
                    'regras fixas percentuais'
                ].some((candidate) => title.includes(candidate));
            }

            function setSettingsAccordionOpen(panel, open) {
                const content = panel.querySelector(':scope > .settings-accordion-content');
                const button = panel.querySelector('.settings-accordion-toggle');
                if (!content || !button) return;
                const key = panel.dataset.settingsAccordionKey || getSettingsPanelTitle(panel);
                settingsAccordionState[key] = Boolean(open);
                content.classList.toggle('hidden', !open);
                button.textContent = open ? '-' : '+';
                button.setAttribute('aria-expanded', String(open));
                button.title = open ? 'Ocultar informações' : 'Exibir informações';
            }

            function enhanceSettingsPanelAccordion(panel) {
                if (!panel || !shouldUseSettingsAccordion(panel)) return;
                const title = getSettingsPanelTitle(panel);
                const key = panel.dataset.settingsAccordionKey || title;
                panel.dataset.settingsAccordionKey = key;

                let content = panel.querySelector(':scope > .settings-accordion-content');
                if (!content) {
                    const header = panel.firstElementChild;
                    if (!header) return;
                    content = document.createElement('div');
                    content.className = 'settings-accordion-content mt-3';
                    while (header.nextSibling) {
                        content.appendChild(header.nextSibling);
                    }
                    panel.appendChild(content);
                }

                let button = panel.querySelector('.settings-accordion-toggle');
                if (!button) {
                    const header = panel.firstElementChild;
                    if (!header) return;
                    button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'settings-accordion-toggle shrink-0 w-8 h-8 rounded-lg border border-surfaceLight bg-surfaceLight/40 text-accent text-lg font-semibold leading-none hover:bg-accent hover:text-bg transition-colors';
                    button.setAttribute('aria-label', `Exibir informações de ${title}`);
                    button.onclick = () => setSettingsAccordionOpen(panel, button.getAttribute('aria-expanded') !== 'true');
                    header.classList.add('gap-3');
                    header.insertBefore(button, header.firstChild);
                }

                const shouldOpen = settingsAccordionState[key] === true;
                setSettingsAccordionOpen(panel, shouldOpen);
            }

            function applySettingsAccordions() {
                document.querySelectorAll('#view-configuracoes .space-y-6 > .bg-surface').forEach(enhanceSettingsPanelAccordion);
            }

            const _renderEntradasEnhanced = renderEntradas;
            renderEntradas = function () {
                ensureEntradasMonthNavigator();
                const input = document.getElementById('entradas-competence-filter');
                if (input && !input.value) input.value = thisMonth;
                _renderEntradasEnhanced();
                lucide.createIcons();
            };

            const _renderControleHorasEnhanced = renderControleHoras;
            renderControleHoras = function () {
                ensureControleHorasMonthNavigator();
                const input = document.getElementById('controle-horas-competencia');
                if (input && !input.value) input.value = thisMonth;
                _renderControleHorasEnhanced();
                lucide.createIcons();
            };

            const financeAppForSettingsSupplementals = window.financeApp;
            if (financeAppForSettingsSupplementals) {
                financeAppForSettingsSupplementals.settingsLegacySupplementals = financeAppForSettingsSupplementals.settingsLegacySupplementals || {};
                financeAppForSettingsSupplementals.settingsLegacySupplementals.renderEntrySourcesAndPercentage = function () {
                    ensureEntrySourcesSettingsPanel();
                    renderEntrySourcesSettings();
                    renderPercentageExitRules();
                    syncEntryIncomeSourceOptions();
                    applySettingsAccordions();
                    lucide.createIcons();
                };
            }

            function renderSettingsLegacySupplementals() {
                if (window.financeApp?.settingsLegacySupplementals?.renderEntrySourcesAndPercentage) {
                    window.financeApp.settingsLegacySupplementals.renderEntrySourcesAndPercentage();
                    return;
                }
                ensureEntrySourcesSettingsPanel();
                renderEntrySourcesSettings();
                renderPercentageExitRules();
                syncEntryIncomeSourceOptions();
                applySettingsAccordions();
                lucide.createIcons();
            }

            const _renderConfiguracoesEntrySources = renderConfiguracoes;
            renderConfiguracoes = function () {
                _renderConfiguracoesEntrySources();
                renderSettingsLegacySupplementals();
            };

            const _getFilteredWithPercentageRules = getFiltered;
            getFiltered = function (typeFilter, options = {}) {
                const baseRecords = _getFilteredWithPercentageRules(typeFilter, options);
                if (typeFilter && typeFilter !== 'saida') return baseRecords;
                if ((options.archiveMode || 'active') === 'archived') return baseRecords;

                const cStart = document.getElementById('f-comp-start')?.value || thisMonth;
                const cEnd = document.getElementById('f-comp-end')?.value || cStart;
                schedulePercentageExitMaterialization(cStart, cEnd);
                const person = document.getElementById('f-person')?.value || '';
                const macro = document.getElementById('f-macro')?.value || '';
                const cycle = document.getElementById('f-cycle')?.value || '';
                const generated = getPercentageRuleGeneratedRecords({ start: cStart, end: cEnd }).filter((record) => {
                    if (person && record.person !== person) return false;
                    if (macro && record.macro_category !== macro) return false;
                    if (cycle && record.cycle !== cycle) return false;
                    return true;
                });

                return dedupePercentageExitRecords(filterOrphanPercentageExitRecords([...baseRecords, ...generated]));
            };

            const _renderRowWithPercentageRules = renderRow;
            if (!document.documentElement.dataset.percentageExitRowActionsBound) {
                document.documentElement.dataset.percentageExitRowActionsBound = 'true';
                document.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-percentage-exit-action]');
                    if (!button) return;
                    event.preventDefault();
                    event.stopPropagation();
                    handlePercentageExitRowAction(button.dataset.percentageExitAction, button.dataset.percentageExitRecordId);
                });
            }

            renderRow = function (record) {
                if (!record?.generated_percentage_rule) return _renderRowWithPercentageRules(record);
                const statusBadge = record.status === 'Pago' ? 'bg-success/20 text-success' : 'bg-warn/20 text-warn';
                const recordId = escapeHtml(record.id || '');
                percentageExitRowActionRecords.set(String(record.id || ''), record);
                const archiveButtonTitle = isArchivedRecord(record) ? 'Reabrir fixo mensal' : 'Arquivar fixo mensal';
                const archiveIcon = isArchivedRecord(record) ? 'archive-restore' : 'archive';
                const archiveColor = isArchivedRecord(record) ? 'hover:text-accent' : 'hover:text-warn';
                return `<div class="mobile-list-row flex items-center gap-3 bg-surfaceLight/50 rounded-lg p-2.5 text-sm border border-accent/20">
                    <i data-lucide="percent" class="w-4 h-4 text-danger flex-shrink-0"></i>
                    <div class="mobile-list-main flex-1 min-w-0">
                        <p class="truncate font-medium">${escapeHtml(record.description || record.subcategory || '')}</p>
                        <p class="text-xs text-textSecondary">${escapeHtml(record.person || '')} • ${formatCompetence(record.competence)} • ${getCycleLabel(record.cycle)} • ${escapeHtml(record.macro_category || '')} • Regra fixa sobre ${getPercentageBaseLabel(record.percentage_base)}: ${fmt(record.percentage_base_amount)}</p>
                    </div>
                    <span class="mobile-list-status text-xs px-2 py-0.5 rounded-full ${statusBadge}">${escapeHtml(record.status || '')}</span>
                    <span class="mobile-list-value font-semibold text-danger whitespace-nowrap">${fmt(record.amount)}</span>
                    <div class="mobile-list-actions flex items-center gap-1">
                        <span class="px-2 py-1 text-[11px] rounded-lg bg-accent/10 text-accent">Fixo mensal</span>
                        <button type="button" data-percentage-exit-action="edit" data-percentage-exit-record-id="${recordId}" title="Editar fixo mensal" class="text-textSecondary hover:text-accent p-1">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button type="button" data-percentage-exit-action="toggle-paid" data-percentage-exit-record-id="${recordId}" title="${record.status === 'Pago' ? 'Reabrir fixo mensal' : 'Marcar como pago'}" class="text-textSecondary hover:text-success p-1">
                            <i data-lucide="${record.status === 'Pago' ? 'check-circle' : 'circle'}" class="w-4 h-4"></i>
                        </button>
                        <button type="button" data-percentage-exit-action="toggle-archive" data-percentage-exit-record-id="${recordId}" title="${archiveButtonTitle}" class="text-textSecondary ${archiveColor} p-1">
                            <i data-lucide="${archiveIcon}" class="w-4 h-4"></i>
                        </button>
                        <button type="button" data-delete-action="true" data-percentage-exit-action="delete" data-percentage-exit-record-id="${recordId}" title="Excluir fixo mensal" class="text-textSecondary hover:text-danger p-1">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>`;
            };

            function renderDashboardDetailModalRecords(records = []) {
                window.financeApp.financeUiAdapters.setHtml('dashboard-expense-category-list', records.length
                    ? records.map((record) => renderRow(record)).join('')
                    : '<p class="text-sm text-textSecondary text-center py-6">Nenhuma despesa encontrada para essa selecao.</p>');
                lucide.createIcons();
            }

            function renderDashboardDetailModalSummary(records = []) {
                const total = roundCurrency(records.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
                const paidCount = records.filter((item) => item.status === 'Pago').length;
                const openCount = records.filter((item) => item.status === 'Em aberto').length;
                window.financeApp.financeUiAdapters.setHtml('dashboard-expense-category-summary', `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
                        <p class="text-xs text-textSecondary">Total</p>
                        <p class="text-lg font-semibold text-danger mt-1">${fmt(total)}</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
                        <p class="text-xs text-textSecondary">Pagas</p>
                        <p class="text-lg font-semibold text-success mt-1">${paidCount}</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
                        <p class="text-xs text-textSecondary">Em aberto</p>
                        <p class="text-lg font-semibold text-warn mt-1">${openCount}</p>
                    </div>
                `);
            }

            function openDashboardExpenseRecordsWithActions(title = 'Detalhes', subtitle = '', records = []) {
                ensureDashboardExpenseCategoryModal();
                setDashboardDetailContext(title, records);
                document.getElementById('dashboard-expense-category-title').textContent = title;
                document.getElementById('dashboard-expense-category-subtitle').textContent = subtitle || `${records.length} despesa(s) no recorte atual`;
                renderDashboardDetailModalSummary(records);
                renderDashboardDetailModalRecords(records);
                window.financeApp.financeUiAdapters.showOverlay('dashboard-expense-category-modal');
            }

            openDashboardExpenseRecordsModal = function (title = 'Detalhes', subtitle = '', records = []) {
                openDashboardExpenseRecordsWithActions(title, subtitle, records);
            };

            openDashboardExpenseCategoryModal = function (mode = 'subcategory', label = '') {
                ensureDashboardExpenseCategoryModal();
                const normalizedLabel = String(label || '').trim();
                if (!normalizedLabel) return;

                const freshSaidas = getDashboardSaidasForBreakdownCharts();
                dashboardBreakdownCache = {
                    macro: groupDashboardBreakdownRecords(freshSaidas, 'macro'),
                    subcategory: groupDashboardBreakdownRecords(freshSaidas, 'subcategory'),
                    person: groupDashboardBreakdownRecords(freshSaidas, 'person')
                };
                const grouped = dashboardBreakdownCache[mode] || new Map();
                const records = (grouped.get(normalizedLabel) || [])
                    .sort((a, b) => `${b.competence || ''}${b.due_date || b.occurred_date || ''}`.localeCompare(`${a.competence || ''}${a.due_date || a.occurred_date || ''}`));

                const title = mode === 'person'
                    ? `Pessoa: ${normalizedLabel}`
                    : mode === 'macro'
                        ? `Categoria: ${normalizedLabel}`
                        : `Subcategoria: ${normalizedLabel}`;

                openDashboardExpenseRecordsWithActions(title, `${records.length} despesa(s) no recorte atual`, records);
            };

            window.ensureDashboardRangeControls = ensureDashboardRangeControls;
            window.repairDashboardExpenseBreakdownCharts = repairDashboardExpenseBreakdownCharts;

            function getDashboardSelectedCompetenceRange() {
                const startField = document.getElementById('f-comp-start');
                const endField = document.getElementById('f-comp-end');
                const start = normalizeCompetenceKey(startField?.value || thisMonth) || thisMonth;
                const end = normalizeCompetenceKey(endField?.value || start) || start;
                return start <= end
                    ? { start, end }
                    : { start, end: start };
            }

            function getDashboardSaidasForBreakdownCharts() {
                const { start: cStart, end: cEnd } = getDashboardSelectedCompetenceRange();
                const person = document.getElementById('f-person')?.value || '';
                const macro = document.getElementById('f-macro')?.value || '';
                const cycle = document.getElementById('f-cycle')?.value || '';
                const baseSaidas = getTransactionRecords({ type: 'saida', archiveMode: 'active' });
                const percentageSaidas = getPercentageRuleGeneratedRecords({ start: cStart, end: cEnd });

                return [...baseSaidas, ...percentageSaidas].filter((record) => {
                    const recordCompetence = normalizeCompetenceKey(record.competence || record.due_date || record.occurred_date || '');
                    if (record.status === 'Cancelado') return false;
                    if (!recordCompetence) return false;
                    if (cStart && recordCompetence < cStart) return false;
                    if (cEnd && recordCompetence > cEnd) return false;
                    if (person && record.person !== person) return false;
                    if (macro && record.macro_category !== macro) return false;
                    if (cycle && record.cycle !== cycle) return false;
                    return true;
                });
            }

            function groupDashboardBreakdownRecords(records = [], mode = 'subcategory') {
                const grouped = new Map();
                records.forEach((record) => {
                    const key = mode === 'person'
                        ? (record.person || 'Sem pessoa')
                        : mode === 'macro'
                            ? (record.macro_category || 'Sem categoria')
                            : (record.subcategory || record.description || 'Sem detalhe');
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key).push(record);
                });
                return grouped;
            }

            function repairDashboardExpenseBreakdownCharts() {
                const filteredSaidas = getDashboardSaidasForBreakdownCharts();
                dashboardBreakdownCache = {
                    macro: groupDashboardBreakdownRecords(filteredSaidas, 'macro'),
                    subcategory: groupDashboardBreakdownRecords(filteredSaidas, 'subcategory'),
                    person: groupDashboardBreakdownRecords(filteredSaidas, 'person')
                };
                const categoryCanvas = document.getElementById('chart-category');
                const detailCanvas = document.getElementById('chart-category-detail');
                const personCanvas = document.getElementById('chart-person');
                const detailTitle = detailCanvas?.closest('.glass')?.querySelector('h3');
                const subcategoryTotal = roundCurrency(filteredSaidas.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
                if (detailTitle) detailTitle.textContent = `Detalhe por Subcategoria • Total ${fmt(subcategoryTotal)}`;

                if (categoryCanvas) {
                    categoryCanvas.onclick = null;
                    const categoryGroups = [...dashboardBreakdownCache.macro.entries()]
                        .map(([label, records]) => ({
                            label,
                            records,
                            value: roundCurrency(records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0))
                        }))
                        .filter((item) => item.value > 0)
                        .sort((a, b) => b.value - a.value);
                    if (chartInstances.category) chartInstances.category.destroy();
                    chartInstances.category = new Chart(categoryCanvas, {
                        type: 'doughnut',
                        plugins: [dashboardDataLabelPlugin],
                        data: {
                            labels: categoryGroups.map((item) => item.label),
                            datasets: [{
                                data: categoryGroups.map((item) => item.value),
                                backgroundColor: ['#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa', '#2dd4bf'],
                                borderColor: currentTheme === 'dark' ? '#0f172a' : '#ffffff',
                                borderWidth: 3,
                                hoverOffset: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '62%',
                            layout: { padding: 8 },
                            plugins: {
                                dashboardDataLabelPlugin: { mode: 'doughnut-percentage' },
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        color: getThemeTextSecondaryColor(),
                                        font: { size: 10 },
                                        padding: 8,
                                        usePointStyle: true,
                                        pointStyle: 'circle',
                                        boxWidth: 8
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            const totalValue = context.dataset.data.reduce((sum, item) => sum + (Number(item) || 0), 0);
                                            const currentValue = Number(context.parsed) || 0;
                                            const percent = totalValue ? ((currentValue / totalValue) * 100).toFixed(1).replace('.', ',') : '0,0';
                                            return `${context.label}: ${fmt(currentValue)} (${percent}%)`;
                                        }
                                    }
                                }
                            },
                            onClick: (event, elements, chart) => {
                                if (!elements.length) return;
                                const index = elements[0].index;
                                const group = categoryGroups[index];
                                if (!group) return;
                                openDashboardExpenseRecordsWithActions(`Categoria: ${group.label}`, `${group.records.length} despesa(s) no recorte atual`, group.records);
                            }
                        }
                    });
                }

                if (detailCanvas) {
                    detailCanvas.onclick = null;
                    const topSubcategories = [...dashboardBreakdownCache.subcategory.entries()]
                        .map(([label, records]) => ({
                            label,
                            records,
                            value: roundCurrency(records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0))
                        }))
                        .sort((a, b) => b.value - a.value);
                    if (chartInstances.subcategory) chartInstances.subcategory.destroy();
                    if (chartInstances.categoryDetail) chartInstances.categoryDetail.destroy();
                    chartInstances.categoryDetail = new Chart(detailCanvas, {
                        type: 'bar',
                        plugins: [dashboardDataLabelPlugin],
                        data: {
                            labels: topSubcategories.map((item) => item.label),
                            datasets: [{
                                label: 'Saídas por subcategoria',
                                data: topSubcategories.map((item) => item.value),
                                backgroundColor: '#fb7185',
                                borderRadius: 8,
                                borderWidth: 0,
                                barPercentage: 0.72,
                                categoryPercentage: 0.86
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: { top: 12, right: 28 } },
                            plugins: {
                                legend: { display: false },
                                dashboardDataLabelPlugin: {
                                    color: '#e2e8f0',
                                    anchor: 'end',
                                    align: 'right',
                                    formatter: (value) => fmt(value),
                                    mode: 'bar-currency-horizontal'
                                }
                            },
                            scales: {
                                x: { display: false, grid: { display: false }, ticks: { display: false } },
                                y: {
                                    grid: { display: false },
                                    ticks: {
                                        color: getThemeTextSecondaryColor(),
                                        font: { size: 11 },
                                        autoSkip: false
                                    }
                                }
                            },
                            onClick: (event, elements, chart) => {
                                if (!elements.length) return;
                                const index = elements[0].index;
                                const group = topSubcategories[index];
                                if (!group) return;
                                openDashboardExpenseRecordsWithActions(`Subcategoria: ${group.label}`, `${group.records.length} despesa(s) no recorte atual`, group.records);
                            }
                        }
                    });
                }

                if (personCanvas) {
                    personCanvas.onclick = null;
                    const sortedPeople = [...dashboardBreakdownCache.person.entries()]
                        .map(([label, records]) => ({
                            label,
                            records,
                            value: roundCurrency(records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0))
                        }))
                        .sort((a, b) => b.value - a.value);
                    if (chartInstances.person) chartInstances.person.destroy();
                    chartInstances.person = new Chart(personCanvas, {
                        type: 'bar',
                        plugins: [dashboardDataLabelPlugin],
                        data: {
                            labels: sortedPeople.map((item) => item.label),
                            datasets: [{
                                label: 'Gastos',
                                data: sortedPeople.map((item) => item.value),
                                backgroundColor: '#38bdf8',
                                borderColor: '#0284c7',
                                borderWidth: 1,
                                borderRadius: 4,
                                barPercentage: 0.6,
                                categoryPercentage: 0.7
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: { right: 18 } },
                            plugins: {
                                legend: { display: false },
                                dashboardDataLabelPlugin: { mode: 'bar-currency-horizontal' }
                            },
                            scales: {
                                x: { grid: { display: false, drawBorder: false }, ticks: { display: false } },
                                y: { ticks: { color: getThemeTextSecondaryColor(), font: { size: 11 } }, grid: { display: false } }
                            },
                            onClick: (event, elements, chart) => {
                                if (!elements.length) return;
                                const index = elements[0].index;
                                const group = sortedPeople[index];
                                if (!group) return;
                                openDashboardExpenseRecordsWithActions(`Pessoa: ${group.label}`, `${group.records.length} despesa(s) no recorte atual`, group.records);
                            }
                        }
                    });
                }

                lucide.createIcons();
            }

            function renderDashboardMonthRange() {
                const startField = document.getElementById('f-comp-start');
                const endField = document.getElementById('f-comp-end');
                if (startField && !startField.value) startField.value = thisMonth;
                if (endField && !endField.value) endField.value = startField?.value || thisMonth;
                const { start, end } = getDashboardSelectedCompetenceRange();
                if (startField) startField.value = start;
                if (endField) endField.value = end;
                if (startField && endField && start > end) {
                    endField.value = start;
                }
                closeDashboardExpenseCategoryModal?.();
                renderDashboard();
                setTimeout(() => {
                    repairDashboardExpenseBreakdownCharts();
                    if (typeof renderTrendChartByDashboardFilter === 'function') renderTrendChartByDashboardFilter();
                }, 0);
                setTimeout(() => {
                    repairDashboardExpenseBreakdownCharts();
                    if (typeof renderTrendChartByDashboardFilter === 'function') renderTrendChartByDashboardFilter();
                }, 120);
            }

            function forceDashboardChartsForCurrentRange() {
                closeDashboardExpenseCategoryModal?.();
                renderDashboard();
                setTimeout(() => {
                    repairDashboardExpenseBreakdownCharts();
                    if (typeof renderTrendChartByDashboardFilter === 'function') renderTrendChartByDashboardFilter();
                }, 0);
                setTimeout(() => {
                    repairDashboardExpenseBreakdownCharts();
                    if (typeof renderTrendChartByDashboardFilter === 'function') renderTrendChartByDashboardFilter();
                }, 80);
            }

            function ensureDashboardRangeControls() {
                const startField = document.getElementById('f-comp-start');
                const endField = document.getElementById('f-comp-end');
                if (!startField || !endField || startField.dataset.rangeBound === 'true') return;
                startField.dataset.rangeBound = 'true';
                endField.dataset.rangeBound = 'true';
                if (!startField.value) startField.value = thisMonth;
                if (!endField.value) endField.value = startField.value;
                startField.removeAttribute('onchange');
                endField.removeAttribute('onchange');
                startField.onchange = () => renderDashboardMonthRange();
                endField.onchange = () => renderDashboardMonthRange();
                startField.addEventListener('input', renderDashboardMonthRange);
                endField.addEventListener('input', renderDashboardMonthRange);
            }

            shiftDashboardCompetenceRange = function (delta) {
                const startField = document.getElementById('f-comp-start');
                const endField = document.getElementById('f-comp-end');
                if (!startField || !endField) return;
                const baseStart = startField.value || thisMonth;
                const baseEnd = endField.value || baseStart;
                startField.value = shiftMonthValue(baseStart, Number(delta) || 0) || baseStart;
                endField.value = shiftMonthValue(baseEnd, Number(delta) || 0) || baseEnd;
                renderDashboardMonthRange();
            };

            const _resetRecordFormEntrySources = resetRecordForm;
            resetRecordForm = function (type = 'saida') {
                _resetRecordFormEntrySources(type);
                syncEntryIncomeSourceOptions();
                if (type === 'entrada' && !document.getElementById('form-earning-type')?.value) {
                    document.getElementById('form-earning-type').value = getBaseEntrySourceOptions(document.getElementById('form-earning-type'))[0] || '';
                }
                handleEarningTypeChange();
            };

            const _openEditRecordEntrySources = openEditRecord;
            openEditRecord = function (record) {
                if (record?.type === 'entrada' && record.earning_type) {
                    const select = document.getElementById('form-earning-type');
                    const sourceName = normalizeEntrySourceName(record.earning_type);
                    loadCustomEntrySources();
                    const knownSources = getAllEntrySourceOptions(select);
                    if (sourceName && !knownSources.some((name) => name.toLowerCase() === sourceName.toLowerCase())) {
                        customEntrySources.push(sourceName);
                        persistCustomEntrySources();
                    }
                }
                _openEditRecordEntrySources(record);
                syncEntryIncomeSourceOptions();
                if (record?.type === 'entrada') {
                    document.getElementById('form-earning-type').value = record.earning_type || document.getElementById('form-earning-type').value;
                    handleEarningTypeChange();
                }
            };

            loadCustomEntrySources();
            loadHiddenEntrySources();
            syncEntryIncomeSourceOptions();
            ensureEntradasMonthNavigator();
            ensureControleHorasMonthNavigator();
            ensureDashboardRangeControls();
        })();
