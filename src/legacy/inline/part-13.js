function isDeductionLikeMacro(value = '') {
            return normalizeImportText(value).toUpperCase().includes('DEDU');
        }

        getMonthlyDiscountRecords = function (person = '', competencia = '') {
            return allRecords.filter((record) =>
                record?.type === 'entrada' &&
                record.person === person &&
                record.competence === competencia &&
                (record.entry_discount_adjustment === true || isDeductionLikeMacro(record.macro_category || ''))
            );
        };

        saveEntryDiscountAdjustmentByEntry = async function (person = '', competencia = '') {
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
                showToast(`Erro ao salvar desconto${result?.error ? `: ${result.error}` : ''}`, true);
                return;
            }

            const optimisticRecord = { ...existing, ...payload, id: existing?.id || `local_discount_${Date.now()}` };
            const recordIndex = allRecords.findIndex((record) =>
                record?.type === 'entrada' &&
                record.person === person &&
                record.competence === competencia &&
                record.entry_discount_adjustment === true
            );

            if (recordIndex >= 0) {
                allRecords[recordIndex] = optimisticRecord;
            } else {
                allRecords.push(optimisticRecord);
            }

            showToast('Desconto atualizado!');
            renderCurrentTab();
        };

        window.saveEntryDiscountAdjustmentByEntry = saveEntryDiscountAdjustmentByEntry;
