export function installLegacyEventBindings(target = globalThis) {
  if (!target?.document) {
    return {
      bindStaticEvents: () => {},
      invoke: () => undefined
    };
  }
  if (target.__financeLegacyEventBindingsInstalled && target.financeEvents) return target.financeEvents;
  target.__financeLegacyEventBindingsInstalled = true;

  const boundKey = 'financeEventsBound';

  function invoke(name, ...args) {
    const fn = target[name];
    if (typeof fn === 'function') return fn(...args);
    return undefined;
  }

  function byId(id) {
    return target.document.getElementById(id);
  }

  function bind(id, eventName, handler) {
    const element = byId(id);
    if (!element || element.dataset[boundKey + eventName]) return;
    element.dataset[boundKey + eventName] = 'true';
    element.addEventListener(eventName, handler);
  }

  function bindClick(id, handler) {
    bind(id, 'click', handler);
  }

  function bindChange(id, handler) {
    bind(id, 'change', handler);
  }

  function bindInput(id, handler) {
    bind(id, 'input', handler);
  }

  function bindSubmit(id, handler) {
    bind(id, 'submit', handler);
  }

  function audit(action, details = {}) {
    target.auditAction?.(action, details);
  }

  function findRecordById(id) {
    if (!id) return null;
    return (Array.isArray(target.allRecords)
      ? target.allRecords.find((record) => String(record.id) === String(id))
      : null)
      || target.__financeGetPercentageExitRecord?.(id)
      || null;
  }

  function findRecordByTypeAndId(type, id) {
    if (!id || !Array.isArray(target.allRecords)) return null;
    return target.allRecords.find((record) => record.type === type && String(record.id) === String(id)) || null;
  }

  function bindStaticEvents() {
    bindSubmit('auth-form', (event) => invoke('handleAuthSubmit', event));
    bindClick('auth-toggle-button', () => invoke('toggleAuthMode'));

    bindClick('sidebar-overlay', () => invoke('toggleSidebar'));
    bindClick('btn-sidebar-close', () => invoke('toggleSidebar'));
    bindClick('btn-mobile-menu', () => invoke('toggleSidebar'));
    bindClick('btn-go-back', () => invoke('goBackTab'));
    bindClick('btn-dashboard-home', () => invoke('goToDashboardHome'));
    bindClick('btn-month-detail-back', () => invoke('goToDashboardHome'));

    const tabs = byId('main-tabs');
    if (tabs && !tabs.dataset.financeTabsBound) {
      tabs.dataset.financeTabsBound = 'true';
      tabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab]');
        if (!button || !tabs.contains(button)) return;
        invoke('switchTab', button.dataset.tab);
      });
    }

    bindClick('theme-toggle', () => invoke('toggleTheme'));
    bindClick('btn-new-record-header', () => invoke('openNewRecordFlow'));
    bindClick('btn-export-pdf', () => {
      audit('pdf.export', { tab: target.currentTab || '' });
      invoke('exportPDF');
    });

    bindClick('btn-planner', () => invoke('openPlannerModal'));
    bindClick('btn-advanced-filters', () => invoke('toggleAdvancedFilters'));
    bindClick('btn-clear-dashboard-filters', () => invoke('clearDashboardFilters'));
    bindClick('btn-dashboard-prev-month', () => invoke('shiftDashboardCompetenceRange', -1));
    bindClick('btn-dashboard-next-month', () => invoke('shiftDashboardCompetenceRange', 1));
    bindChange('f-comp-start', () => invoke('scheduleDashboardRender') ?? invoke('renderDashboard'));
    bindChange('f-comp-end', () => invoke('scheduleDashboardRender') ?? invoke('renderDashboard'));
    bindChange('f-person', () => invoke('scheduleDashboardRender') ?? invoke('renderDashboard'));
    bindChange('f-macro', () => invoke('scheduleDashboardRender') ?? invoke('renderDashboard'));
    bindChange('f-cycle', () => invoke('scheduleDashboardRender') ?? invoke('renderDashboard'));
    bindClick('btn-clear-card', () => invoke('setFocusedCard', null));

    bindClick('saidas-filter-active', () => invoke('setListArchiveFilter', 'saidas', 'active'));
    bindClick('saidas-filter-archived', () => invoke('setListArchiveFilter', 'saidas', 'archived'));
    bindClick('saidas-filter-all', () => invoke('setListArchiveFilter', 'saidas', 'all'));
    bindChange('saidas-payment-filter', (event) => invoke('setSaidasPaymentFilter', event.target.value));
    bindChange('saidas-person-filter', (event) => invoke('setSaidasPersonFilter', event.target.value));
    bindChange('saidas-cycle-filter', (event) => invoke('setSaidasCycleFilter', event.target.value));
    bindChange('saidas-macro-filter', (event) => invoke('setSaidasMacroFilter', event.target.value));
    bindChange('saidas-date-start-filter', (event) => invoke('setSaidasDateStartFilter', event.target.value));
    bindChange('saidas-date-end-filter', (event) => invoke('setSaidasDateEndFilter', event.target.value));
    bindInput('saidas-search', (event) => invoke('setListSearchFilter', 'saidas', event.target.value));
    bindClick('btn-new-saida', () => invoke('openNewRecordFlow', 'saida'));
    bindClick('btn-load-more-saidas', () => invoke('loadMoreRecords', 'saidas'));

    bindInput('entradas-search', (event) => invoke('setListSearchFilter', 'entradas', event.target.value));
    bindChange('entradas-competence-filter', () => invoke('renderEntradas'));
    bindClick('btn-new-entrada', () => invoke('openNewRecordFlow', 'entrada'));

    bindInput('controle-horas-search', () => invoke('renderControleHoras'));
    bindChange('controle-horas-competencia', () => invoke('renderControleHoras'));
    bindClick('btn-new-hour-control', () => invoke('openHourControlModal'));

    bindClick('btn-add-person', () => invoke('addPerson'));
    bindClick('btn-add-macro', () => invoke('addMacroCategory'));
    bindClick('btn-open-category-form', () => invoke('openCategoryForm'));
    bindClick('btn-open-overtime-type-modal', () => invoke('openOvertimeTypeModal'));
    bindClick('btn-remove-saidas', () => {
      audit('import.remove_saidas');
      invoke('removeSaidasSpreadsheet');
    });
    bindClick('btn-remove-all-saidas', () => {
      audit('finance_record.bulk_delete_saidas');
      invoke('removeAllSaidas');
    });
    bindClick('btn-import-saidas-force', () => {
      audit('import.saidas_start', { force: true });
      invoke('importSaidasSpreadsheet', true);
    });
    bindClick('btn-import-saidas', () => {
      audit('import.saidas_start', { force: false });
      invoke('importSaidasSpreadsheet');
    });
    bindClick('btn-clear-import-report', () => invoke('clearImportReport'));
    bindClick('btn-import-entradas-force', () => {
      audit('import.entradas_start', { force: true });
      invoke('importEntradasSpreadsheet', true);
    });
    bindClick('btn-import-entradas', () => {
      audit('import.entradas_start', { force: false });
      invoke('importEntradasSpreadsheet');
    });
    bindClick('btn-clear-entradas-import-report', () => invoke('clearEntradasImportReport'));
    bindClick('btn-archive-records', () => {
      audit('finance_record.bulk_archive', { cutoff: byId('archive-cutoff')?.value || '' });
      invoke('archiveRecordsByCompetence');
    });
    bindClick('btn-restore-archived-records', () => {
      audit('finance_record.bulk_restore', { cutoff: byId('archive-cutoff')?.value || '' });
      invoke('restoreArchivedRecordsByCompetence');
    });

    bindClick('btn-select-color-cyan', () => invoke('selectColor', '#38bdf8'));
    bindClick('btn-select-color-emerald', () => invoke('selectColor', '#34d399'));
    bindClick('btn-select-color-amber', () => invoke('selectColor', '#fbbf24'));
    bindClick('btn-select-color-rose', () => invoke('selectColor', '#f43f5e'));
    bindClick('btn-select-color-violet', () => invoke('selectColor', '#a78bfa'));
    bindClick('btn-select-color-pink', () => invoke('selectColor', '#ec4899'));
    bindClick('btn-close-category-form', () => invoke('closeCategoryForm'));
    bindClick('category-save-button', () => {
      audit('settings.category_save');
      invoke('saveCategory');
    });

    bindClick('btn-cancel-edit', () => invoke('cancelRecordEditing'));
    bindSubmit('form-new', (event) => invoke('handleSubmit', event));
    bindChange('form-type', () => invoke('toggleFormFields'));
    bindChange('form-expense-type', () => invoke('toggleExpenseType'));
    bindInput('form-amount', () => invoke('calculateInstallmentValue'));
    bindInput('form-installments', () => invoke('calculateInstallmentValue'));
    bindChange('form-person', () => invoke('syncPersonSalaryDefaults'));
    bindChange('form-macro', () => invoke('updateCategoryOptions'));
    bindChange('form-status', () => invoke('togglePaidAt'));
    bindClick('cycle-saida-inicio-mes', () => invoke('setFormCycle', 'INICIO_MES'));
    bindClick('cycle-saida-quinzena', () => invoke('setFormCycle', 'QUINZENA'));
    bindChange('form-installment-check', () => invoke('toggleInstallments'));
    bindChange('form-earning-type', () => invoke('handleEarningTypeChange'));
    bindChange('form-he-type', () => invoke('handleOvertimeTypeSelect'));
    ['form-he-start-time', 'form-he-end-time', 'form-he-hours', 'form-he-base-salary', 'form-he-monthly-hours'].forEach((id) => {
      bindInput(id, () => invoke('recalculateHourExtraValues'));
    });
    bindClick('cycle-entrada-inicio-mes', () => invoke('setFormCycle', 'INICIO_MES'));
    bindClick('cycle-entrada-quinzena', () => invoke('setFormCycle', 'QUINZENA'));

    bindClick('btn-close-add-person-modal', () => invoke('closeAddPersonModal'));
    bindClick('btn-save-person', () => {
      audit('settings.person_save');
      invoke('savePerson');
    });
    bindClick('btn-close-add-macro-modal', () => invoke('closeAddMacroModal'));
    bindClick('btn-save-macro', () => {
      audit('settings.macro_save');
      invoke('saveMacroCategory');
    });
    bindChange('overtime-type-financial', () => invoke('handleOvertimeFinancialToggle'));
    bindClick('btn-close-overtime-type-modal', () => invoke('closeOvertimeTypeModal'));
    bindClick('btn-save-overtime-type', () => {
      audit('settings.overtime_type_save');
      invoke('saveOvertimeType');
    });
    bindClick('btn-close-salary-history-modal', () => invoke('closeSalaryHistoryModal'));
    bindClick('btn-save-salary-history', () => {
      audit('settings.salary_history_save');
      invoke('saveSalaryHistoryRecord');
    });

    bindClick('btn-close-hour-control-modal', () => invoke('closeHourControlModal'));
    bindClick('btn-cancel-hour-control', () => invoke('closeHourControlModal'));
    bindClick('btn-save-hour-control', () => invoke('saveHourControlRecord'));
    bindChange('hour-person', () => invoke('updateHourControlCalculatedFields'));
    bindChange('hour-competence', () => invoke('updateHourControlCalculatedFields'));
    bindChange('hour-date', () => invoke('updateHourControlCalculatedFields'));
    bindChange('hour-type', () => invoke('handleHourControlTypeChange'));
    ['hour-start', 'hour-end', 'hour-break-start', 'hour-break-end', 'hour-percentage'].forEach((id) => {
      bindInput(id, () => invoke('updateHourControlCalculatedFields'));
    });
    bindChange('hour-bank-nature', () => invoke('updateHourControlCalculatedFields'));
    bindClick('btn-close-hour-detail-modal', () => invoke('closeHourDetailModal'));
    bindClick('btn-close-entry-detail-modal', () => invoke('closeEntryDetailModal'));

    bindClick('btn-cancel-delete', () => invoke('cancelDelete'));
    bindClick('btn-confirm-delete', () => invoke('confirmDelete'));
    bindClick('btn-cancel-delete-person', () => invoke('cancelDeletePerson'));
    bindClick('btn-confirm-delete-person', () => invoke('confirmDeletePerson'));
    bindClick('btn-cancel-delete-macro', () => invoke('cancelDeleteMacro'));
    bindClick('btn-confirm-delete-macro', () => invoke('confirmDeleteMacro'));

    if (!target.document.documentElement.dataset.financeDynamicEventsBound) {
      target.document.addEventListener('click', (event) => {
        const recordActionButton = event.target.closest('[data-finance-record-action]');
        if (recordActionButton) {
          const record = findRecordById(recordActionButton.dataset.financeRecordId);
          if (!record) return;
          event.preventDefault();
          event.stopPropagation();

          const action = recordActionButton.dataset.financeRecordAction;
          if (record.generated_percentage_rule && typeof target.__financeHandlePercentageExitRowAction === 'function') {
            const mappedAction = action === 'toggle-paid'
              ? 'toggle-paid'
              : action === 'toggle-archive'
                ? 'toggle-archive'
                : action;
            target.__financeHandlePercentageExitRowAction(mappedAction, record.id);
            return;
          }
          if (action === 'edit') invoke('openEditRecord', record);
          if (action === 'toggle-paid') invoke('togglePago', record);
          if (action === 'toggle-archive') invoke('toggleArchiveRecord', record);
          if (action === 'delete') invoke('askDelete', record);
          return;
        }

        const clearPaymentFilterButton = event.target.closest('[data-clear-saidas-payment-filter]');
        if (clearPaymentFilterButton) {
          invoke('setSaidasPaymentFilter', '');
          return;
        }

        const clearListDetailFilterButton = event.target.closest('[data-clear-list-detail-filter]');
        if (clearListDetailFilterButton) {
          invoke('clearListDetailFilter', clearListDetailFilterButton.dataset.clearListDetailFilter);
          return;
        }

        const entryDetailButton = event.target.closest('[data-open-entry-detail]');
        if (entryDetailButton) {
          invoke('openEntryDetailModal', entryDetailButton.dataset.openEntryDetail);
          return;
        }

        const entryDetailByPersonButton = event.target.closest('[data-open-entry-detail-person]');
        if (entryDetailByPersonButton) {
          invoke(
            'openEntryDetailModal',
            entryDetailByPersonButton.dataset.openEntryDetailPerson,
            entryDetailByPersonButton.dataset.openEntryDetailCompetence
          );
          return;
        }

        const hourDetailButton = event.target.closest('[data-open-hour-detail]');
        if (hourDetailButton) {
          invoke('openHourDetailModal', hourDetailButton.dataset.openHourDetail);
          return;
        }

        const toggleHourDetailsButton = event.target.closest('[data-toggle-hour-control-details-person]');
        if (toggleHourDetailsButton) {
          invoke(
            'toggleHourControlDetails',
            toggleHourDetailsButton.dataset.toggleHourControlDetailsPerson,
            toggleHourDetailsButton.dataset.toggleHourControlDetailsCompetence
          );
          return;
        }

        const deleteHourControlButton = event.target.closest('[data-delete-hour-control-record]');
        if (deleteHourControlButton) {
          invoke(
            'deleteHourControlRecord',
            deleteHourControlButton.dataset.deleteHourControlRecord,
            deleteHourControlButton.dataset.deleteHourControlKey
          );
          return;
        }

        const editHourControlButton = event.target.closest('[data-edit-hour-control-record]');
        if (editHourControlButton) {
          invoke(
            'openEditHourControlRecord',
            editHourControlButton.dataset.editHourControlRecord,
            editHourControlButton.dataset.editHourControlKey
          );
          return;
        }

        const editCategoryButton = event.target.closest('[data-open-edit-category]');
        if (editCategoryButton) {
          invoke('openEditCategory', editCategoryButton.dataset.openEditCategory);
          return;
        }

        const deleteCategoryButton = event.target.closest('[data-delete-category-id]');
        if (deleteCategoryButton) {
          const category = findRecordByTypeAndId('categoria', deleteCategoryButton.dataset.deleteCategoryId);
          if (category) invoke('askDelete', category);
          return;
        }

        const openOvertimeTypeButton = event.target.closest('[data-open-overtime-type]');
        if (openOvertimeTypeButton) {
          invoke('openOvertimeTypeModal', openOvertimeTypeButton.dataset.openOvertimeType);
          return;
        }

        const toggleOvertimeTypeButton = event.target.closest('[data-toggle-overtime-type]');
        if (toggleOvertimeTypeButton) {
          invoke('toggleOvertimeTypeStatus', toggleOvertimeTypeButton.dataset.toggleOvertimeType);
          return;
        }

        const deletePersonButton = event.target.closest('[data-delete-person-id]');
        if (deletePersonButton) {
          const person = findRecordByTypeAndId('pessoa', deletePersonButton.dataset.deletePersonId);
          if (person) invoke('askDeletePerson', person);
          return;
        }

        const deleteMacroButton = event.target.closest('[data-delete-macro-id]');
        if (deleteMacroButton) {
          const macro = findRecordByTypeAndId('macro', deleteMacroButton.dataset.deleteMacroId);
          if (macro) invoke('askDeleteMacro', macro);
          return;
        }

        const salaryHistoryButton = event.target.closest('[data-open-salary-history-id]');
        if (salaryHistoryButton) {
          invoke(
            'openSalaryHistoryModal',
            salaryHistoryButton.dataset.openSalaryHistoryId,
            salaryHistoryButton.dataset.openSalaryHistoryPerson
          );
          return;
        }

        const saveEntryDiscountButton = event.target.closest('[data-save-entry-discount-person]');
        if (saveEntryDiscountButton) {
          invoke(
            'saveEntryDiscountAdjustmentByEntry',
            saveEntryDiscountButton.dataset.saveEntryDiscountPerson,
            saveEntryDiscountButton.dataset.saveEntryDiscountCompetence
          );
          return;
        }

        const plannerShiftButton = event.target.closest('[data-shift-planner-month]');
        if (plannerShiftButton) {
          invoke('shiftPlannerMonth', Number(plannerShiftButton.dataset.shiftPlannerMonth || 0));
          return;
        }

        const plannerDateButton = event.target.closest('[data-select-planner-date]');
        if (plannerDateButton) {
          invoke('selectPlannerDate', plannerDateButton.dataset.selectPlannerDate);
          return;
        }

        const plannerDeleteButton = event.target.closest('[data-delete-planner-event]');
        if (plannerDeleteButton) {
          invoke('deletePlannerEvent', plannerDeleteButton.dataset.deletePlannerEvent);
          return;
        }

        const managedRoleButton = event.target.closest('[data-set-managed-user-role]');
        if (managedRoleButton) {
          invoke(
            'setManagedUserRole',
            managedRoleButton.dataset.setManagedUserRole,
            managedRoleButton.dataset.managedUserRole
          );
          return;
        }

        const managedExplicitStatusButton = event.target.closest('[data-set-managed-user-status]');
        if (managedExplicitStatusButton) {
          invoke(
            'setManagedUserStatus',
            managedExplicitStatusButton.dataset.setManagedUserStatus,
            managedExplicitStatusButton.dataset.managedUserStatus
          );
          return;
        }

        const managedStatusButton = event.target.closest('[data-toggle-managed-user-status]');
        if (managedStatusButton) {
          invoke('toggleManagedUserStatus', managedStatusButton.dataset.toggleManagedUserStatus);
          return;
        }

        const deleteEntrySourceButton = event.target.closest('[data-delete-entry-income-source]');
        if (deleteEntrySourceButton) {
          invoke('deleteEntryIncomeSource', deleteEntrySourceButton.dataset.deleteEntryIncomeSource);
          return;
        }

        const editPercentageRuleButton = event.target.closest('[data-edit-percentage-exit-rule]');
        if (editPercentageRuleButton) {
          invoke('editPercentageExitRule', editPercentageRuleButton.dataset.editPercentageExitRule);
          return;
        }

        const deletePercentageRuleButton = event.target.closest('[data-delete-percentage-exit-rule]');
        if (deletePercentageRuleButton) {
          audit('percentage_rule.delete_request', {
            rule_id: deletePercentageRuleButton.dataset.deletePercentageExitRule
          });
          invoke('deletePercentageExitRule', deletePercentageRuleButton.dataset.deletePercentageExitRule);
          return;
        }

        const controleHorasCycleButton = event.target.closest('[data-set-controle-horas-cycle]');
        if (controleHorasCycleButton) {
          invoke('setControleHorasCycleFilter', controleHorasCycleButton.dataset.setControleHorasCycle);
          return;
        }

        const legacyClickButton = event.target.closest('[data-legacy-click]');
        if (legacyClickButton) {
          if (legacyClickButton.dataset.legacyClick === 'savePercentageExitRule') {
            audit('percentage_rule.save_request');
          }
          invoke(legacyClickButton.dataset.legacyClick);
          return;
        }

        const clearFilterButton = event.target.closest('[data-clear-dashboard-filter]');
        if (clearFilterButton) {
          invoke('clearDashboardFilter', clearFilterButton.dataset.clearDashboardFilter);
          return;
        }

        const dashboardDetailButton = event.target.closest('[data-dashboard-open-detail]');
        if (dashboardDetailButton) {
          event.stopPropagation();
          invoke('openDashboardDetail', dashboardDetailButton.dataset.dashboardOpenDetail);
          return;
        }

        const dashboardCard = event.target.closest('[data-dashboard-card]');
        if (dashboardCard) {
          invoke('setFocusedCard', dashboardCard.dataset.dashboardCard);
          return;
        }

        const closeExpenseModalButton = event.target.closest('[data-close-dashboard-expense-modal]');
        if (closeExpenseModalButton) {
          invoke('closeDashboardExpenseCategoryModal');
        }
      });

      target.document.addEventListener('change', (event) => {
        const salaryInput = event.target.closest('[data-update-person-base-salary]');
        if (salaryInput) {
          invoke('updatePersonBaseSalary', salaryInput.dataset.updatePersonBaseSalary, salaryInput.value);
        }

        const receivingTypeInput = event.target.closest('[data-update-person-receiving-type]');
        if (receivingTypeInput) {
          invoke('updatePersonReceivingType', receivingTypeInput.dataset.updatePersonReceivingType, receivingTypeInput.value);
        }

        const legacyChangeInput = event.target.closest('[data-legacy-change]');
        if (legacyChangeInput) {
          invoke(legacyChangeInput.dataset.legacyChange);
        }
      });
      target.document.documentElement.dataset.financeDynamicEventsBound = 'true';
    }
  }

  if (target.document.readyState === 'loading') {
    target.document.addEventListener('DOMContentLoaded', bindStaticEvents, { once: true });
  } else {
    bindStaticEvents();
  }

  target.financeEvents = {
    bindStaticEvents,
    invoke
  };
  return target.financeEvents;
}
