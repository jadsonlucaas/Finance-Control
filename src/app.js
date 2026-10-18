import '../styles/app.css';
import '../styles/style.css';
import { installFinancialSelectorGlobals } from './application/selectors/financialSelectors.js';
import { createApplicationDependencies } from './application/dependencies/createApplicationDependencies.js';
import { createDefaultApplicationGateway } from './application/gateway/defaultApplicationGateway.js';
import { installImportPipelineGlobals } from './application/imports/importPipelineRuntime.js';
import {
  createCustomHolidayStore,
  createPlannerLocalEventStore
} from './application/planner/plannerLocalEventStore.js';
import { executeWithResilience } from './application/resilience/executeWithResilience.js';
import { normalizeLazyLoadError } from './application/resilience/errorNormalization.js';
import { InMemoryErrorReporter } from './application/resilience/errorReporter.js';
import {
  createMutationAttemptContext,
  MUTATION_OUTCOME_STATE,
  payloadMatchesMutationAttempt,
  safeAttemptForStorage
} from './application/resilience/mutationAttemptContext.js';
import { ReconcileMutationAttempt } from './application/resilience/reconcileMutationAttempt.js';
import { createRetryPolicy } from './application/resilience/retryPolicy.js';
import { createPercentageRuleMaterializationRunner } from './application/useCases/percentageRuleMaterializationUseCases.js';
import { installMonthlyDetailSelectorGlobals } from './application/selectors/monthlyDetailSelectors.js';
import { loadLegacyClassicScripts } from './legacy/classicScripts.js';
import { installGlobalBridge } from './legacy/globalBridge.js';
import { installLucideIconScheduler } from './legacy/iconScheduler.js';
import { installRecordHelperGlobals } from './legacy/recordHelpers.js';
import { installCloudMemoryStorage } from './legacy/storageSync.js';
import { installThemeGlobals } from './legacy/theme.js';
import { FinanceRepository } from './domain/FinanceRepository.js';
import { installAccountLifecycleGlobals } from './domain/accountLifecycle.js';
import { installRecordPayloadBuilderGlobals } from './domain/recordPayloads.js';
import { createTaxEngine, legacyTaxParameterRepository } from './domain/taxes.js';
import { createWorkSessionEngine } from './domain/hours.js';
import { createFirebaseDataProvider } from './services/data/providers/firebaseDataProvider.js';
import { installFinanceRecordMutationGlobals } from './services/financeRecordMutations.js';
import { installLocalVisualLibraries } from './services/localVisualLibraries.js';
import { appState, installAppStateGlobals } from './state/appState.js';
import { installFinanceRecordIndexGlobals } from './state/financeRecordIndex.js';
import { installActionButtonGlobals } from './ui/components/actionButton.js';
import { installMetricCardGlobals } from './ui/components/metricCard.js';
import { installModalGlobals } from './ui/components/modal.js';
import { installCreateElementGlobals } from './ui/dom/createElement.js';
import { installLegacyEventBindings } from './ui/legacy-events.js';
import { installRecordFormReaderGlobals } from './ui/records/recordFormReader.js';
import { installRecordFormValidationGlobals } from './ui/records/recordFormValidation.js';
import { installRecordListRendererGlobals } from './ui/records/recordListRenderer.js';
import { installFinancialCrudControllers } from './ui/records/financialCrudControllerInstaller.js';
import { createResilienceViewPilots } from './ui/resilience/resiliencePilots.js';
import { installInitialTemplates } from './ui/templates/installInitialTemplates.js';

function markBootstrap(name, target = globalThis) {
  try {
    if (!target.performance?.getEntriesByName?.(name, 'mark')?.length) target.performance?.mark?.(name);
  } catch {}
}

function scheduleFirstScreenReadyMark(target = globalThis) {
  const mark = () => markBootstrap('finance-first-screen-ready', target);
  target.requestAnimationFrame ? target.requestAnimationFrame(() => target.requestAnimationFrame(mark)) : mark();
}

markBootstrap('finance-app-entry-start');

