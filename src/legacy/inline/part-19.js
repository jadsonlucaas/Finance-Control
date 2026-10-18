async function deleteHourControlRecord(recordId, groupKey) {
            const record = allRecords.find((item) => item?.id === recordId && item.type === 'controle_horas');
            if (!record) {
                showToast('Lançamento não encontrado', true);
                return;
            }

            const generatedEntry = typeof findGeneratedHourEntry === 'function'
                ? findGeneratedHourEntry(record)
                : null;
            if (generatedEntry) {
                const entryDeleteResult = await window.dataSdk.delete(generatedEntry);
                if (!entryDeleteResult?.isOk) {
                    showToast('A entrada automática vinculada não pôde ser removida. O lançamento de horas não foi excluído.', true);
                    return;
                }
            }

            const result = await window.dataSdk.delete(record);
            if (!result?.isOk) {
                showToast(`Erro ao excluir lançamento${result?.error ? `: ${result.error}` : ''}`, true);
                return;
            }

            allRecords = allRecords.filter((item) => item.id !== recordId && item.id !== generatedEntry?.id);
            showToast('Lançamento excluído!');
            renderControleHoras();
            if (document.getElementById('planner-modal')) renderPlannerModal();

            const remaining = allRecords.filter((item) =>
                item?.type === 'controle_horas' &&
                `${item.person}|${item.competence}` === groupKey
            );

            if (remaining.length) {
                openHourDetailModal(groupKey);
            } else {
                closeHourDetailModal();
            }
        }

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
                            ? fmt(item.financial_total || item.valorTotalCalculado || 0)
                            : `${String(item.bank_nature || '').toLowerCase().startsWith('d') ? '+' : '-'}${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}`;
                        return `<div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold ${isHoraExtra ? 'text-accent' : 'text-warn'}">${item.hour_control_type || item.hour_entry_type}${item.bank_nature ? ` • ${item.bank_nature}` : ''}</p><p class="text-xs text-textSecondary mt-1">${item.occurred_date || '-'} • ${item.start_time || item.horaInicial || '--:--'} às ${item.end_time || item.horaFinal || '--:--'} • ${item.hours_formatted || item.quantidadeHorasFormatada || formatHoursDecimal(item.hours_quantity || item.quantidadeHoras)}</p>${item.observation || item.description ? `<p class="text-xs text-textSecondary mt-1">${escapeHtml(item.observation || item.description)}</p>` : ''}</div><div class="flex items-start gap-3"><div class="text-right"><p class="text-sm font-semibold ${isHoraExtra ? 'text-success' : 'text-warn'}">${valueLabel}</p></div><button type="button" data-edit-hour-control-record="${item.id}" data-edit-hour-control-key="${key}" class="p-2 rounded-lg border border-surfaceLight text-textSecondary hover:text-accent hover:border-accent/40 transition-colors" title="Editar lançamento"><i data-lucide="pencil" class="w-4 h-4"></i></button><button type="button" data-delete-hour-control-record="${item.id}" data-delete-hour-control-key="${key}" class="p-2 rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/40 transition-colors" title="Excluir lançamento"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></div>`;
                    }).join('')}
                </div>
            `;
            modal?.classList.remove('hidden');
            lucide.createIcons();
        };
