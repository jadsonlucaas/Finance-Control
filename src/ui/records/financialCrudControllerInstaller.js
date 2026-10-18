import { createExpenseFormController } from './expenseFormController.js';
import { createIncomeFormController } from './incomeFormController.js';
import { createMemoryMutationAttemptStore } from './mutationAttemptStore.js';
import { createRecordMutationPresenter } from './recordMutationPresenter.js';
import { showToast as showModernToast } from '../toast.js';

function resolveAuthContext(target = globalThis) {
  const profile = target.currentUserProfile || {};
  const webUser = target.currentUser || target.auth?.currentUser || profile || { uid: 'web-user' };
  const webRole = target.currentUserRole || profile.role || 'user';
  const webAccountStatus = target.currentAccountStatus || profile.status || 'active';
  const webPermissions = target.currentUserPermissions || profile.permissions || [];
  const uid = webUser.uid || profile.uid || 'web-user';
  return {
    webUser: { ...webUser, uid },
    webRole,
    authContext: {
      actorUid: uid,
      uid,
      actorType: webRole === 'admin' ? 'admin' : 'user',
      role: webRole,
      accountStatus: webAccountStatus,
      ownerUid: uid,
      permissions: webPermissions
    }
  };
}

function useGatewayByDefault(target = globalThis) {
  return Boolean(target.currentUser || target.auth?.currentUser);
}

export function installFinancialCrudControllers(target = globalThis, options = {}) {
  const attemptStore = options.attemptStore || createMemoryMutationAttemptStore({
    createMutationAttemptContext: target.financeApp?.resilience?.createMutationAttemptContext,
    payloadMatchesMutationAttempt: target.financeApp?.resilience?.payloadMatchesMutationAttempt,
    now: options.now
  });
  const presenter = options.presenter || createRecordMutationPresenter({
    showToast: options.showToast || ((message, isError) => {
      if (typeof target.showToast === 'function') return target.showToast(message, isError);
      if (globalThis.document?.body) return showModernToast(message, isError);
      return globalThis.console?.[isError ? 'error' : 'log']?.(String(message || ''));
    }),
    resetForm: options.resetForm,
    refreshAfterMutation: options.refreshAfterMutation,
    reopenAfterEdit: options.reopenAfterEdit,
    now: options.now
  });
  const sharedDependencies = {
    gatewayProvider: () => options.gateway || target.financeApp?.applicationGateway || null,
    authContextProvider: () => resolveAuthContext(target).authContext,
    attemptStore,
    presenter,
    now: options.now
  };
  const expenseController = createExpenseFormController(sharedDependencies);
  const incomeController = createIncomeFormController(sharedDependencies);

  const api = {
    attemptStore,
    presenter,
    resolveAuthContext: () => resolveAuthContext(target),
    canUseGateway: () => useGatewayByDefault(target),
    createExpense: (payload, commandOptions = {}) => expenseController.createExpense(payload, {
      sourceReferenceId: 'entry-form',
      attemptKey: 'entry-form',
      useGateway: commandOptions.useGateway ?? useGatewayByDefault(target),
      ...commandOptions
    }),
    updateExpense: (input, commandOptions = {}) => expenseController.updateExpense(input, {
      sourceReferenceId: 'entry-form',
      attemptKey: `update-expense:${input?.id || input?.record?.id || 'record'}`,
      useGateway: commandOptions.useGateway ?? useGatewayByDefault(target),
      ...commandOptions
    }),
    markExpenseAsPaid: (input, commandOptions = {}) => expenseController.markExpenseAsPaid(input, {
      sourceReferenceId: 'record-list',
      attemptKey: `mark-paid:${input?.expenseId || input?.id || 'record'}`,
      useGateway: commandOptions.useGateway ?? useGatewayByDefault(target),
      ...commandOptions
    }),
    archiveExpense: (input, commandOptions = {}) => expenseController.archiveExpense(input, {
      sourceReferenceId: 'record-list',
      attemptKey: `archive-expense:${input?.expenseId || input?.id || 'record'}`,
      useGateway: commandOptions.useGateway ?? useGatewayByDefault(target),
      ...commandOptions
    }),
    deleteExpense: (input, commandOptions = {}) => expenseController.deleteExpense(input, {
      sourceReferenceId: 'record-list',
      attemptKey: `delete-expense:${input?.expenseId || input?.id || 'record'}`,
      useGateway: commandOptions.useGateway ?? useGatewayByDefault(target),
      ...commandOptions
    }),
    createIncome: (payload, commandOptions = {}) => incomeController.createIncome(payload, {
      sourceReferenceId: 'entry-form',
      attemptKey: 'entry-form',
      useGateway: commandOptions.useGateway ?? useGatewayByDefault(target),
      ...commandOptions
    })
  };

  target.financeApp = target.financeApp || {};
  target.financeApp.financialCrud = api;
  return api;
}