// Application composition entry point for the modular migration.
// The current production app still runs from index.html. Keep bootstrap free of
// automatic side effects until the inline handlers are migrated safely.
export function bootstrapApp() {
  markBootstrap('finance-bridge-install-start');
  installInitialTemplates(document);
  installLocalVisualLibraries(globalThis);
  installAppStateGlobals(globalThis, appState);
  FinanceRepository.setTarget(globalThis);
  installGlobalBridge(globalThis);
  installCloudMemoryStorage(globalThis);
  installPlannerStorageRuntime(globalThis);
  installLucideIconScheduler(globalThis);
  installThemeGlobals(globalThis);
  installAccountLifecycleGlobals(globalThis);
  installRecordHelperGlobals(globalThis);
  installFinanceRecordIndexGlobals(globalThis);
  installCreateElementGlobals(globalThis);
  installActionButtonGlobals(globalThis);
  installMetricCardGlobals(globalThis);
  installModalGlobals(globalThis);
  installRecordPayloadBuilderGlobals(globalThis);
  installFinanceRecordMutationGlobals(globalThis);
  installImportPipelineGlobals(globalThis);
  installLegacyEventBindings(globalThis);
  installRecordFormReaderGlobals(globalThis);
  installRecordFormValidationGlobals(globalThis);
  installRecordListRendererGlobals(globalThis);
  installImportacaoLazyLoader(globalThis);
  installFinancialSelectorGlobals(globalThis);
  installMonthlyDetailSelectorGlobals(globalThis);
  globalThis.lucide?.createIcons?.();

  globalThis.financeRepository = FinanceRepository;
  loadLegacyClassicScripts(globalThis)
    .then(() => {
      installHourControlLazyLoader(globalThis);
      installParcelamentosLazyLoader(globalThis);
      installPlannerLazyLoader(globalThis);
      installSettingsLazyLoader(globalThis);
      installReportExportLazyLoader(globalThis);
      markBootstrap('finance-shell-ready');
      scheduleFirstScreenReadyMark(globalThis);
      return installFirebaseServicesWhenReady(globalThis)
        .then((services) => {
          markBootstrap('finance-bootstrap-complete');
          return services;
        });
    })
    .catch((error) => {
      const normalized = normalizeLazyLoadError(error, { operation: 'bootstrap_legacy' });
      globalThis.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'bootstrap_legacy' });
      console.error('Falha ao inicializar legado', normalized.code);
    });

  return {
    status: 'legacy-compatible-build-ready'
  };
}

function normalizeTabName(tab = '') {
  return String(tab || '').replace(/^#?\//, '');
}

function isHourControlRoute(target = globalThis) {
  return normalizeTabName(target.location?.hash || '') === 'controle-horas'
    || normalizeTabName(target.currentTab || '') === 'controle-horas';
}

export function installHourControlLazyLoader(target = globalThis) {
  if (!target || target.financeApp?.hourControlActiveUi?.installed) return target.financeApp?.hourControlActiveUi;

  const app = target.financeApp || {};
  target.financeApp = app;
  const state = app.hourControlActiveUi || {};
  app.hourControlActiveUi = state;
  state.installed = true;
  app.hourControlActiveUiLoader = app.hourControlActiveUiLoader || (() => import('./ui/hours/loadHourControlActiveUi.js'));

  const loadActiveUi = async () => {
    if (target.saveHourControlRecord?.__financeModernHourControl === true) {
      return { installed: true, alreadyInstalled: true };
    }
    if (state.promise) return state.promise;

    state.promise = app.hourControlActiveUiLoader()
      .then((module) => module.loadAndInstallHourControlActiveUi(target))
      .then((result) => {
        target.dispatchEvent?.(new CustomEvent('financeHourControlActiveUiReady', { detail: { installed: Boolean(result) } }));
        return result;
      })
      .catch((error) => {
        state.promise = null;
        const normalized = normalizeLazyLoadError(error, { operation: 'hour_control_active_ui' });
        target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'hour_control_active_ui' });
        target.showToast?.('Nao foi possivel carregar Controle de Horas. Tente novamente.', true);
        throw normalized;
      });

    return state.promise;
  };

  app.loadHourControlActiveUi = loadActiveUi;

  const renderAfterLoad = () => loadActiveUi()
    .then(() => {
      if (isHourControlRoute(target)) target.renderControleHoras?.();
    })
    .catch(() => {});

  const previousSwitchTab = target.switchTab;
  if (typeof previousSwitchTab === 'function') {
    target.switchTab = function switchTabWithHourControlLazyLoad(tab, options = {}) {
      const result = previousSwitchTab.call(this, tab, options);
      if (normalizeTabName(tab) === 'controle-horas' && options.fromRouter) renderAfterLoad();
      return result;
    };
  }

  if (isHourControlRoute(target)) renderAfterLoad();
  return state;
}

