import {
  ArchiveExpense,
  ConsolidateMonthlyIncome,
  CreateExpense,
  CreateHourEntry,
  CreateIncome,
  CreateInstallmentSeries,
  CreateRecurrenceSeries,
  DeleteExpense,
  MarkExpenseAsPaid,
  UpdateExpense,
  UpdateHourEntry
} from '../useCases/financeRecordUseCases.js';
import { MaterializePercentageRulesForCompetence } from '../useCases/percentageRuleMaterializationUseCases.js';

export const COMMAND_CONTRACTS = Object.freeze({
  CreateExpenseCommand: {
    schemaVersion: 1,
    payload: ['record or expense form payload'],
    idempotency: 'optional'
  },
  UpdateExpenseCommand: {
    schemaVersion: 1,
    payload: ['id', 'record or fields'],
    idempotency: 'optional'
  },
  MarkExpenseAsPaidCommand: {
    schemaVersion: 1,
    payload: ['expenseId or id', 'paidAt optional'],
    idempotency: 'optional'
  },
  ArchiveExpenseCommand: {
    schemaVersion: 1,
    payload: ['expenseId or id'],
    idempotency: 'optional'
  },
  DeleteExpenseCommand: {
    schemaVersion: 1,
    payload: ['expenseId or id'],
    idempotency: 'optional'
  },
  CreateIncomeCommand: {
    schemaVersion: 1,
    payload: ['record or income form payload'],
    idempotency: 'optional'
  },
  ConsolidateMonthlyIncomeCommand: {
    schemaVersion: 1,
    payload: ['person', 'competencia'],
    idempotency: 'optional'
  },
  CreateInstallmentSeriesCommand: {
    schemaVersion: 1,
    payload: ['expense payload', 'installments', 'totalAmount', 'baseDueDate'],
    idempotency: 'optional'
  },
  CreateRecurrenceSeriesCommand: {
    schemaVersion: 1,
    payload: ['expense payload', 'recurrence', 'frequency', 'baseDueDate'],
    idempotency: 'optional'
  },
  CreateHourEntryCommand: {
    schemaVersion: 1,
    payload: ['person', 'competence', 'startTime', 'endTime'],
    idempotency: 'optional'
  },
  UpdateHourEntryCommand: {
    schemaVersion: 1,
    payload: ['id', 'fields'],
    idempotency: 'optional'
  },
  MaterializePercentageRulesForCompetenceCommand: {
    schemaVersion: 1,
    payload: ['competence', 'optionalRuleIds optional'],
    idempotency: 'required for writes'
  }
});

function runUseCase(useCase, { envelope, payload, dependencies = {}, repositories = {}, repository, authContext, now } = {}) {
  return useCase({
    input: payload,
    context: authContext,
    envelope,
    dependencies: {
      ...dependencies,
      repositories: {
        ...(dependencies.repositories || {}),
        ...repositories,
        financeRecords: repositories.financeRecords || dependencies.repositories?.financeRecords || repository
      }
    },
    now
  });
}

export const handleCreateExpense = (args) => runUseCase(CreateExpense, args);
export const handleUpdateExpense = (args) => runUseCase(UpdateExpense, args);
export const handleMarkExpenseAsPaid = (args) => runUseCase(MarkExpenseAsPaid, args);
export const handleArchiveExpense = (args) => runUseCase(ArchiveExpense, args);
export const handleDeleteExpense = (args) => runUseCase(DeleteExpense, args);
export const handleCreateIncome = (args) => runUseCase(CreateIncome, args);
export const handleConsolidateMonthlyIncome = (args) => runUseCase(ConsolidateMonthlyIncome, args);
export const handleCreateInstallmentSeries = (args) => runUseCase(CreateInstallmentSeries, args);
export const handleCreateRecurrenceSeries = (args) => runUseCase(CreateRecurrenceSeries, args);
export const handleCreateHourEntry = (args) => runUseCase(CreateHourEntry, args);
export const handleUpdateHourEntry = (args) => runUseCase(UpdateHourEntry, args);
export const handleMaterializePercentageRulesForCompetence = (args) => runUseCase(MaterializePercentageRulesForCompetence, args);

export function createFinanceCommandHandlers() {
  return {
    CreateExpenseCommand: handleCreateExpense,
    UpdateExpenseCommand: handleUpdateExpense,
    MarkExpenseAsPaidCommand: handleMarkExpenseAsPaid,
    ArchiveExpenseCommand: handleArchiveExpense,
    DeleteExpenseCommand: handleDeleteExpense,
    CreateIncomeCommand: handleCreateIncome,
    ConsolidateMonthlyIncomeCommand: handleConsolidateMonthlyIncome,
    CreateInstallmentSeriesCommand: handleCreateInstallmentSeries,
    CreateRecurrenceSeriesCommand: handleCreateRecurrenceSeries,
    CreateHourEntryCommand: handleCreateHourEntry,
    UpdateHourEntryCommand: handleUpdateHourEntry,
    MaterializePercentageRulesForCompetenceCommand: handleMaterializePercentageRulesForCompetence
  };
}
