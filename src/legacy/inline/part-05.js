function consolidarEntradaMensal(person = '', competencia = '') {
            const salaryInfo = getSalarioVigente(person, competencia);
            const banco = calcularSaldoBanco(person, competencia);
            return window.financeDomain.consolidateMonthlyEntry({
                records: allRecords,
                person,
                competencia,
                salaryInfo,
                banco,
                isReferenceSalaryRecord,
                calculateInss: calcularINSS,
                calculateIrrf: calcularIRRF
            });
            const salaryBase = roundCurrency(salaryInfo.salario || 0);
            const hourEntries = allRecords.filter((record) =>
                record?.type === 'controle_horas' &&
                record.person === person &&
                record.competence === competencia &&
                record.hour_entry_type === 'Hora Extra'
            );
            const monthlyEntries = allRecords.filter((record) =>
                record?.type === 'entrada' &&
                record.person === person &&
                record.competence === competencia &&
                !isReferenceSalaryRecord(record)
            );
            const horaExtra = roundCurrency(hourEntries.reduce((sum, item) => sum + (Number(item.financial_total || 0)), 0));
            const descontoRecords = getMonthlyDiscountRecords(person, competencia);
            const proventoRecords = monthlyEntries.filter((item) => {
                const label = String(item.subcategory || item.earning_type || '').toUpperCase();
                const macro = String(item.macro_category || '').toUpperCase();
                if (label.includes('HORA EXTRA')) return false;
                if (label.includes('INSS') || label.includes('IRRF') || label.includes('IRPF')) return false;
                if (macro.includes('DEDU')) return false;
                return true;
            });
            const salarioManual = salaryBase > 0 ? 0 : roundCurrency(proventoRecords
                .filter((item) => String(item.subcategory || item.earning_type || '').toUpperCase().includes('SAL'))
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const dsrProventos = roundCurrency(proventoRecords
                .filter((item) => String(item.subcategory || item.earning_type || item.description || '').toUpperCase().includes('DSR'))
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const outrosProventos = roundCurrency(proventoRecords
                .filter((item) => {
                    const label = String(item.subcategory || item.earning_type || item.description || '').toUpperCase();
                    return !label.includes('SAL') && !label.includes('DSR');
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const outrosDescontos = roundCurrency(descontoRecords
                .filter((item) => !String(item.subcategory || item.earning_type || '').toUpperCase().includes('INSS') && !String(item.subcategory || item.earning_type || '').toUpperCase().includes('IRRF') && !String(item.subcategory || item.earning_type || '').toUpperCase().includes('IRPF'))
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const salarioBaseFinal = roundCurrency(salaryBase + salarioManual);
            const baseTrabalho = roundCurrency(salarioBaseFinal + horaExtra + dsrProventos);
            const baseTotal = roundCurrency(baseTrabalho + outrosProventos);
            const inssRegistrado = descontoRecords.find((item) => String(item.subcategory || item.earning_type || '').toUpperCase().includes('INSS'));
            const irrfRegistrado = descontoRecords.find((item) => {
                const label = String(item.subcategory || item.earning_type || '').toUpperCase();
                return label.includes('IRRF') || label.includes('IRPF');
            });
            const inss = roundCurrency(inssRegistrado ? Number(inssRegistrado.amount || 0) : calcularINSS(baseTrabalho));
            const irrf = roundCurrency(irrfRegistrado ? Number(irrfRegistrado.amount || 0) : calcularIRRF(baseTrabalho, inss));
            const liquido = calcularLiquido({ salarioBase: salarioBaseFinal, horaExtra: roundCurrency(horaExtra + dsrProventos), outrosProventos, inss, irrf });
            const legacyBanco = calcularSaldoBanco(person, competencia);
            return { person, competencia, salaryBase: salarioBaseFinal, hourExtra: horaExtra, dsrProventos, outrosProventos, baseTrabalho, baseTotal, inss, irrf, outrosDescontos, liquido, banco: legacyBanco, salaryInfo, hourEntries, descontoRecords };
        }

        function getEntradasConsolidadas() {
            const archiveMode = listArchiveFilters.entradas || 'active';
            const searchTerm = normalizeListSearchValue(listSearchFilters.entradas);
            const competenceFilter = normalizeCompetenceKey(document.getElementById('entradas-competence-filter')?.value || '');
            const keys = new Set();
            allRecords.forEach((record) => {
                if (isArchivedRecord(record) && archiveMode === 'active') return;
                if (!isArchivedRecord(record) && archiveMode === 'archived') return;
                if (!record?.person || !record?.competence) return;
                if (!['entrada', 'controle_horas'].includes(record.type)) return;
                keys.add(`${record.person}|${record.competence}`);
            });
            const salaryCompetences = new Set([thisMonth]);
            if (competenceFilter) salaryCompetences.add(competenceFilter);

            allRecords
                .filter((record) => record.type === 'pessoa')
                .forEach((record) => {
                    salaryCompetences.forEach((competence) => {
                        const salaryInfo = getSalarioVigente(record.person, competence);
                        if (Number(salaryInfo?.salario || 0) > 0) {
                            keys.add(`${record.person}|${competence}`);
                        }
                    });
                });
            return [...keys]
                .map((key) => {
                    const [person, competence] = key.split('|');
                    return consolidarEntradaMensal(person, competence);
                })
                .filter((item) => item.salaryBase > 0 || item.hourExtra > 0 || item.outrosProventos > 0 || item.outrosDescontos > 0 || item.inss > 0 || item.irrf > 0)
                .filter((item) => !searchTerm || normalizeListSearchValue(`${item.person} ${item.competencia}`).includes(searchTerm))
                .sort((a, b) => `${b.competencia}|${b.person}`.localeCompare(`${a.competencia}|${a.person}`));
        }

        function openSalaryHistoryModal(personId, personName) {
            const modal = document.getElementById('salary-history-modal');
            const appRoot = document.getElementById('app');
            if (modal && appRoot && modal.parentElement?.id === 'view-configuracoes') appRoot.appendChild(modal);
            activeSalaryHistoryPersonId = personId;
            activeSalaryHistoryPersonName = personName;
            document.getElementById('salary-history-title').textContent = `Histórico Salarial • ${personName}`;
            document.getElementById('salary-history-amount').value = '';
            document.getElementById('salary-history-start').value = today;
            document.getElementById('salary-history-end').value = '';
            document.getElementById('salary-history-note').value = '';
            document.getElementById('salary-history-modal').classList.remove('hidden');
            renderSalaryHistoryList();
            lucide.createIcons();
        }

        function closeSalaryHistoryModal() {
            document.getElementById('salary-history-modal').classList.add('hidden');
            activeSalaryHistoryPersonId = '';
            activeSalaryHistoryPersonName = '';
        }

        function renderSalaryHistoryList() {
            const list = document.getElementById('salary-history-list');
            if (!list) return;
            const history = getSalaryHistoryRecords(activeSalaryHistoryPersonName);
            list.innerHTML = history.length
                ? history.map((item) => `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <p class="font-semibold text-sm">${fmt(item.salary_base)}</p>
                                <p class="text-xs text-textSecondary mt-1">${item.start_date || '-'} ${item.end_date ? `até ${item.end_date}` : '• vigente'}</p>
                            </div>
                            <span class="text-[11px] px-2 py-1 rounded-full ${item.end_date ? 'bg-surfaceLight text-textSecondary' : 'bg-success/10 text-success'}">${item.end_date ? 'Encerrado' : 'Vigente'}</span>
                        </div>
                        ${item.observation ? `<p class="text-xs text-textSecondary mt-2">${escapeHtml(item.observation)}</p>` : ''}
                    </div>
                `).join('')
                : '<p class="text-sm text-textSecondary text-center py-6">Nenhum histórico salarial cadastrado.</p>';
        }

        async function saveSalaryHistoryRecord() {
            const amount = Number(document.getElementById('salary-history-amount').value) || 0;
            const startDate = document.getElementById('salary-history-start').value || '';
            const endDate = document.getElementById('salary-history-end').value || '';
            const observation = document.getElementById('salary-history-note').value || '';
            if (!activeSalaryHistoryPersonId || !activeSalaryHistoryPersonName) return;
            if (!amount || amount <= 0) { showToast('Informe um salário válido', true); return; }
            if (!startDate) { showToast('Informe o início da vigência', true); return; }
            if (endDate && endDate < startDate) { showToast('Fim da vigência inválido', true); return; }

            const previousActiveRecords = getSalaryHistoryRecords(activeSalaryHistoryPersonName)
                .filter((item) => !item.end_date && item.start_date && item.start_date < startDate);

            for (const previous of previousActiveRecords) {
                const previousEnd = new Date(`${startDate}T00:00:00`);
                previousEnd.setDate(previousEnd.getDate() - 1);
                const resolvedEnd = previousEnd.toISOString().slice(0, 10);
                await window.dataSdk.update({ ...previous, id: previous.id, end_date: resolvedEnd });
            }

            const createResult = await window.dataSdk.create({
                type: 'salario_historico',
                person: activeSalaryHistoryPersonName,
                person_id: activeSalaryHistoryPersonId,
                salary_base: roundCurrency(amount),
                start_date: startDate,
                end_date: endDate,
                observation,
                created_at: new Date().toISOString()
            });
            if (!createResult.isOk) { showToast('Erro ao salvar histórico salarial', true); return; }

            const personRecord = allRecords.find((record) => record.id === activeSalaryHistoryPersonId && record.type === 'pessoa');
            if (personRecord) await window.dataSdk.update({ ...personRecord, id: personRecord.id, salary_base: roundCurrency(amount) });
            showToast('Histórico salarial atualizado!');
            renderSalaryHistoryList();
        }