function isParcelamentosRoute(target = globalThis) {
  return normalizeTabName(target.location?.hash || '') === 'parcelamentos'
    || normalizeTabName(target.currentTab || '') === 'parcelamentos';
}

function isImportacaoRoute(target = globalThis) {
  return normalizeTabName(target.location?.hash || '') === 'importacao'
    || normalizeTabName(target.currentTab || '') === 'importacao';
}

export function installReportExportLazyLoader(target = globalThis) {
  if (!target || target.financeApp?.reportExportActiveUi?.loaderInstalled) return target.financeApp?.reportExportActiveUi;

  const app = target.financeApp || {};
  target.financeApp = app;
  const state = app.reportExportActiveUi || {};
  app.reportExportActiveUi = state;
  state.loaderInstalled = true;
  app.reportExportActiveUiLoader = app.reportExportActiveUiLoader || (() => import('./ui/reports/loadReportExportActiveUi.js'));

  const previousExportPDF = target.exportPDF;
  const loadActiveUi = () => {
    state.promise = state.promise || app.reportExportActiveUiLoader()
      .then((module) => module.loadAndInstallReportExportActiveUi(target))
      .then((result) => {
        state.controller = result?.controller || state.controller;
        state.installed = true;
        return result;
      })
      .catch((error) => {
        state.promise = null;
        const normalized = normalizeLazyLoadError(error, { operation: 'report_export_active_ui' });
        target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'report_export_active_ui' });
        target.showToast?.('Nao foi possivel carregar Relatorio PDF. Tente novamente.', true);
        throw normalized;
      });
    return state.promise;
  };

  app.loadReportExportActiveUi = loadActiveUi;

  target.exportPDF = function exportPDFLazyBridge(...args) {
    return loadActiveUi()
      .then(() => target.exportPDF?.(...args))
      .catch(() => (typeof previousExportPDF === 'function' ? previousExportPDF.apply(this, args) : null));
  };
  Object.defineProperty(target.exportPDF, '__financeReportExportLazyPlaceholder', { value: true });
  return state;
}

export function installImportacaoLazyLoader(target = globalThis) {
  if (!target || target.financeApp?.importActiveUi?.loaderInstalled) return target.financeApp?.importActiveUi;

  const app = target.financeApp || {};
  target.financeApp = app;
  const state = app.importActiveUi || {};
  app.importActiveUi = state;
  state.loaderInstalled = true;
  app.importActiveUiLoader = app.importActiveUiLoader || (() => import('./ui/imports/loadImportActiveUi.js'));

  const loadActiveUi = () => {
    state.promise = state.promise || app.importActiveUiLoader()
      .then((module) => module.loadAndInstallImportActiveUi(target))
      .then((result) => {
        state.controller = result?.controller || state.controller;
        state.installed = true;
        return result;
      })
      .catch((error) => {
        state.promise = null;
        const normalized = normalizeLazyLoadError(error, { operation: 'import_active_ui' });
        target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'import_active_ui' });
        target.showToast?.('Nao foi possivel carregar Importacao. Tente novamente.', true);
        throw normalized;
      });
    return state.promise;
  };

  app.loadImportActiveUi = loadActiveUi;

  target.renderImportacao = function renderImportacaoLazyPlaceholder(...args) {
    return loadActiveUi()
      .then(() => target.renderImportacao?.(...args))
      .catch(() => null);
  };
  Object.defineProperty(target.renderImportacao, '__financeImportLazyPlaceholder', { value: true });

  if (isImportacaoRoute(target)) loadActiveUi().then(() => target.renderImportacao?.()).catch(() => {});
  return state;
}

function isSettingsRoute(target = globalThis) {
  return normalizeTabName(target.location?.hash || '') === 'configuracoes'
    || normalizeTabName(target.currentTab || '') === 'configuracoes';
}

export function installSettingsLazyLoader(target = globalThis) {
  if (!target || target.financeApp?.settingsActiveUi?.loaderInstalled) return target.financeApp?.settingsActiveUi;

  const app = target.financeApp || {};
  target.financeApp = app;
  const state = app.settingsActiveUi || {};
  app.settingsActiveUi = state;
  state.loaderInstalled = true;
  app.settingsActiveUiLoader = app.settingsActiveUiLoader || (() => import('./ui/settings/loadSettingsActiveUi.js'));

  const previousRenderConfiguracoes = target.renderConfiguracoes;
  const loadActiveUi = () => {
    state.promise = state.promise || app.settingsActiveUiLoader()
      .then((module) => module.loadAndInstallSettingsActiveUi(target))
      .then((result) => {
        state.controller = result?.controller || state.controller;
        state.installed = true;
        return result;
      })
      .catch((error) => {
        state.promise = null;
        const normalized = normalizeLazyLoadError(error, { operation: 'settings_active_ui' });
        target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'settings_active_ui' });
        target.showToast?.('Nao foi possivel carregar Configuracoes. Tente novamente.', true);
        throw normalized;
      });
    return state.promise;
  };

  app.loadSettingsActiveUi = loadActiveUi;

  target.renderConfiguracoes = function renderConfiguracoesLazyPlaceholder(...args) {
    return loadActiveUi()
      .then(() => target.renderConfiguracoes?.(...args))
      .catch(() => (typeof previousRenderConfiguracoes === 'function' ? previousRenderConfiguracoes.apply(this, args) : null));
  };
  Object.defineProperty(target.renderConfiguracoes, '__financeSettingsLazyPlaceholder', { value: true });

  if (isSettingsRoute(target)) loadActiveUi().then(() => target.renderConfiguracoes?.()).catch(() => {});
  return state;
}

export function installParcelamentosRenderer(target = globalThis) {
  return import('./ui/records/parcelamentosRenderer.js')
    .then((module) => module.installParcelamentosRenderer(target));
}

export function installParcelamentosLazyLoader(target = globalThis) {
  if (!target || target.financeApp?.parcelamentosRenderer?.installed) return target.financeApp?.parcelamentosRenderer;

  const app = target.financeApp || {};
  target.financeApp = app;
  const state = app.parcelamentosRenderer || {};
  app.parcelamentosRenderer = state;
  state.installed = true;
  app.parcelamentosRendererLoader = app.parcelamentosRendererLoader || (() => import('./ui/records/parcelamentosRenderer.js'));

  const loadRenderer = async () => {
    if (typeof target.renderParcelamentos === 'function' && target.renderParcelamentos.__financeLazyPlaceholder !== true) {
      return { installed: true, alreadyInstalled: true };
    }
    if (state.promise) return state.promise;

    state.promise = app.parcelamentosRendererLoader()
      .then((module) => module.installParcelamentosRenderer(target))
      .catch((error) => {
        state.promise = null;
        const normalized = normalizeLazyLoadError(error, { operation: 'parcelamentos_renderer' });
        target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'parcelamentos_renderer' });
        target.showToast?.('Nao foi possivel carregar Parcelamentos. Tente novamente.', true);
        throw normalized;
      });
    return state.promise;
  };

  app.loadParcelamentosRenderer = loadRenderer;

  const renderAfterLoad = () => loadRenderer()
    .then(() => {
      if (isParcelamentosRoute(target)) target.renderParcelamentos?.();
    })
    .catch(() => {});

  if (typeof target.renderParcelamentos !== 'function') {
    target.renderParcelamentos = function renderParcelamentosLazyPlaceholder() {
      renderAfterLoad();
    };
    Object.defineProperty(target.renderParcelamentos, '__financeLazyPlaceholder', { value: true });
  }

  const previousSwitchTab = target.switchTab;
  if (typeof previousSwitchTab === 'function') {
    target.switchTab = function switchTabWithParcelamentosLazyLoad(tab, options = {}) {
      const result = previousSwitchTab.call(this, tab, options);
      if (normalizeTabName(tab) === 'parcelamentos' && options.fromRouter) renderAfterLoad();
      return result;
    };
  }

  if (isParcelamentosRoute(target)) renderAfterLoad();
  return state;
}

export function installPlannerLazyLoader(target = globalThis) {
  if (!target || target.financeApp?.plannerActiveUi?.loaderInstalled) return target.financeApp?.plannerActiveUi;

  const app = target.financeApp || {};
  target.financeApp = app;
  const state = app.plannerActiveUi || {};
  app.plannerActiveUi = state;
  state.loaderInstalled = true;
  app.plannerActiveUiLoader = app.plannerActiveUiLoader || (() => import('./ui/planner/loadPlannerActiveUi.js'));

  const loadActiveUi = async () => {
    if (target.openPlannerModal?.__financeModernPlanner === true && state.controller) {
      return { installed: true, alreadyInstalled: true };
    }
    if (state.promise) return state.promise;

    state.promise = app.plannerActiveUiLoader()
      .then((module) => module.loadAndInstallPlannerActiveUi(target, {
        ownerProvider: createPlannerOwnerProvider(target),
        localEventStore: target.financeApp?.plannerStorage?.localEventStore,
        financialActions: createPlannerFinancialActions(target),
        readSource: createPlannerReadSource(target)
      }))
      .then((result) => {
        state.controller = result?.controller || state.controller;
        state.installed = true;
        return result;
      })
      .catch((error) => {
        state.promise = null;
        const normalized = normalizeLazyLoadError(error, { operation: 'planner_active_ui' });
        target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'planner_active_ui' });
        target.showToast?.('Nao foi possivel carregar o Planner. Tente novamente.', true);
        throw normalized;
      });
    return state.promise;
  };

  app.loadPlannerActiveUi = loadActiveUi;

  const previousOpenPlannerModal = target.openPlannerModal;
  target.openPlannerModal = function openPlannerModalLazyPlaceholder(...args) {
    return loadActiveUi()
      .then(() => target.openPlannerModal?.(...args))
      .catch(() => {
        if (typeof previousOpenPlannerModal === 'function') return previousOpenPlannerModal.apply(this, args);
        return null;
      });
  };
  Object.defineProperty(target.openPlannerModal, '__financePlannerLazyPlaceholder', { value: true });

  return state;
}

function createPlannerOwnerProvider(target = globalThis) {
  return () => target.currentUser?.uid
    || target.auth?.currentUser?.uid
    || target.authSdk?.getCurrentUser?.()?.uid
    || target.currentUserProfile?.uid
    || '';
}

function createPlannerAuthContext(target = globalThis) {
  const uid = createPlannerOwnerProvider(target)();
  const profile = target.currentUserProfile || {};
  const role = target.currentUserRole || profile.role || 'user';
  return {
    actorUid: uid,
    uid,
    actorType: role === 'admin' ? 'admin' : 'user',
    role,
    accountStatus: target.currentAccountStatus || profile.status || 'active',
    ownerUid: uid,
    permissions: target.currentUserPermissions || profile.permissions || []
  };
}

function createPlannerReadSource(target = globalThis) {
  const repository = target.financeApp?.applicationDependencies?.repositories?.financeRecords;
  return {
    read: async () => {
      if (repository?.list) {
        const result = await repository.list({}, createPlannerAuthContext(target));
        return { records: result.items || result.data || [] };
      }
      return { records: Array.isArray(target.allRecords) ? target.allRecords : [] };
    },
    subscribe: repository?.subscribe
      ? (query, onChange) => repository.subscribe(query || {}, (payload = {}) => onChange({ records: payload.items || payload.records || [] }))
      : null
  };
}

function createPlannerFinancialActions(target = globalThis) {
  return {
    updateExpense: (input, options) => target.financeApp?.financialCrud?.updateExpense?.(input, options),
    markExpenseAsPaid: (input, options) => target.financeApp?.financialCrud?.markExpenseAsPaid?.(input, options),
    archiveExpense: (input, options) => target.financeApp?.financialCrud?.archiveExpense?.(input, options),
    deleteExpense: (input, options) => target.financeApp?.financialCrud?.deleteExpense?.(input, options)
  };
}

function installPlannerStorageRuntime(target = globalThis) {
  if (!target?.localStorage || target.financeApp?.plannerStorage?.installed) return target.financeApp?.plannerStorage;
  const holidayStore = createCustomHolidayStore({ storage: target.localStorage });
  const localEventStore = createPlannerLocalEventStore({ storage: target.localStorage, holidayStore });
  const ownerProvider = createPlannerOwnerProvider(target);
  target.financeApp = target.financeApp || {};
  target.financeApp.plannerStorage = {
    installed: true,
    holidayStore,
    localEventStore,
    ownerProvider,
    listOwnerEvents: () => {
      try {
        return localEventStore.list({ ownerUid: ownerProvider() });
      } catch {
        return [];
      }
    },
    listOwnerHolidayDates: () => {
      try {
        return holidayStore.list({ ownerUid: ownerProvider() });
      } catch {
        return [];
      }
    },
    resetPlannerView: () => {
      target.financeApp?.plannerActiveUi?.controller?.destroy?.();
      const modal = target.document?.getElementById?.('planner-modal');
      modal?.classList?.add?.('hidden');
    }
  };
  return target.financeApp.plannerStorage;
}

export async function installFirebaseServicesWhenReady(target = globalThis) {
  if (target.__financeFirebaseServicesInstalled) return target.__financeFirebaseServicesPromise;

  target.__financeFirebaseServicesInstalled = true;
  markBootstrap('finance-auth-init-start', target);
  target.__financeFirebaseServicesPromise = (target.__financeFirebaseServicesModulePromise || import('./services/installFirebaseServices.js'))
    .then(({ installFirebaseServices }) => {
      const services = installFirebaseServices({ target });
      const rawDataSdk = target.__financeRawDataSdk || target.dataSdk;
      FinanceRepository.setTarget(target);
      FinanceRepository.setDataProvider(createFirebaseDataProvider(rawDataSdk));
      target.__financeRawDataSdk = rawDataSdk;
      target.dataSdk = FinanceRepository.createLegacySdkProxy(target);
      target.financeRepository = FinanceRepository;
      markBootstrap('finance-auth-init-end', target);
      return services;
    })
    .catch((error) => {
      target.__financeFirebaseServicesInstalled = false;
      markBootstrap('finance-auth-init-end', target);
      const normalized = normalizeLazyLoadError(error, { operation: 'install_firebase_services' });
      target.financeApp?.resilience?.errorReporter?.report?.({ error: normalized, operation: 'install_firebase_services' });
      console.error('Erro ao carregar servicos Firebase', normalized.code);
      throw normalized;
    });

  return target.__financeFirebaseServicesPromise;
}

export function installCoreGlobals(target = globalThis) {
  return installGlobalBridge(target);
}

export { installLocalVisualLibraries };

if (typeof window !== 'undefined') {
  const taxEngine = createTaxEngine(legacyTaxParameterRepository);
  const workSessionEngine = createWorkSessionEngine();
  const resilienceErrorReporter = new InMemoryErrorReporter();
  const resilienceViewPilots = createResilienceViewPilots();
  const applicationDependencies = createApplicationDependencies({
    mode: 'web',
    target: window,
    financeRecordDataSdk: FinanceRepository,
    errorReporter: resilienceErrorReporter
  });
  const applicationGateway = createDefaultApplicationGateway({ dependencies: applicationDependencies });
  const percentageRuleMaterializationRunner = createPercentageRuleMaterializationRunner(applicationDependencies);
  window.financeApp = {
    bootstrapApp,
    appState,
    applicationDependencies,
    applicationGateway,
    percentageRuleMaterializationRunner,
    taxEngine,
    workSessionEngine,
    legacyTaxParameterRepository,
    resilience: {
      errorReporter: resilienceErrorReporter,
      connectivity: applicationDependencies.services.connectivity,
      viewStates: resilienceViewPilots,
      executeWithResilience,
      createRetryPolicy,
      createMutationAttemptContext,
      payloadMatchesMutationAttempt,
      safeAttemptForStorage,
      ReconcileMutationAttempt,
      MUTATION_OUTCOME_STATE
    },
    installInitialTemplates,
    loadLegacyClassicScripts,
    installLocalVisualLibraries,
    installAppStateGlobals,
    installGlobalBridge,
    installCloudMemoryStorage,
    installLucideIconScheduler,
    installRecordHelperGlobals,
    installFinanceRecordIndexGlobals,
    installRecordPayloadBuilderGlobals,
    installFinanceRecordMutationGlobals,
    installImportPipelineGlobals,
    installRecordFormReaderGlobals,
    installRecordFormValidationGlobals,
    installRecordListRendererGlobals,
    installImportacaoLazyLoader,
    installReportExportLazyLoader,
    installFinancialSelectorGlobals,
    installMonthlyDetailSelectorGlobals,
    createApplicationDependencies,
    createDefaultApplicationGateway,
    installThemeGlobals,
    installAccountLifecycleGlobals,
    installCreateElementGlobals,
    installActionButtonGlobals,
    installMetricCardGlobals,
    installModalGlobals,
    createFirebaseDataProvider,
    FinanceRepository,
    installFirebaseServicesWhenReady,
    installCoreGlobals
  };
  installFinancialCrudControllers(window);
  bootstrapApp();
}
