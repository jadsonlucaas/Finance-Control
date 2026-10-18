# Grafo de Consumidores do Loader Legado

Gerado em: 2026-09-12T18:03:38.339Z

Este grafo combina produtores conhecidos nos scripts classicos com busca textual em codigo, testes, templates e documentacao. Referencias documentais nao autorizam migracao nem bloqueiam remocao por si so; consumidores em runtime devem prevalecer.

## Resumo

- Scripts baseline analisados: 33
- Scripts no loader atual: 22
- Scripts removidos do loader atual: 11

## Producer -> Consumer(s)

### src/legacy-globals.js

- No loader atual: nao
- Produtores detectados: `addDashboardAggregationItem`, `calcularBancoHoras`, `calcularHoraExtra`, `calcularHoras`, `calcularINSS`, `calcularIRRF`, `calcularLiquido`, `consolidateMonthlyEntry`, `dashboardAggregationItems`, `fmt`, `fmtCompactCurrency`, `formatHoursDecimal`, `getMonthlyDiscountRecordsFromRecords`, `getMonthlyEntryRecordsFromRecords`, `getMonthlyHourExtraRecordsFromRecords`, `getTaxEngine`, `getWorkSessionEngine`, `normalizeCompetenceKey`, `normalizeCycleValue`, `normalizeImportText`, `normalizeStatusValue`, `parseCurrencyValue`, `parseOvertimePercent`, `parseTimeToMinutes`, `roundCurrency`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `addDashboardAggregationItem` | src/domain/dashboard.js:3 | modulo reutilizavel |
| `addDashboardAggregationItem` | src/domain/dashboard.js:46 | modulo reutilizavel |
| `addDashboardAggregationItem` | src/domain/dashboard.js:47 | modulo reutilizavel |
| `addDashboardAggregationItem` | src/domain/dashboard.js:48 | modulo reutilizavel |
| `addDashboardAggregationItem` | src/legacy/globalBridge.js:16 | codigo |
| `addDashboardAggregationItem` | src/legacy/globalBridge.js:60 | codigo |
| `addDashboardAggregationItem` | tests/domain/dashboard.test.js:3 | teste |
| `addDashboardAggregationItem` | tests/domain/dashboard.test.js:16 | teste |
| `addDashboardAggregationItem` | tests/domain/dashboard.test.js:17 | teste |
| `addDashboardAggregationItem` | tests/legacy/globalBridge.test.js:22 | teste |
| `calcularBancoHoras` | src/domain/finance.js:13 | modulo reutilizavel |
| `calcularBancoHoras` | src/domain/hours.js:11 | modulo reutilizavel |
| `calcularBancoHoras` | src/domain/workSession.js:356 | modulo reutilizavel |
| `calcularBancoHoras` | src/domain/workSession.js:481 | modulo reutilizavel |
| `calcularBancoHoras` | src/legacy/globalBridge.js:5 | codigo |
| `calcularBancoHoras` | src/legacy/globalBridge.js:54 | codigo |
| `calcularBancoHoras` | src/legacy/inline/part-03.js:2083 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-03.js:3738 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-04.js:66 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-04.js:101 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-06.js:118 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-20.js:548 | script legado |
| `calcularBancoHoras` | tests/application/readModels/hourControlReadModel.test.js:131 | teste |
| `calcularBancoHoras` | tests/architecture/hourControlModernization.test.js:27 | teste |
| `calcularBancoHoras` | tests/domain/hours.test.js:8 | teste |
| `calcularBancoHoras` | tests/domain/hours.test.js:78 | teste |
| `calcularBancoHoras` | tests/domain/hours.test.js:84 | teste |
| `calcularBancoHoras` | tests/legacy/globalBridge.test.js:16 | teste |
| `calcularBancoHoras` | tests/playwright/regression-local.spec.js:1743 | teste |
| `calcularBancoHoras` | tests/regression/high-risk-regression.test.js:17 | teste |
| `calcularBancoHoras` | tests/regression/high-risk-regression.test.js:410 | teste |
| `calcularBancoHoras` | scripts/hour-control-modernization-check.mjs:22 | script de tooling |
| `calcularBancoHoras` | scripts/hour-control-modernization-check.mjs:29 | script de tooling |
| `calcularBancoHoras` | docs/behavior-freeze.md:210 | documentacao |
| `calcularBancoHoras` | docs/hour-control-diagnostic.md:9 | documentacao |
| `calcularBancoHoras` | docs/hour-control-ui-modernization-diagnostic.md:20 | documentacao |
| `calcularBancoHoras` | docs/hour-control-ui-modernization-diagnostic.md:30 | documentacao |
| `calcularBancoHoras` | docs/regression-test-matrix.md:94 | documentacao |
| `calcularHoraExtra` | src/domain/finance.js:14 | modulo reutilizavel |
| `calcularHoraExtra` | src/domain/hours.js:12 | modulo reutilizavel |
| `calcularHoraExtra` | src/domain/workSession.js:327 | modulo reutilizavel |
| `calcularHoraExtra` | src/domain/workSession.js:480 | modulo reutilizavel |
| `calcularHoraExtra` | src/legacy/globalBridge.js:6 | codigo |
| `calcularHoraExtra` | src/legacy/globalBridge.js:53 | codigo |
| `calcularHoraExtra` | src/legacy/inline/part-03.js:3725 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-03.js:3818 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-04.js:56 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-06.js:64 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-06.js:107 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-07.js:48 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-20.js:101 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-27.js:144 | script legado |
| `calcularHoraExtra` | tests/application/readModels/hourControlReadModel.test.js:131 | teste |
| `calcularHoraExtra` | tests/architecture/dashboardReadModelModernization.test.js:28 | teste |
| `calcularHoraExtra` | tests/architecture/financialCrudModernization.test.js:26 | teste |
| `calcularHoraExtra` | tests/architecture/global-api-collisions.test.js:15 | teste |
| `calcularHoraExtra` | tests/architecture/hourControlModernization.test.js:27 | teste |
| `calcularHoraExtra` | tests/architecture/plannerModernization.test.js:33 | teste |
| `calcularHoraExtra` | tests/domain/hours.test.js:9 | teste |
| `calcularHoraExtra` | tests/domain/hours.test.js:62 | teste |
| `calcularHoraExtra` | tests/domain/hours.test.js:71 | teste |
| `calcularHoraExtra` | tests/legacy/globalBridge.test.js:15 | teste |
| `calcularHoraExtra` | tests/playwright/regression-local.spec.js:1742 | teste |
| `calcularHoraExtra` | tests/regression/high-risk-regression.test.js:17 | teste |
| `calcularHoraExtra` | tests/regression/high-risk-regression.test.js:403 | teste |
| `calcularHoraExtra` | tests/ui/financialCrudControllers.test.js:103 | teste |
| `calcularHoraExtra` | scripts/crud-modernization-check.mjs:20 | script de tooling |
| `calcularHoraExtra` | scripts/dashboard-modernization-check.mjs:30 | script de tooling |
| `calcularHoraExtra` | scripts/hour-control-modernization-check.mjs:22 | script de tooling |
| `calcularHoraExtra` | scripts/hour-control-modernization-check.mjs:29 | script de tooling |
| `calcularHoraExtra` | scripts/planner-modernization-check.mjs:34 | script de tooling |
| `calcularHoraExtra` | docs/behavior-freeze.md:209 | documentacao |
| `calcularHoraExtra` | docs/global-api-reduction-diagnostic.md:23 | documentacao |
| `calcularHoraExtra` | docs/global-api-reduction-diagnostic.md:112 | documentacao |
| `calcularHoraExtra` | docs/hour-control-diagnostic.md:9 | documentacao |
| `calcularHoraExtra` | docs/hour-control-diagnostic.md:11 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:12 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:20 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:29 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:42 | documentacao |
| ... | 1350 consumidores adicionais omitidos no relatorio | ... |

### src/services/libraryLoader.global.js

- No loader atual: nao
- Produtores detectados: `ensurePdfLibraries`, `ensureSpreadsheetLibrary`, `isAllowedExternalLibraryUrl`, `loadExternalLibrary`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `ensurePdfLibraries` | src/legacy/inline/part-03.js:4639 | script legado |
| `ensurePdfLibraries` | src/legacy/libraryLoaderBridge.js:34 | codigo |
| `ensurePdfLibraries` | src/legacy/libraryLoaderBridge.js:36 | codigo |
| `ensurePdfLibraries` | src/legacy/libraryLoaderBridge.js:59 | codigo |
| `ensurePdfLibraries` | src/legacy/libraryLoaderBridge.js:59 | codigo |
| `ensurePdfLibraries` | src/legacy/libraryLoaderBridge.js:60 | codigo |
| `ensurePdfLibraries` | src/services/libraryLoader.js:94 | codigo |
| `ensurePdfLibraries` | src/ui/reports/pdfAdapter.js:18 | ui/template |
| `ensurePdfLibraries` | src/ui/reports/pdfAdapter.js:18 | ui/template |
| `ensurePdfLibraries` | src/ui/reports/pdfAdapter.js:22 | ui/template |
| `ensurePdfLibraries` | src/ui/reports/pdfAdapter.js:22 | ui/template |
| `ensurePdfLibraries` | src/ui/reports/reportExportActiveUi.js:39 | ui/template |
| `ensurePdfLibraries` | src/ui/reports/reportExportActiveUi.js:39 | ui/template |
| `ensurePdfLibraries` | tests/legacy/libraryLoaderBridge.test.js:40 | teste |
| `ensurePdfLibraries` | tests/legacy/libraryLoaderBridge.test.js:46 | teste |
| `ensurePdfLibraries` | tests/playwright/regression-local.spec.js:1386 | teste |
| `ensurePdfLibraries` | tests/playwright/regression-local.spec.js:1422 | teste |
| `ensurePdfLibraries` | tests/playwright/regression-local.spec.js:1430 | teste |
| `ensurePdfLibraries` | tests/ui/pdfAdapter.test.js:27 | teste |
| `ensurePdfLibraries` | tests/ui/pdfAdapter.test.js:38 | teste |
| `ensurePdfLibraries` | tests/ui/pdfAdapter.test.js:41 | teste |
| `ensurePdfLibraries` | tests/ui/pdfAdapter.test.js:48 | teste |
| `ensurePdfLibraries` | scripts/library-loader-check.mjs:72 | script de tooling |
| `ensurePdfLibraries` | scripts/library-loader-check.mjs:84 | script de tooling |
| `ensurePdfLibraries` | scripts/pdf-export-modernization-check.mjs:50 | script de tooling |
| `ensurePdfLibraries` | docs/architecture-current-state.md:64 | documentacao |
| `ensurePdfLibraries` | docs/architecture-current-state.md:173 | documentacao |
| `ensurePdfLibraries` | docs/behavior-freeze.md:302 | documentacao |
| `ensurePdfLibraries` | docs/bootstrap-regression-diagnostic.md:39 | documentacao |
| `ensurePdfLibraries` | docs/bootstrap-regression-diagnostic.md:59 | documentacao |
| `ensurePdfLibraries` | docs/bootstrap-regression-diagnostic.md:64 | documentacao |
| `ensurePdfLibraries` | docs/bootstrap-regression-diagnostic.md:126 | documentacao |
| `ensurePdfLibraries` | docs/global-api-reduction-diagnostic.md:132 | documentacao |
| `ensurePdfLibraries` | docs/legacy-loader-exit-diagnostic.md:96 | documentacao |
| `ensurePdfLibraries` | docs/legacy-loader-exit-diagnostic.md:96 | documentacao |
| `ensurePdfLibraries` | docs/legacy-loader-exit-diagnostic.md:98 | documentacao |
| `ensurePdfLibraries` | docs/legacy-module-migration-roadmap.md:197 | documentacao |
| `ensurePdfLibraries` | docs/pdf-export-modernization-diagnostic.md:52 | documentacao |
| `ensurePdfLibraries` | docs/pdf-export-modernization-diagnostic.md:67 | documentacao |
| `ensurePdfLibraries` | docs/pdf-export-modernization-policy.md:21 | documentacao |
| `ensurePdfLibraries` | docs/performance-before-after.md:223 | documentacao |
| `ensureSpreadsheetLibrary` | src/legacy/inline/part-03.js:5946 | script legado |
| `ensureSpreadsheetLibrary` | src/legacy/inline/part-03.js:5974 | script legado |
| `ensureSpreadsheetLibrary` | src/legacy/libraryLoaderBridge.js:38 | codigo |
| `ensureSpreadsheetLibrary` | src/legacy/libraryLoaderBridge.js:40 | codigo |
| `ensureSpreadsheetLibrary` | src/legacy/libraryLoaderBridge.js:62 | codigo |
| `ensureSpreadsheetLibrary` | src/legacy/libraryLoaderBridge.js:62 | codigo |
| `ensureSpreadsheetLibrary` | src/legacy/libraryLoaderBridge.js:63 | codigo |
| `ensureSpreadsheetLibrary` | src/services/libraryLoader.js:100 | codigo |
| `ensureSpreadsheetLibrary` | src/ui/imports/importActiveUi.js:22 | ui/template |
| `ensureSpreadsheetLibrary` | src/ui/imports/importActiveUi.js:23 | ui/template |
| `ensureSpreadsheetLibrary` | tests/legacy/libraryLoaderBridge.test.js:41 | teste |
| `ensureSpreadsheetLibrary` | tests/legacy/libraryLoaderBridge.test.js:47 | teste |
| `ensureSpreadsheetLibrary` | tests/legacy/libraryLoaderBridge.test.js:74 | teste |
| `ensureSpreadsheetLibrary` | tests/legacy/libraryLoaderBridge.test.js:83 | teste |
| `ensureSpreadsheetLibrary` | tests/playwright/regression-local.spec.js:1133 | teste |
| `ensureSpreadsheetLibrary` | tests/services/libraryLoader.test.js:9 | teste |
| `ensureSpreadsheetLibrary` | tests/services/libraryLoader.test.js:105 | teste |
| `ensureSpreadsheetLibrary` | scripts/library-loader-check.mjs:71 | script de tooling |
| `ensureSpreadsheetLibrary` | scripts/library-loader-check.mjs:83 | script de tooling |
| `ensureSpreadsheetLibrary` | docs/architecture-current-state.md:64 | documentacao |
| `ensureSpreadsheetLibrary` | docs/architecture-current-state.md:159 | documentacao |
| `ensureSpreadsheetLibrary` | docs/behavior-freeze.md:276 | documentacao |
| `ensureSpreadsheetLibrary` | docs/bootstrap-regression-diagnostic.md:40 | documentacao |
| `ensureSpreadsheetLibrary` | docs/bootstrap-regression-diagnostic.md:59 | documentacao |
| `ensureSpreadsheetLibrary` | docs/bootstrap-regression-diagnostic.md:63 | documentacao |
| `ensureSpreadsheetLibrary` | docs/bootstrap-regression-diagnostic.md:126 | documentacao |
| `ensureSpreadsheetLibrary` | docs/global-api-reduction-diagnostic.md:132 | documentacao |
| `ensureSpreadsheetLibrary` | docs/import-ui-modernization-diagnostic.md:13 | documentacao |
| `ensureSpreadsheetLibrary` | docs/legacy-loader-exit-diagnostic.md:96 | documentacao |
| `ensureSpreadsheetLibrary` | docs/legacy-loader-exit-diagnostic.md:96 | documentacao |
| `ensureSpreadsheetLibrary` | docs/legacy-loader-exit-diagnostic.md:98 | documentacao |
| `ensureSpreadsheetLibrary` | docs/performance-before-after.md:223 | documentacao |
| `isAllowedExternalLibraryUrl` | src/legacy/libraryLoaderBridge.js:7 | codigo |
| `isAllowedExternalLibraryUrl` | src/legacy/libraryLoaderBridge.js:33 | codigo |
| `isAllowedExternalLibraryUrl` | src/legacy/libraryLoaderBridge.js:33 | codigo |
| `isAllowedExternalLibraryUrl` | src/legacy/libraryLoaderBridge.js:56 | codigo |
| `isAllowedExternalLibraryUrl` | src/legacy/libraryLoaderBridge.js:56 | codigo |
| `isAllowedExternalLibraryUrl` | src/legacy/libraryLoaderBridge.js:57 | codigo |
| `isAllowedExternalLibraryUrl` | src/services/libraryLoader.js:44 | codigo |
| ... | 42 consumidores adicionais omitidos no relatorio | ... |

### src/services/performanceMonitor.global.js

- No loader atual: nao
- Produtores detectados: `bindDashboardFilterCounters`, `bootstrap`, `compareReports`, `finishMeasure`, `getMemorySnapshot`, `getReport`, `getResourceSummary`, `getTimingSummary`, `installPaintObserver`, `now`, `readBaselines`, `recordMeasure`, `round`, `saveBaseline`, `summarizeMeasures`, `wrapFunction`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `bindDashboardFilterCounters` | src/services/performanceMonitor.js:174 | codigo |
| `bindDashboardFilterCounters` | src/services/performanceMonitor.js:321 | codigo |
| `bindDashboardFilterCounters` | src/services/performanceMonitor.js:330 | codigo |
| `bootstrap` | src/app.js:66 | codigo |
| `bootstrap` | src/app.js:110 | codigo |
| `bootstrap` | src/services/performanceMonitor.js:23 | codigo |
| `bootstrap` | src/services/performanceMonitor.js:273 | codigo |
| `bootstrap` | src/services/performanceMonitor.js:324 | codigo |
| `bootstrap` | tests/architecture/plannerModernization.test.js:37 | teste |
| `bootstrap` | tests/architecture/settingsModernization.test.js:27 | teste |
| `bootstrap` | tests/architecture/settingsModernization.test.js:39 | teste |
| `bootstrap` | tests/architecture/userAdminModernization.test.js:23 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:210 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:220 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:221 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:234 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:240 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:240 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:240 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:249 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:250 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:251 | teste |
| `bootstrap` | tests/playwright/regression-local.spec.js:252 | teste |
| `bootstrap` | tests/services/libraryLoader.test.js:54 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:46 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:102 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:113 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:131 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:131 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:131 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:133 | teste |
| `bootstrap` | tests/services/performanceMonitor.test.js:134 | teste |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:10 | script de tooling |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:134 | script de tooling |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:135 | script de tooling |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:139 | script de tooling |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:146 | script de tooling |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:147 | script de tooling |
| `bootstrap` | scripts/bootstrap-benchmark.mjs:149 | script de tooling |
| `bootstrap` | scripts/bootstrap-check.mjs:17 | script de tooling |
| `bootstrap` | scripts/bootstrap-check.mjs:79 | script de tooling |
| `bootstrap` | scripts/bootstrap-check.mjs:91 | script de tooling |
| `bootstrap` | scripts/library-loader-check.mjs:82 | script de tooling |
| `bootstrap` | scripts/library-loader-check.mjs:83 | script de tooling |
| `bootstrap` | scripts/library-loader-check.mjs:84 | script de tooling |
| `bootstrap` | scripts/library-loader-check.mjs:85 | script de tooling |
| `bootstrap` | scripts/performance-baseline.mjs:17 | script de tooling |
| `bootstrap` | scripts/performance-baseline.mjs:34 | script de tooling |
| `bootstrap` | scripts/performance-baseline.mjs:39 | script de tooling |
| `bootstrap` | docs/account-lifecycle.md:65 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:11 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:113 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:186 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:241 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:245 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:261 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:465 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:565 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:607 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:641 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:695 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:695 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:695 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:695 | documentacao |
| `bootstrap` | docs/architecture-current-state.md:703 | documentacao |
| `bootstrap` | docs/bootstrap-benchmark-methodology.md:7 | documentacao |
| `bootstrap` | docs/bootstrap-benchmark-methodology.md:7 | documentacao |
| `bootstrap` | docs/bootstrap-benchmark-methodology.md:28 | documentacao |
| `bootstrap` | docs/bootstrap-benchmark-methodology.md:57 | documentacao |
| `bootstrap` | docs/bootstrap-benchmark-methodology.md:132 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:49 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:66 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:70 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:101 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:109 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:127 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:138 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:175 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:185 | documentacao |
| `bootstrap` | docs/bootstrap-regression-diagnostic.md:191 | documentacao |
| ... | 980 consumidores adicionais omitidos no relatorio | ... |

### src/ui/legacy-ui.js

- No loader atual: nao
- Produtores detectados: `activateTab`, `byId`, `getState`, `hideElement`, `hideOverlay`, `renderListState`, `renderTotalBox`, `setHidden`, `setHtml`, `setNodes`, `setSidebarOpen`, `setText`, `showElement`, `showOverlay`, `showToast`, `toggleSidebar`, `updateBackButton`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `activateTab` | src/legacy/inline/part-03.js:219 | script legado |
| `activateTab` | src/ui/monthDetail/monthDetailEvents.js:9 | ui/template |
| `activateTab` | src/ui/monthDetail/monthDetailEvents.js:20 | ui/template |
| `activateTab` | src/ui/navigation/navigationCoordinator.js:1 | ui/template |
| `activateTab` | src/ui/navigation/navigationCoordinator.js:7 | ui/template |
| `activateTab` | src/ui/navigationTabs.js:5 | ui/template |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:13 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:15 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:62 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:107 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:109 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:118 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:129 | teste |
| `activateTab` | tests/architecture/financeUiConsumersCheck.test.js:149 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:616 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:617 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:618 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:619 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:622 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:623 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:624 | teste |
| `activateTab` | tests/playwright/regression-local.spec.js:625 | teste |
| `activateTab` | tests/ui/financeUiConsumerAdapters.test.js:132 | teste |
| `activateTab` | tests/ui/legacyUiBridge.test.js:147 | teste |
| `activateTab` | scripts/build-legacy-consumer-graph.mjs:190 | script de tooling |
| `activateTab` | scripts/build-legacy-consumer-graph.mjs:219 | script de tooling |
| `activateTab` | scripts/build-legacy-consumer-graph.mjs:219 | script de tooling |
| `activateTab` | scripts/build-legacy-consumer-graph.mjs:219 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:148 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:148 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:148 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:148 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:148 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:239 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:248 | script de tooling |
| `activateTab` | scripts/finance-ui-consumers-check.mjs:253 | script de tooling |
| `activateTab` | docs/bundle-analysis.md:220 | documentacao |
| `activateTab` | docs/bundle-analysis.md:220 | documentacao |
| `activateTab` | docs/bundle-analysis.md:220 | documentacao |
| `activateTab` | docs/finance-ui-consumer-migration-diagnostic.md:18 | documentacao |
| `activateTab` | docs/finance-ui-consumer-migration-diagnostic.md:27 | documentacao |
| `activateTab` | docs/finance-ui-critical-consumers-diagnostic.md:34 | documentacao |
| `activateTab` | docs/finance-ui-critical-consumers-diagnostic.md:34 | documentacao |
| `activateTab` | docs/finance-ui-critical-consumers-diagnostic.md:47 | documentacao |
| `activateTab` | docs/finance-ui-critical-consumers-diagnostic.md:47 | documentacao |
| `activateTab` | docs/finance-ui-remaining-consumers-diagnostic.md:14 | documentacao |
| `activateTab` | docs/finance-ui-remaining-consumers-diagnostic.md:17 | documentacao |
| `activateTab` | docs/finance-ui-remaining-consumers-diagnostic.md:57 | documentacao |
| `activateTab` | docs/finance-ui-remaining-consumers-diagnostic.md:90 | documentacao |
| `activateTab` | docs/finance-ui-remaining-consumers-diagnostic.md:90 | documentacao |
| `activateTab` | docs/finance-ui-remaining-consumers-diagnostic.md:90 | documentacao |
| `activateTab` | docs/legacy-loader-exit-diagnostic.md:100 | documentacao |
| `activateTab` | docs/legacy-loader-exit-diagnostic.md:140 | documentacao |
| `activateTab` | docs/legacy-loader-exit-diagnostic.md:142 | documentacao |
| `activateTab` | docs/legacy-loader-exit-diagnostic.md:142 | documentacao |
| `activateTab` | docs/legacy-loader-exit-diagnostic.md:142 | documentacao |
| `activateTab` | docs/legacy-loader-exit-policy.md:62 | documentacao |
| `activateTab` | docs/legacy-loader-exit-policy.md:62 | documentacao |
| `activateTab` | docs/legacy-ui-decomposition-diagnostic.md:34 | documentacao |
| `activateTab` | docs/legacy-ui-migration-policy.md:44 | documentacao |
| `activateTab` | docs/legacy-ui-migration-policy.md:44 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:21 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:33 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:34 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:36 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:50 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:50 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:53 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:60 | documentacao |
| `activateTab` | docs/navigation-canonical-verification.md:60 | documentacao |
| `activateTab` | docs/navigation-es-extraction-diagnostic.md:17 | documentacao |
| `activateTab` | docs/navigation-es-extraction-diagnostic.md:27 | documentacao |
| `activateTab` | docs/navigation-es-extraction-diagnostic.md:28 | documentacao |
| `activateTab` | docs/navigation-es-extraction-diagnostic.md:59 | documentacao |
| `activateTab` | docs/navigation-finance-ui-decoupling-diagnostic.md:16 | documentacao |
| `activateTab` | docs/navigation-finance-ui-decoupling-diagnostic.md:16 | documentacao |
| `activateTab` | docs/navigation-finance-ui-decoupling-diagnostic.md:26 | documentacao |
| `activateTab` | docs/navigation-finance-ui-decoupling-diagnostic.md:34 | documentacao |
| `activateTab` | docs/navigation-finance-ui-decoupling-diagnostic.md:47 | documentacao |
| `activateTab` | docs/navigation-finance-ui-decoupling-diagnostic.md:63 | documentacao |
| ... | 591 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-03.js

- No loader atual: sim
- Produtores detectados: `__financeDashboardHydratedFromCache`, `__financeDataVersion`, `addMacroCategory`, `addPerson`, `applySaidasListFilters`, `archiveRecordsByCompetence`, `askDelete`, `askDeleteMacro`, `askDeletePerson`, `beginBulkOperation`, `buildCompetenceSequence`, `buildEntradaImportRowKey`, `buildImportRowCoreKey`, `buildImportRowKey`, `buildPdfInsights`, `buildSpreadsheetImportReport`, `calcularSaldoBanco`, `calculateInstallmentValue`, `canMaintainReference`, `cancelDelete`, `cancelDeleteMacro`, `cancelDeletePerson`, `cancelRecordEditing`, `chunkArray`, `classifyExpenseGroup`, `clearDashboardFilter`, `clearDashboardFilters`, `clearEntradasImportReport`, `clearHourExtraForm`, `clearImportReport`, `clearListDetailFilter`, `closeAddMacroModal`, `closeAddPersonModal`, `closeCategoryForm`, `closeEntryDetailModal`, `closeHourControlModal`, `closeHourDetailModal`, `closeOvertimeTypeModal`, `closeSalaryHistoryModal`, `competenceToIsoDate`, `configureReferenceScopeInput`, `confirmDelete`, `confirmDeleteMacro`, `confirmDeletePerson`, `consolidarEntradaMensal`, `dashboardDataLabelPlugin`, `dateValueToTimestamp`, `decrementMapCount`, `drawPdfMetricCard`, `endBulkOperation`, `ensureDashboardChartLayout`, `ensureImportSupportRecords`, `ensureSharedCategoryExists`, `excelSerialToIsoDate`, `exportPDF`, `findOvertimeTypeById`, `flushDeferredSnapshot`, `formatCompetence`, `formatDayLabel`, `formatExactDateLabel`, `getActiveOvertimeTypes`, `getConsolidatedEntradas`, `getCurrentSalaryHighlight`, `getDashboardDetailContextRecords`, `getDashboardPersonBalances`, `getDaysInCompetenceMonth`, `getEditingRecord`, `getEntradasConsolidadas`, `getFiltered`, `getFilteredForCompetence`, `getFinancialStatusTone`, `getGroupedHourControlSummaries`, `getHourControlRecords`, `getHourExtraMonthlyHours`, `getHourExtraRecordDefaults`, `getListRecords`, `getListSearchHaystack`, `getMonthlyDetailConsolidatedEntradas`, `getPdfDashboardFinancialData`, `getPdfFilterLabels`, `getPdfFilteredRecords`, `getPdfHourSummary`, `getPeopleRecords`, `getPersonBaseSalary`, `getPersonRecord`, `getRecordSortDate`, `getReferenceScope`, `getReferenceScopeLabel`, `getRelevantCompetenceRange`, `getSaidaExactDate`, `getSaidaTrendDate`, `getSalarioVigente`, `getSalaryHistoryRecords`, `goBackTab`, `goToDashboardHome`, `handleEarningTypeChange`, `handleHourControlTypeChange`, `handleOvertimeFinancialToggle`, `handleOvertimeTypeSelect`, `handleSubmit`, `hasReferenceUsage`, `hydrateDashboardFromWarmCache`, `importEntradasSpreadsheet`, `importSaidasSpreadsheet`, `incrementMapCount`, `inferDashboardDetailFilter`, `initSdk`, `isDashboardExpenseDetailVisible`, `isHourExtraEarningType`, `loadMoreRecords`, `loadOvertimeTypes`, `mapEntradasSpreadsheetRows`, `mapSpreadsheetRows`, `matchesListSearch`, `normalizeCompetenceValue`, `normalizeEntradaDescription`, `normalizeListSearchValue`, `normalizeOvertimeType`, `openCategoryForm`, `openDashboardCategoryDetail`, `openDashboardDetail`, `openEditCategory`, `openEditRecord`, `openEntryDetailModal`, `openHourControlModal`, `openHourDetailModal`, `openMonthlyDetailTab`, `openNewRecordFlow`, `openOvertimeTypeModal`, `openSalaryHistoryModal`, `parseInstallmentValue`, `pdfBuildActionRecommendations`, `pdfBuildCauseDiagnosis`, `pdfBuildExecutiveSummary`, `pdfBuildManagementInsights`, `pdfBuildProjectionLines`, `pdfClassifyImpact`, `pdfDrawChip`, `pdfDrawExecutiveCard`, `pdfDrawMiniTable`, `pdfDrawRoundedBlock`, `pdfDrawStatusBadge`, `pdfDrawTextPanel`, `pdfExpenseText`, `pdfFormatHours`, `pdfFormatPercent`, `pdfFormatRatio`, `pdfFormatSignedHours`, `pdfGetEntradaValue`, `pdfGetExecutiveStatus`, `pdfGetRecordAmount`, `pdfGetRecordDateKey`, `pdfGetRecordType`, `pdfGetReportStatusMeta`, `pdfGetVariableRevenue`, `pdfIsFixedExpense`, `pdfIsInvestment`, `pdfIsNonEssential`, `pdfIsReserve`, `pdfIsTransfer`, `pdfNormalizeText`, `pdfStatusColor`, `pdfTopExpenseLabel`, `persistOvertimeTypes`, `readDashboardWarmCache`, `readEntradasWorkbookFromInput`, `readSaidasWorkbookFromInput`, `recalculateHourExtraValues`, `referenceScopeBadge`, `refreshDashboardDetailAfterDataChange`, `removeAllSaidas`, `removeSaidasSpreadsheet`, `renderActiveDashboardFilters`, `renderAll`, `renderCategorias`, `renderConfiguracoes`, `renderControleHoras`, `renderCurrentTab`, `renderDailyTrendInsights`, `renderDashboard`, `renderDashboardLegacyFallback`, `renderDashboardPersonBalanceCards`, `renderEntradas`, `renderEntradasImportReport`, `renderImportReport`, `renderMetricBarList`, `renderMonthlyDetailRecords`, `renderMonthlyDetailSkeleton`, `renderMonthlyDetailTab`, `renderOvertimeTypesSettings`, `renderPdfChart`, `renderPersonFinancialBreakdown`, `renderRow`, `renderSaidas`, `renderSalaryHistoryList`, `renderSpreadsheetReport`, `renderTrendInsights`, `reopenDashboardDetailAfterSuccessfulEdit`, `resetRecordForm`, `restoreArchivedRecordsByCompetence`, `saveCategory`, `saveHourControlRecord`, `saveMacroCategory`, `saveOvertimeType`, `savePerson`, `saveSalaryHistoryRecord`, `scheduleMonthlyDetailWork`, `selectColor`, `setDashboardDetailContext`, `setFocusedCard`, `setFormCycle`, `setListArchiveFilter`, `setListSearchFilter`, `setSaidasCycleFilter`, `setSaidasDateEndFilter`, `setSaidasDateStartFilter`, `setSaidasMacroFilter`, `setSaidasPaymentFilter`, `setSaidasPersonFilter`, `shiftDashboardCompetenceRange`, `shiftMonthValue`, `showDeleteOverlay`, `showToast`, `sortRecordsNewestFirst`, `spreadsheetCandidateToReportRow`, `spreadsheetParserErrorsToReportRows`, `suggestCompetence`, `switchTab`, `syncOvertimeTypeOptions`, `syncPersonCurrentSalary`, `syncPersonSalaryDefaults`, `toggleAdvancedFilters`, `toggleArchiveRecord`, `toggleExpenseType`, `toggleFormFields`, `toggleInstallments`, `toggleOvertimeTypeStatus`, `togglePago`, `togglePaidAt`, `toggleSidebar`, `updateArchiveStateByCompetence`, `updateArchiveSummary`, `updateBackButton`, `updateBulkOperation`, `updateCategoryOptions`, `updateDashboardFilterChipState`, `updateFormModeUi`, `updateHourControlCalculatedFields`, `updateMacroFilters`, `updatePersonBaseSalary`, `updatePersonFilters`, `updateSaidasPaymentFilterOptions`, `validateOvertimeTypeForm`, `yieldToUi`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `__financeDashboardHydratedFromCache` | docs/global-api-inventory.md:41 | documentacao |
| `__financeDashboardHydratedFromCache` | docs/global-api-reduction-diagnostic.md:59 | documentacao |
| `__financeDataVersion` | src/legacy/inline/part-29.js:776 | script legado |
| `__financeDataVersion` | src/legacy/inline/part-29.js:776 | script legado |
| `__financeDataVersion` | src/state/financeRecordIndex.js:127 | codigo |
| `__financeDataVersion` | src/ui/dashboard/dashboardData.js:20 | ui/template |
| `__financeDataVersion` | src/ui/hours/hourControlActiveUi.js:277 | ui/template |
| `__financeDataVersion` | src/ui/hours/hourControlActiveUi.js:277 | ui/template |
| `__financeDataVersion` | src/ui/monthDetail/monthDetailData.js:10 | ui/template |
| `__financeDataVersion` | tests/architecture/global-api-collisions.test.js:9 | teste |
| `__financeDataVersion` | tests/playwright/regression-local.spec.js:35 | teste |
| `__financeDataVersion` | tests/playwright/regression-local.spec.js:35 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:385 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:385 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:921 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:921 | teste |
| `__financeDataVersion` | tests/state/financeRecordIndex.test.js:47 | teste |
| `__financeDataVersion` | tests/ui/monthDetailData.test.js:12 | teste |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:7 | documentacao |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:27 | documentacao |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:27 | documentacao |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:33 | documentacao |
| `__financeDataVersion` | docs/dashboard-read-model-modernization-policy.md:49 | documentacao |
| `__financeDataVersion` | docs/global-api-inventory.md:42 | documentacao |
| `__financeDataVersion` | docs/global-api-reduction-diagnostic.md:60 | documentacao |
| `__financeDataVersion` | docs/phase-5-part-03-migration.md:57 | documentacao |
| `addMacroCategory` | src/ui/legacy-events.js:126 | ui/template |
| `addMacroCategory` | src/ui/settings/settingsActiveUi.js:42 | ui/template |
| `addMacroCategory` | tests/smoke/smoke.mjs:329 | teste |
| `addMacroCategory` | docs/architecture-current-state.md:598 | documentacao |
| `addMacroCategory` | docs/behavior-freeze.md:239 | documentacao |
| `addMacroCategory` | docs/behavior-freeze.md:440 | documentacao |
| `addPerson` | src/legacy/inline/part-08.js:64 | script legado |
| `addPerson` | src/legacy/inline/part-14.js:44 | script legado |
| `addPerson` | src/ui/legacy-events.js:125 | ui/template |
| `addPerson` | src/ui/settings/settingsActiveUi.js:39 | ui/template |
| `addPerson` | tests/smoke/smoke.mjs:324 | teste |
| `addPerson` | docs/architecture-current-state.md:598 | documentacao |
| `addPerson` | docs/behavior-freeze.md:232 | documentacao |
| `addPerson` | docs/behavior-freeze.md:436 | documentacao |
| `archiveRecordsByCompetence` | src/ui/legacy-events.js:157 | ui/template |
| `archiveRecordsByCompetence` | docs/behavior-freeze.md:255 | documentacao |
| `askDelete` | src/legacy/inline/part-29.js:822 | script legado |
| `askDelete` | src/ui/dashboard/dashboardCards.js:126 | ui/template |
| `askDelete` | src/ui/legacy-events.js:261 | ui/template |
| `askDelete` | src/ui/legacy-events.js:338 | ui/template |
| `askDelete` | tests/playwright/regression-local.spec.js:783 | teste |
| `askDelete` | tests/smoke/smoke.mjs:295 | teste |
| `askDelete` | docs/behavior-freeze.md:148 | documentacao |
| `askDelete` | docs/behavior-freeze.md:406 | documentacao |
| `askDeleteMacro` | src/ui/legacy-events.js:364 | ui/template |
| `askDeleteMacro` | docs/behavior-freeze.md:242 | documentacao |
| `askDeletePerson` | src/ui/legacy-events.js:357 | ui/template |
| `askDeletePerson` | docs/behavior-freeze.md:235 | documentacao |
| `beginBulkOperation` | docs/behavior-freeze.md:368 | documentacao |
| `buildCompetenceSequence` | src/legacy/inline/part-29.js:875 | script legado |
| `buildPdfInsights` | docs/behavior-freeze.md:306 | documentacao |
| `calcularSaldoBanco` | src/application/entries/consolidatePersonMonthlyEntry.js:191 | modulo reutilizavel |
| `calcularSaldoBanco` | src/application/entries/consolidatePersonMonthlyEntry.js:192 | modulo reutilizavel |
| `calcularSaldoBanco` | src/legacy/inline/part-04.js:71 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-05.js:3 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-05.js:63 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-07.js:21 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-07.js:30 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-07.js:66 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-09.js:244 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-09.js:285 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-09.js:291 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-17.js:92 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-18.js:26 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-18.js:35 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-19.js:48 | script legado |
| `calcularSaldoBanco` | src/legacy/inline/part-20.js:601 | script legado |
| `calcularSaldoBanco` | docs/behavior-freeze.md:211 | documentacao |
| `calculateInstallmentValue` | src/ui/legacy-events.js:180 | ui/template |
| `calculateInstallmentValue` | src/ui/legacy-events.js:181 | ui/template |
| `calculateInstallmentValue` | docs/installment-rounding-diagnostic.md:15 | documentacao |
| `canMaintainReference` | src/application/readModels/settingsReadModel.js:36 | modulo reutilizavel |
| `canMaintainReference` | src/application/readModels/settingsReadModel.js:45 | modulo reutilizavel |
| `canMaintainReference` | src/application/readModels/settingsReadModel.js:46 | modulo reutilizavel |
| ... | 1479 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-04.js

- No loader atual: sim
- Produtores detectados: `calcularBancoHoras`, `calcularHoraExtra`, `calcularHoras`, `calcularINSS`, `calcularIRRF`, `calcularLiquido`, `calcularSaldoBanco`, `compareCompetence`, `getMonthlyDiscountRecords`, `getSalarioVigente`, `getSalaryHistoryRecords`, `getTaxEngine`, `normalizeCompetenceFromDate`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `calcularBancoHoras` | src/domain/finance.js:13 | modulo reutilizavel |
| `calcularBancoHoras` | src/domain/hours.js:11 | modulo reutilizavel |
| `calcularBancoHoras` | src/domain/workSession.js:356 | modulo reutilizavel |
| `calcularBancoHoras` | src/domain/workSession.js:481 | modulo reutilizavel |
| `calcularBancoHoras` | src/legacy/globalBridge.js:5 | codigo |
| `calcularBancoHoras` | src/legacy/globalBridge.js:54 | codigo |
| `calcularBancoHoras` | src/legacy/inline/part-03.js:2083 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-03.js:3738 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-06.js:118 | script legado |
| `calcularBancoHoras` | src/legacy/inline/part-20.js:548 | script legado |
| `calcularBancoHoras` | src/legacy-globals.js:120 | codigo |
| `calcularBancoHoras` | src/legacy-globals.js:122 | codigo |
| `calcularBancoHoras` | src/legacy-globals.js:122 | codigo |
| `calcularBancoHoras` | src/legacy-globals.js:285 | codigo |
| `calcularBancoHoras` | tests/application/readModels/hourControlReadModel.test.js:131 | teste |
| `calcularBancoHoras` | tests/architecture/hourControlModernization.test.js:27 | teste |
| `calcularBancoHoras` | tests/domain/hours.test.js:8 | teste |
| `calcularBancoHoras` | tests/domain/hours.test.js:78 | teste |
| `calcularBancoHoras` | tests/domain/hours.test.js:84 | teste |
| `calcularBancoHoras` | tests/legacy/globalBridge.test.js:16 | teste |
| `calcularBancoHoras` | tests/playwright/regression-local.spec.js:1743 | teste |
| `calcularBancoHoras` | tests/regression/high-risk-regression.test.js:17 | teste |
| `calcularBancoHoras` | tests/regression/high-risk-regression.test.js:410 | teste |
| `calcularBancoHoras` | scripts/hour-control-modernization-check.mjs:22 | script de tooling |
| `calcularBancoHoras` | scripts/hour-control-modernization-check.mjs:29 | script de tooling |
| `calcularBancoHoras` | docs/behavior-freeze.md:210 | documentacao |
| `calcularBancoHoras` | docs/hour-control-diagnostic.md:9 | documentacao |
| `calcularBancoHoras` | docs/hour-control-ui-modernization-diagnostic.md:20 | documentacao |
| `calcularBancoHoras` | docs/hour-control-ui-modernization-diagnostic.md:30 | documentacao |
| `calcularBancoHoras` | docs/regression-test-matrix.md:94 | documentacao |
| `calcularHoraExtra` | src/domain/finance.js:14 | modulo reutilizavel |
| `calcularHoraExtra` | src/domain/hours.js:12 | modulo reutilizavel |
| `calcularHoraExtra` | src/domain/workSession.js:327 | modulo reutilizavel |
| `calcularHoraExtra` | src/domain/workSession.js:480 | modulo reutilizavel |
| `calcularHoraExtra` | src/legacy/globalBridge.js:6 | codigo |
| `calcularHoraExtra` | src/legacy/globalBridge.js:53 | codigo |
| `calcularHoraExtra` | src/legacy/inline/part-03.js:3725 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-03.js:3818 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-06.js:64 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-06.js:107 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-07.js:48 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-20.js:101 | script legado |
| `calcularHoraExtra` | src/legacy/inline/part-27.js:144 | script legado |
| `calcularHoraExtra` | src/legacy-globals.js:101 | codigo |
| `calcularHoraExtra` | src/legacy-globals.js:104 | codigo |
| `calcularHoraExtra` | src/legacy-globals.js:104 | codigo |
| `calcularHoraExtra` | src/legacy-globals.js:284 | codigo |
| `calcularHoraExtra` | tests/application/readModels/hourControlReadModel.test.js:131 | teste |
| `calcularHoraExtra` | tests/architecture/dashboardReadModelModernization.test.js:28 | teste |
| `calcularHoraExtra` | tests/architecture/financialCrudModernization.test.js:26 | teste |
| `calcularHoraExtra` | tests/architecture/global-api-collisions.test.js:15 | teste |
| `calcularHoraExtra` | tests/architecture/hourControlModernization.test.js:27 | teste |
| `calcularHoraExtra` | tests/architecture/plannerModernization.test.js:33 | teste |
| `calcularHoraExtra` | tests/domain/hours.test.js:9 | teste |
| `calcularHoraExtra` | tests/domain/hours.test.js:62 | teste |
| `calcularHoraExtra` | tests/domain/hours.test.js:71 | teste |
| `calcularHoraExtra` | tests/legacy/globalBridge.test.js:15 | teste |
| `calcularHoraExtra` | tests/playwright/regression-local.spec.js:1742 | teste |
| `calcularHoraExtra` | tests/regression/high-risk-regression.test.js:17 | teste |
| `calcularHoraExtra` | tests/regression/high-risk-regression.test.js:403 | teste |
| `calcularHoraExtra` | tests/ui/financialCrudControllers.test.js:103 | teste |
| `calcularHoraExtra` | scripts/crud-modernization-check.mjs:20 | script de tooling |
| `calcularHoraExtra` | scripts/dashboard-modernization-check.mjs:30 | script de tooling |
| `calcularHoraExtra` | scripts/hour-control-modernization-check.mjs:22 | script de tooling |
| `calcularHoraExtra` | scripts/hour-control-modernization-check.mjs:29 | script de tooling |
| `calcularHoraExtra` | scripts/planner-modernization-check.mjs:34 | script de tooling |
| `calcularHoraExtra` | docs/behavior-freeze.md:209 | documentacao |
| `calcularHoraExtra` | docs/global-api-reduction-diagnostic.md:23 | documentacao |
| `calcularHoraExtra` | docs/global-api-reduction-diagnostic.md:112 | documentacao |
| `calcularHoraExtra` | docs/hour-control-diagnostic.md:9 | documentacao |
| `calcularHoraExtra` | docs/hour-control-diagnostic.md:11 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:12 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:20 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:29 | documentacao |
| `calcularHoraExtra` | docs/hour-control-ui-modernization-diagnostic.md:42 | documentacao |
| `calcularHoraExtra` | docs/regression-test-matrix.md:94 | documentacao |
| `calcularHoras` | src/domain/finance.js:15 | modulo reutilizavel |
| `calcularHoras` | src/domain/hours.js:13 | modulo reutilizavel |
| `calcularHoras` | src/domain/workSession.js:304 | modulo reutilizavel |
| `calcularHoras` | src/domain/workSession.js:479 | modulo reutilizavel |
| ... | 271 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-05.js

- No loader atual: sim
- Produtores detectados: `closeSalaryHistoryModal`, `consolidarEntradaMensal`, `getEntradasConsolidadas`, `openSalaryHistoryModal`, `renderSalaryHistoryList`, `saveSalaryHistoryRecord`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `closeSalaryHistoryModal` | src/legacy/inline/part-03.js:3648 | script legado |
| `closeSalaryHistoryModal` | src/ui/legacy-events.js:212 | ui/template |
| `closeSalaryHistoryModal` | docs/behavior-freeze.md:176 | documentacao |
| `consolidarEntradaMensal` | src/application/entries/index.js:30 | modulo reutilizavel |
| `consolidarEntradaMensal` | src/application/entries/index.js:30 | modulo reutilizavel |
| `consolidarEntradaMensal` | src/legacy/inline/part-03.js:1456 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-03.js:1475 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-03.js:2107 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-03.js:3892 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-07.js:43 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-09.js:254 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-14.js:127 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-27.js:205 | script legado |
| `consolidarEntradaMensal` | src/legacy/inline/part-29.js:691 | script legado |
| `consolidarEntradaMensal` | src/ui/dashboard/dashboardData.js:114 | ui/template |
| `consolidarEntradaMensal` | src/ui/dashboard/dashboardData.js:114 | ui/template |
| `consolidarEntradaMensal` | src/ui/dashboard/dashboardData.js:118 | ui/template |
| `consolidarEntradaMensal` | src/ui/dashboard/dashboardData.js:143 | ui/template |
| `consolidarEntradaMensal` | src/ui/dashboard/dashboardData.js:174 | ui/template |
| `consolidarEntradaMensal` | src/ui/monthDetail/monthDetailData.js:130 | ui/template |
| `consolidarEntradaMensal` | src/ui/monthDetail/monthDetailData.js:145 | ui/template |
| `consolidarEntradaMensal` | tests/architecture/global-api-collisions.test.js:24 | teste |
| `consolidarEntradaMensal` | tests/smoke/smoke.mjs:21 | teste |
| `consolidarEntradaMensal` | scripts/build-global-inventory.mjs:14 | script de tooling |
| `consolidarEntradaMensal` | docs/architecture-current-state.md:63 | documentacao |
| `consolidarEntradaMensal` | docs/behavior-freeze.md:173 | documentacao |
| `consolidarEntradaMensal` | docs/behavior-freeze.md:451 | documentacao |
| `consolidarEntradaMensal` | docs/global-api-inventory.md:30 | documentacao |
| `consolidarEntradaMensal` | docs/global-api-reduction-diagnostic.md:53 | documentacao |
| `consolidarEntradaMensal` | docs/heavy-project-audit.md:28 | documentacao |
| `consolidarEntradaMensal` | docs/heavy-project-audit.md:81 | documentacao |
| `consolidarEntradaMensal` | docs/heavy-project-audit.md:104 | documentacao |
| `consolidarEntradaMensal` | docs/heavy-project-audit.md:252 | documentacao |
| `consolidarEntradaMensal` | docs/heavy-project-audit.md:270 | documentacao |
| `consolidarEntradaMensal` | docs/legacy-module-migration-diagnostic.md:33 | documentacao |
| `consolidarEntradaMensal` | docs/percentage-rule-materialization-diagnostic.md:102 | documentacao |
| `consolidarEntradaMensal` | docs/phase-1-baseline.md:66 | documentacao |
| `consolidarEntradaMensal` | docs/use-case-layer-diagnostic.md:17 | documentacao |
| `getEntradasConsolidadas` | src/application/entries/index.js:43 | modulo reutilizavel |
| `getEntradasConsolidadas` | src/application/entries/index.js:43 | modulo reutilizavel |
| `getEntradasConsolidadas` | src/legacy/inline/part-03.js:2144 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-03.js:2145 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-07.js:81 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-09.js:298 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-10.js:4 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-11.js:79 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-12.js:3 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-15.js:53 | script legado |
| `getEntradasConsolidadas` | src/legacy/inline/part-16.js:641 | script legado |
| `getEntradasConsolidadas` | docs/global-api-inventory.md:56 | documentacao |
| `getEntradasConsolidadas` | docs/global-api-reduction-diagnostic.md:77 | documentacao |
| `openSalaryHistoryModal` | src/legacy/inline/part-03.js:3618 | script legado |
| `openSalaryHistoryModal` | src/legacy/inline/part-09.js:214 | script legado |
| `openSalaryHistoryModal` | src/legacy/inline/part-09.js:215 | script legado |
| `openSalaryHistoryModal` | src/ui/legacy-events.js:371 | ui/template |
| `openSalaryHistoryModal` | docs/behavior-freeze.md:175 | documentacao |
| `openSalaryHistoryModal` | docs/behavior-freeze.md:454 | documentacao |
| `openSalaryHistoryModal` | docs/hour-control-ui-modernization-diagnostic.md:16 | documentacao |
| `openSalaryHistoryModal` | docs/hour-control-ui-modernization-diagnostic.md:44 | documentacao |
| `renderSalaryHistoryList` | src/legacy/inline/part-03.js:3628 | script legado |
| `renderSalaryHistoryList` | src/legacy/inline/part-03.js:3633 | script legado |
| `renderSalaryHistoryList` | src/legacy/inline/part-03.js:3701 | script legado |
| `saveSalaryHistoryRecord` | src/legacy/inline/part-03.js:3653 | script legado |
| `saveSalaryHistoryRecord` | src/ui/legacy-events.js:215 | ui/template |
| `saveSalaryHistoryRecord` | docs/behavior-freeze.md:177 | documentacao |
| `saveSalaryHistoryRecord` | docs/behavior-freeze.md:455 | documentacao |
| `saveSalaryHistoryRecord` | docs/hour-control-ui-modernization-diagnostic.md:16 | documentacao |
| `saveSalaryHistoryRecord` | docs/hour-control-ui-modernization-diagnostic.md:44 | documentacao |

### src/legacy/inline/part-06.js

- No loader atual: sim
- Produtores detectados: `closeHourControlModal`, `getControleHorasRecords`, `getHourControlCalculationFromForm`, `handleHourControlTypeChange`, `openHourControlModal`, `saveHourControlRecord`, `syncHourControlPersonOptions`, `toggleHourControlDetails`, `updateHourControlCalculatedFields`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `closeHourControlModal` | src/legacy/inline/part-03.js:3707 | script legado |
| `closeHourControlModal` | src/legacy/inline/part-03.js:3847 | script legado |
| `closeHourControlModal` | src/legacy/inline/part-20.js:351 | script legado |
| `closeHourControlModal` | src/legacy/inline/part-20.js:352 | script legado |
| `closeHourControlModal` | src/legacy/inline/part-20.js:584 | script legado |
| `closeHourControlModal` | src/ui/hours/hourControlActiveUi.js:416 | ui/template |
| `closeHourControlModal` | src/ui/legacy-events.js:218 | ui/template |
| `closeHourControlModal` | src/ui/legacy-events.js:219 | ui/template |
| `closeHourControlModal` | docs/behavior-freeze.md:200 | documentacao |
| `closeHourControlModal` | docs/hour-control-ui-modernization-diagnostic.md:46 | documentacao |
| `closeHourControlModal` | docs/hour-control-ui-modernization-policy.md:25 | documentacao |
| `closeHourControlModal` | docs/hour-control-ui-modernization-policy.md:43 | documentacao |
| `getControleHorasRecords` | src/legacy/inline/part-07.js:10 | script legado |
| `getControleHorasRecords` | src/legacy/inline/part-09.js:275 | script legado |
| `getControleHorasRecords` | src/legacy/inline/part-18.js:13 | script legado |
| `getControleHorasRecords` | docs/hour-control-ui-modernization-diagnostic.md:34 | documentacao |
| `handleHourControlTypeChange` | src/legacy/inline/part-03.js:3711 | script legado |
| `handleHourControlTypeChange` | src/legacy/inline/part-03.js:3780 | script legado |
| `handleHourControlTypeChange` | src/legacy/inline/part-09.js:233 | script legado |
| `handleHourControlTypeChange` | src/legacy/inline/part-20.js:394 | script legado |
| `handleHourControlTypeChange` | src/ui/hours/hourControlActiveUi.js:417 | ui/template |
| `handleHourControlTypeChange` | src/ui/legacy-events.js:224 | ui/template |
| `handleHourControlTypeChange` | docs/behavior-freeze.md:201 | documentacao |
| `handleHourControlTypeChange` | docs/hour-control-ui-modernization-policy.md:25 | documentacao |
| `openHourControlModal` | src/legacy/inline/part-03.js:3764 | script legado |
| `openHourControlModal` | src/legacy/inline/part-09.js:220 | script legado |
| `openHourControlModal` | src/legacy/inline/part-20.js:340 | script legado |
| `openHourControlModal` | src/legacy/inline/part-20.js:341 | script legado |
| `openHourControlModal` | src/ui/hours/hourControlActiveUi.js:415 | ui/template |
| `openHourControlModal` | src/ui/legacy-events.js:123 | ui/template |
| `openHourControlModal` | docs/behavior-freeze.md:199 | documentacao |
| `openHourControlModal` | docs/behavior-freeze.md:456 | documentacao |
| `openHourControlModal` | docs/hour-control-ui-modernization-diagnostic.md:46 | documentacao |
| `openHourControlModal` | docs/hour-control-ui-modernization-diagnostic.md:110 | documentacao |
| `openHourControlModal` | docs/hour-control-ui-modernization-diagnostic.md:116 | documentacao |
| `openHourControlModal` | docs/hour-control-ui-modernization-policy.md:25 | documentacao |
| `openHourControlModal` | docs/hour-control-ui-modernization-policy.md:43 | documentacao |
| `saveHourControlRecord` | src/app.js:145 | codigo |
| `saveHourControlRecord` | src/legacy/inline/part-03.js:3785 | script legado |
| `saveHourControlRecord` | src/legacy/inline/part-20.js:449 | script legado |
| `saveHourControlRecord` | src/ui/hours/hourControlActiveUi.js:420 | ui/template |
| `saveHourControlRecord` | src/ui/hours/hourControlActiveUi.js:426 | ui/template |
| `saveHourControlRecord` | src/ui/legacy-events.js:220 | ui/template |
| `saveHourControlRecord` | tests/architecture/hourControlModernization.test.js:43 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1772 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1808 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1841 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1842 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1843 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1887 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1902 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1906 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1927 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1950 | teste |
| `saveHourControlRecord` | tests/playwright/regression-local.spec.js:1951 | teste |
| `saveHourControlRecord` | tests/smoke/smoke.mjs:738 | teste |
| `saveHourControlRecord` | scripts/hour-control-modernization-check.mjs:94 | script de tooling |
| `saveHourControlRecord` | docs/behavior-freeze.md:203 | documentacao |
| `saveHourControlRecord` | docs/behavior-freeze.md:457 | documentacao |
| `saveHourControlRecord` | docs/hour-control-ui-modernization-diagnostic.md:46 | documentacao |
| `saveHourControlRecord` | docs/hour-control-ui-modernization-diagnostic.md:110 | documentacao |
| `saveHourControlRecord` | docs/hour-control-ui-modernization-diagnostic.md:116 | documentacao |
| `saveHourControlRecord` | docs/hour-control-ui-modernization-policy.md:25 | documentacao |
| `saveHourControlRecord` | docs/hour-control-ui-modernization-policy.md:43 | documentacao |
| `saveHourControlRecord` | docs/legacy-module-migration-roadmap.md:95 | documentacao |
| `syncHourControlPersonOptions` | src/legacy/inline/part-09.js:222 | script legado |
| `toggleHourControlDetails` | src/ui/legacy-events.js:302 | ui/template |
| `toggleHourControlDetails` | docs/hour-control-ui-modernization-diagnostic.md:35 | documentacao |
| `updateHourControlCalculatedFields` | src/legacy/inline/part-03.js:3715 | script legado |
| `updateHourControlCalculatedFields` | src/legacy/inline/part-03.js:3718 | script legado |
| `updateHourControlCalculatedFields` | src/legacy/inline/part-20.js:348 | script legado |
| `updateHourControlCalculatedFields` | src/legacy/inline/part-20.js:400 | script legado |
| `updateHourControlCalculatedFields` | src/legacy/inline/part-27.js:107 | script legado |
| `updateHourControlCalculatedFields` | src/legacy/inline/part-27.js:108 | script legado |
| `updateHourControlCalculatedFields` | src/ui/hours/hourControlActiveUi.js:418 | ui/template |
| `updateHourControlCalculatedFields` | src/ui/legacy-events.js:221 | ui/template |
| `updateHourControlCalculatedFields` | src/ui/legacy-events.js:222 | ui/template |
| `updateHourControlCalculatedFields` | src/ui/legacy-events.js:223 | ui/template |
| `updateHourControlCalculatedFields` | src/ui/legacy-events.js:226 | ui/template |
| `updateHourControlCalculatedFields` | src/ui/legacy-events.js:228 | ui/template |
| ... | 3 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-07.js

- No loader atual: sim
- Produtores detectados: `closeEntryDetailModal`, `closeHourDetailModal`, `openEntryDetailModal`, `openHourDetailModal`, `renderControleHoras`, `renderEntradas`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `closeEntryDetailModal` | src/legacy/inline/part-03.js:3973 | script legado |
| `closeEntryDetailModal` | src/ui/legacy-events.js:230 | ui/template |
| `closeEntryDetailModal` | docs/behavior-freeze.md:172 | documentacao |
| `closeHourDetailModal` | src/legacy/inline/part-03.js:3886 | script legado |
| `closeHourDetailModal` | src/legacy/inline/part-19.js:38 | script legado |
| `closeHourDetailModal` | src/ui/legacy-events.js:229 | ui/template |
| `closeHourDetailModal` | docs/behavior-freeze.md:205 | documentacao |
| `openEntryDetailModal` | src/legacy/inline/part-03.js:3890 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-09.js:252 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-12.js:70 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-14.js:125 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-15.js:127 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-16.js:736 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-27.js:202 | script legado |
| `openEntryDetailModal` | src/legacy/inline/part-27.js:203 | script legado |
| `openEntryDetailModal` | src/ui/legacy-events.js:279 | ui/template |
| `openEntryDetailModal` | src/ui/legacy-events.js:286 | ui/template |
| `openEntryDetailModal` | tests/architecture/global-api-collisions.test.js:19 | teste |
| `openEntryDetailModal` | tests/smoke/smoke.mjs:25 | teste |
| `openEntryDetailModal` | tests/smoke/smoke.mjs:716 | teste |
| `openEntryDetailModal` | scripts/build-global-inventory.mjs:18 | script de tooling |
| `openEntryDetailModal` | docs/architecture-current-state.md:63 | documentacao |
| `openEntryDetailModal` | docs/behavior-freeze.md:171 | documentacao |
| `openEntryDetailModal` | docs/behavior-freeze.md:453 | documentacao |
| `openEntryDetailModal` | docs/dashboard-read-model-modernization-diagnostic.md:72 | documentacao |
| `openEntryDetailModal` | docs/global-api-inventory.md:34 | documentacao |
| `openEntryDetailModal` | docs/global-api-reduction-diagnostic.md:28 | documentacao |
| `openEntryDetailModal` | docs/global-api-reduction-diagnostic.md:57 | documentacao |
| `openEntryDetailModal` | docs/heavy-project-audit.md:80 | documentacao |
| `openEntryDetailModal` | docs/phase-1-baseline.md:70 | documentacao |
| `openHourDetailModal` | src/legacy/inline/part-03.js:3850 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-09.js:238 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-19.js:36 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-19.js:42 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-20.js:588 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-20.js:595 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-27.js:180 | script legado |
| `openHourDetailModal` | src/legacy/inline/part-27.js:181 | script legado |
| `openHourDetailModal` | src/ui/hours/hourControlActiveUi.js:391 | ui/template |
| `openHourDetailModal` | src/ui/legacy-events.js:295 | ui/template |
| `openHourDetailModal` | tests/smoke/smoke.mjs:26 | teste |
| `openHourDetailModal` | tests/smoke/smoke.mjs:720 | teste |
| `openHourDetailModal` | docs/behavior-freeze.md:204 | documentacao |
| `openHourDetailModal` | docs/behavior-freeze.md:458 | documentacao |
| `renderControleHoras` | src/app.js:171 | codigo |
| `renderControleHoras` | src/legacy/inline/part-03.js:1237 | script legado |
| `renderControleHoras` | src/legacy/inline/part-03.js:3525 | script legado |
| `renderControleHoras` | src/legacy/inline/part-08.js:59 | script legado |
| `renderControleHoras` | src/legacy/inline/part-09.js:267 | script legado |
| `renderControleHoras` | src/legacy/inline/part-17.js:20 | script legado |
| `renderControleHoras` | src/legacy/inline/part-17.js:32 | script legado |
| `renderControleHoras` | src/legacy/inline/part-18.js:1 | script legado |
| `renderControleHoras` | src/legacy/inline/part-19.js:27 | script legado |
| `renderControleHoras` | src/legacy/inline/part-20.js:585 | script legado |
| `renderControleHoras` | src/legacy/inline/part-29.js:256 | script legado |
| `renderControleHoras` | src/legacy/inline/part-29.js:1250 | script legado |
| `renderControleHoras` | src/legacy/inline/part-29.js:1251 | script legado |
| `renderControleHoras` | src/ui/hours/hourControlActiveUi.js:414 | ui/template |
| `renderControleHoras` | src/ui/hours/hourControlActiveUi.js:425 | ui/template |
| `renderControleHoras` | src/ui/legacy-events.js:121 | ui/template |
| `renderControleHoras` | src/ui/legacy-events.js:122 | ui/template |
| `renderControleHoras` | tests/playwright/regression-local.spec.js:1811 | teste |
| `renderControleHoras` | tests/playwright/regression-local.spec.js:1840 | teste |
| `renderControleHoras` | tests/playwright/regression-local.spec.js:1860 | teste |
| `renderControleHoras` | docs/behavior-freeze.md:198 | documentacao |
| `renderControleHoras` | docs/behavior-freeze.md:427 | documentacao |
| `renderControleHoras` | docs/heavy-project-audit.md:79 | documentacao |
| `renderControleHoras` | docs/heavy-project-audit.md:270 | documentacao |
| `renderControleHoras` | docs/hour-control-ui-modernization-diagnostic.md:45 | documentacao |
| `renderControleHoras` | docs/hour-control-ui-modernization-diagnostic.md:110 | documentacao |
| `renderControleHoras` | docs/hour-control-ui-modernization-diagnostic.md:116 | documentacao |
| `renderControleHoras` | docs/hour-control-ui-modernization-policy.md:25 | documentacao |
| `renderControleHoras` | docs/hour-control-ui-modernization-policy.md:43 | documentacao |
| `renderControleHoras` | docs/legacy-module-migration-roadmap.md:95 | documentacao |
| `renderEntradas` | src/legacy/inline/part-03.js:1236 | script legado |
| `renderEntradas` | src/legacy/inline/part-03.js:1786 | script legado |
| `renderEntradas` | src/legacy/inline/part-03.js:1792 | script legado |
| `renderEntradas` | src/legacy/inline/part-03.js:1805 | script legado |
| `renderEntradas` | src/legacy/inline/part-03.js:1811 | script legado |
| `renderEntradas` | src/legacy/inline/part-03.js:3406 | script legado |
| ... | 33 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-08.js

- No loader atual: sim
- Produtores detectados: `addPerson`, `renderConfiguracoes`, `renderCurrentTab`, `renderParcelamentos`, `savePerson`, `switchTab`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `addPerson` | src/legacy/inline/part-03.js:5465 | script legado |
| `addPerson` | src/legacy/inline/part-14.js:44 | script legado |
| `addPerson` | src/ui/legacy-events.js:125 | ui/template |
| `addPerson` | src/ui/settings/settingsActiveUi.js:39 | ui/template |
| `addPerson` | tests/smoke/smoke.mjs:324 | teste |
| `addPerson` | docs/architecture-current-state.md:598 | documentacao |
| `addPerson` | docs/behavior-freeze.md:232 | documentacao |
| `addPerson` | docs/behavior-freeze.md:436 | documentacao |
| `renderConfiguracoes` | src/app.js:294 | codigo |
| `renderConfiguracoes` | src/app.js:315 | codigo |
| `renderConfiguracoes` | src/app.js:317 | codigo |
| `renderConfiguracoes` | src/app.js:320 | codigo |
| `renderConfiguracoes` | src/app.js:322 | codigo |
| `renderConfiguracoes` | src/legacy/inline/part-03.js:1238 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-03.js:6370 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-09.js:311 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-09.js:312 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-14.js:100 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-14.js:101 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-28.js:380 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-29.js:1285 | script legado |
| `renderConfiguracoes` | src/legacy/inline/part-29.js:1286 | script legado |
| `renderConfiguracoes` | src/ui/settings/settingsActiveUi.js:24 | ui/template |
| `renderConfiguracoes` | src/ui/settings/settingsActiveUi.js:38 | ui/template |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:97 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:98 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:173 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:514 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:536 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:584 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:680 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:681 | teste |
| `renderConfiguracoes` | tests/playwright/regression-local.spec.js:1286 | teste |
| `renderConfiguracoes` | tests/smoke/smoke.mjs:664 | teste |
| `renderConfiguracoes` | tests/ui/settingsController.test.js:179 | teste |
| `renderConfiguracoes` | scripts/finance-ui-consumers-check.mjs:251 | script de tooling |
| `renderConfiguracoes` | scripts/finance-ui-consumers-check.mjs:252 | script de tooling |
| `renderConfiguracoes` | docs/architecture-current-state.md:598 | documentacao |
| `renderConfiguracoes` | docs/behavior-freeze.md:231 | documentacao |
| `renderConfiguracoes` | docs/behavior-freeze.md:435 | documentacao |
| `renderConfiguracoes` | docs/cache-invalidation-policy.md:31 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:26 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:27 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:28 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:29 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:30 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:31 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:32 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:33 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:35 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:36 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:37 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:38 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:44 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:45 | documentacao |
| `renderConfiguracoes` | docs/finance-ui-critical-consumers-diagnostic.md:46 | documentacao |
| `renderCurrentTab` | src/legacy/inline/part-03.js:221 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-03.js:1229 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-03.js:1232 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-09.js:211 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-11.js:72 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-13.js:79 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-14.js:41 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-16.js:290 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-16.js:306 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-16.js:525 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-16.js:544 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-16.js:598 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-29.js:439 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-29.js:1151 | script legado |
| `renderCurrentTab` | src/legacy/inline/part-29.js:1165 | script legado |
| `renderCurrentTab` | src/legacy/theme.js:61 | codigo |
| `renderCurrentTab` | src/services/performanceMonitor.global.js:6 | codigo |
| `renderCurrentTab` | src/services/performanceMonitor.global.js:23 | codigo |
| `renderCurrentTab` | src/services/performanceMonitor.js:7 | codigo |
| `renderCurrentTab` | src/services/performanceMonitor.js:72 | codigo |
| `renderCurrentTab` | src/ui/navigation/navigationCoordinator.js:10 | ui/template |
| `renderCurrentTab` | src/ui/navigation/navigationCoordinator.js:36 | ui/template |
| `renderCurrentTab` | tests/architecture/financeUiConsumersCheck.test.js:151 | teste |
| `renderCurrentTab` | tests/ui/navigationCoordinator.test.js:31 | teste |
| ... | 234 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-09.js

- No loader atual: sim
- Produtores detectados: `calculateINSSDetailed`, `calculateIRRFDetailed`, `ensureModalDetached`, `loadTaxSettings`, `persistTaxSettings`, `renderTaxSettingsPanel`, `saveTaxSettings`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `calculateINSSDetailed` | src/legacy/inline/part-14.js:129 | script legado |
| `calculateIRRFDetailed` | src/legacy/inline/part-14.js:130 | script legado |
| `ensureModalDetached` | src/legacy/inline/part-14.js:126 | script legado |
| `ensureModalDetached` | src/legacy/inline/part-19.js:43 | script legado |
| `ensureModalDetached` | src/legacy/inline/part-20.js:366 | script legado |
| `ensureModalDetached` | src/legacy/inline/part-20.js:367 | script legado |
| `ensureModalDetached` | src/legacy/inline/part-20.js:596 | script legado |
| `renderTaxSettingsPanel` | src/ui/settings/settingsWebAdapter.js:212 | ui/template |
| `saveTaxSettings` | docs/behavior-freeze.md:252 | documentacao |
| `saveTaxSettings` | docs/behavior-freeze.md:447 | documentacao |
| `saveTaxSettings` | docs/settings-modernization-diagnostic.md:38 | documentacao |

### src/legacy/inline/part-10.js

- No loader atual: sim
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-11.js

- No loader atual: sim
- Produtores detectados: `buildEntryDiscountInputId`, `getDeductionMacroValue`, `getEntryDiscountAdjustmentRecord`, `saveEntryDiscountAdjustmentByEntry`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `buildEntryDiscountInputId` | src/legacy/inline/part-12.js:14 | script legado |
| `buildEntryDiscountInputId` | src/legacy/inline/part-13.js:15 | script legado |
| `buildEntryDiscountInputId` | src/legacy/inline/part-15.js:68 | script legado |
| `buildEntryDiscountInputId` | src/legacy/inline/part-16.js:16 | script legado |
| `buildEntryDiscountInputId` | src/legacy/inline/part-16.js:447 | script legado |
| `buildEntryDiscountInputId` | src/legacy/inline/part-16.js:654 | script legado |
| `getDeductionMacroValue` | src/legacy/inline/part-13.js:29 | script legado |
| `getDeductionMacroValue` | src/legacy/inline/part-16.js:465 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/getEntryCycleViews.js:3 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/getEntryCycleViews.js:11 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/getEntryCycleViews.js:14 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/getEntryDiscountHistory.js:47 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/index.js:4 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/index.js:18 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/index.js:67 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/index.js:68 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/application/entries/index.js:85 | modulo reutilizavel |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-12.js:12 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-13.js:24 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-15.js:66 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:5 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:458 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:530 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:549 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:603 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:604 | script legado |
| `getEntryDiscountAdjustmentRecord` | src/legacy/inline/part-16.js:660 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-12.js:76 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-13.js:14 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-13.js:82 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-13.js:82 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-15.js:133 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-16.js:445 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-16.js:742 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/ui/legacy-events.js:381 | ui/template |
| `saveEntryDiscountAdjustmentByEntry` | tests/architecture/global-api-collisions.test.js:12 | teste |
| `saveEntryDiscountAdjustmentByEntry` | docs/behavior-freeze.md:174 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-inventory.md:70 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-reduction-diagnostic.md:29 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-reduction-diagnostic.md:96 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-reduction-diagnostic.md:109 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/heavy-project-audit.md:82 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/legacy-module-migration-diagnostic.md:36 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/legacy-module-migration-roadmap.md:57 | documentacao |

### src/legacy/inline/part-12.js

- No loader atual: sim
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-13.js

- No loader atual: sim
- Produtores detectados: `isDeductionLikeMacro`, `saveEntryDiscountAdjustmentByEntry`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `isDeductionLikeMacro` | src/application/entries/getEntryDiscountHistory.js:14 | modulo reutilizavel |
| `isDeductionLikeMacro` | src/application/entries/getEntryDiscountHistory.js:21 | modulo reutilizavel |
| `isDeductionLikeMacro` | src/application/entries/index.js:9 | modulo reutilizavel |
| `isDeductionLikeMacro` | src/application/entries/index.js:23 | modulo reutilizavel |
| `isDeductionLikeMacro` | src/application/entries/index.js:76 | modulo reutilizavel |
| `isDeductionLikeMacro` | src/application/entries/index.js:90 | modulo reutilizavel |
| `isDeductionLikeMacro` | src/legacy/inline/part-16.js:68 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-11.js:21 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-11.js:75 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-11.js:75 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-12.js:76 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-15.js:133 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-16.js:445 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-16.js:742 | script legado |
| `saveEntryDiscountAdjustmentByEntry` | src/ui/legacy-events.js:381 | ui/template |
| `saveEntryDiscountAdjustmentByEntry` | tests/architecture/global-api-collisions.test.js:12 | teste |
| `saveEntryDiscountAdjustmentByEntry` | docs/behavior-freeze.md:174 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-inventory.md:70 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-reduction-diagnostic.md:29 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-reduction-diagnostic.md:96 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/global-api-reduction-diagnostic.md:109 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/heavy-project-audit.md:82 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/legacy-module-migration-diagnostic.md:36 | documentacao |
| `saveEntryDiscountAdjustmentByEntry` | docs/legacy-module-migration-roadmap.md:57 | documentacao |

### src/legacy/inline/part-14.js

- No loader atual: sim
- Produtores detectados: `calculateSalaryAdvance`, `ensureReceivingTypeField`, `getPersonReceivingType`, `updatePersonReceivingType`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `calculateSalaryAdvance` | src/application/entries/consolidatePersonMonthlyEntry.js:55 | modulo reutilizavel |
| `calculateSalaryAdvance` | src/application/entries/consolidatePersonMonthlyEntry.js:94 | modulo reutilizavel |
| `getPersonReceivingType` | src/application/entries/consolidatePersonMonthlyEntry.js:196 | modulo reutilizavel |
| `getPersonReceivingType` | src/application/entries/consolidatePersonMonthlyEntry.js:197 | modulo reutilizavel |
| `getPersonReceivingType` | src/application/useCases/percentageRuleMaterializationUseCases.js:280 | modulo reutilizavel |
| `getPersonReceivingType` | src/application/useCases/percentageRuleMaterializationUseCases.js:641 | modulo reutilizavel |
| `updatePersonReceivingType` | src/ui/legacy-events.js:501 | ui/template |
| `updatePersonReceivingType` | src/ui/legacy-events.js:501 | ui/template |
| `updatePersonReceivingType` | src/ui/settings/settingsActiveUi.js:17 | ui/template |
| `updatePersonReceivingType` | src/ui/settings/settingsController.js:210 | ui/template |
| `updatePersonReceivingType` | src/ui/settings/settingsController.js:233 | ui/template |
| `updatePersonReceivingType` | tests/ui/settingsController.test.js:95 | teste |
| `updatePersonReceivingType` | tests/ui/settingsController.test.js:169 | teste |
| `updatePersonReceivingType` | docs/behavior-freeze.md:238 | documentacao |
| `updatePersonReceivingType` | docs/behavior-freeze.md:439 | documentacao |

### src/legacy/inline/part-15.js

- No loader atual: sim
- Produtores detectados: `ensureEntradasCycleFilter`, `getEntradasCycleFilterValue`, `mapEntradaToCycleView`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `ensureEntradasCycleFilter` | src/legacy/inline/part-16.js:638 | script legado |
| `getEntradasCycleFilterValue` | src/legacy/inline/part-16.js:345 | script legado |
| `getEntradasCycleFilterValue` | src/legacy/inline/part-16.js:445 | script legado |
| `getEntradasCycleFilterValue` | src/legacy/inline/part-16.js:528 | script legado |
| `getEntradasCycleFilterValue` | src/legacy/inline/part-16.js:547 | script legado |
| `getEntradasCycleFilterValue` | src/legacy/inline/part-16.js:640 | script legado |
| `getEntradasCycleFilterValue` | src/legacy/inline/part-16.js:894 | script legado |
| `getEntradasCycleFilterValue` | docs/behavior-freeze.md:169 | documentacao |
| `mapEntradaToCycleView` | src/application/entries/index.js:37 | modulo reutilizavel |
| `mapEntradaToCycleView` | src/application/entries/index.js:37 | modulo reutilizavel |
| `mapEntradaToCycleView` | src/legacy/inline/part-03.js:1457 | script legado |
| `mapEntradaToCycleView` | src/legacy/inline/part-03.js:1478 | script legado |
| `mapEntradaToCycleView` | src/legacy/inline/part-03.js:1479 | script legado |
| `mapEntradaToCycleView` | src/legacy/inline/part-16.js:601 | script legado |
| `mapEntradaToCycleView` | src/legacy/inline/part-16.js:644 | script legado |
| `mapEntradaToCycleView` | src/ui/dashboard/dashboardData.js:175 | ui/template |
| `mapEntradaToCycleView` | src/ui/monthDetail/monthDetailData.js:131 | ui/template |
| `mapEntradaToCycleView` | src/ui/monthDetail/monthDetailData.js:148 | ui/template |
| `mapEntradaToCycleView` | src/ui/monthDetail/monthDetailData.js:149 | ui/template |
| `mapEntradaToCycleView` | docs/behavior-freeze.md:170 | documentacao |
| `mapEntradaToCycleView` | docs/heavy-project-audit.md:28 | documentacao |

### src/legacy/inline/part-16.js

- No loader atual: sim
- Produtores detectados: `buildEntryDiscountHistoryEntry`, `buildEntryDiscountObservationId`, `clearEntryOtherRevenueForm`, `closeEntryOtherRevenuesModal`, `createEntryDiscountHistoryDeleteButtonDom`, `createEntryDiscountHistoryMetricCardDom`, `createEntryDiscountHistoryRecordNodeDom`, `deleteEntryDiscountAdjustmentByEntry`, `deleteEntryDiscountHistoryItem`, `deleteEntryOtherRevenue`, `editEntryOtherRevenue`, `ensureEntryDiscountHistoryModal`, `ensureEntryOtherRevenuesModal`, `formatEntryDiscountHistoryDate`, `getEntryDiscountDisplayItemCount`, `getEntryDiscountHistoryItems`, `getEntryDiscountHistoryTotal`, `getEntryDiscountRecordTotal`, `getEntryOtherRevenueRecords`, `getEntryPeriodDiscountRecords`, `normalizeEntryDiscountCycle`, `openEntryDiscountHistoryModal`, `openEntryOtherRevenuesModal`, `renderEntryOtherRevenuesModal`, `saveEntryOtherRevenue`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `getEntryDiscountHistoryItems` | src/application/entries/getEntryDiscountHistory.js:32 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/application/entries/getEntryDiscountHistory.js:37 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/application/entries/index.js:5 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/application/entries/index.js:19 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/application/entries/index.js:70 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/application/entries/index.js:86 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/domain/entries.js:18 | modulo reutilizavel |
| `getEntryDiscountHistoryItems` | src/domain/entries.js:38 | modulo reutilizavel |
| `getEntryDiscountHistoryTotal` | src/application/entries/getEntryDiscountHistory.js:36 | modulo reutilizavel |
| `getEntryDiscountHistoryTotal` | src/application/entries/getEntryDiscountHistory.js:41 | modulo reutilizavel |
| `getEntryDiscountHistoryTotal` | src/application/entries/index.js:6 | modulo reutilizavel |
| `getEntryDiscountHistoryTotal` | src/application/entries/index.js:20 | modulo reutilizavel |
| `getEntryDiscountHistoryTotal` | src/application/entries/index.js:71 | modulo reutilizavel |
| `getEntryDiscountHistoryTotal` | src/application/entries/index.js:87 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/getEntryCycleViews.js:4 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/getEntryCycleViews.js:10 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/getEntryCycleViews.js:13 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/getEntryDiscountHistory.js:40 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/index.js:7 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/index.js:21 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/index.js:72 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | src/application/entries/index.js:88 | modulo reutilizavel |
| `getEntryDiscountRecordTotal` | tests/application/entries/entryConsolidation.test.js:6 | teste |
| `getEntryDiscountRecordTotal` | tests/application/entries/entryConsolidation.test.js:52 | teste |
| `getEntryOtherRevenueRecords` | src/legacy/inline/part-27.js:230 | script legado |
| `getEntryOtherRevenueRecords` | docs/architecture-current-state.md:63 | documentacao |
| `getEntryOtherRevenueRecords` | docs/global-api-inventory.md:57 | documentacao |
| `getEntryOtherRevenueRecords` | docs/global-api-reduction-diagnostic.md:78 | documentacao |
| `getEntryPeriodDiscountRecords` | src/application/entries/getEntryDiscountHistory.js:58 | modulo reutilizavel |
| `getEntryPeriodDiscountRecords` | src/application/entries/index.js:8 | modulo reutilizavel |
| `getEntryPeriodDiscountRecords` | src/application/entries/index.js:22 | modulo reutilizavel |
| `getEntryPeriodDiscountRecords` | src/application/entries/index.js:73 | modulo reutilizavel |
| `getEntryPeriodDiscountRecords` | src/application/entries/index.js:74 | modulo reutilizavel |
| `getEntryPeriodDiscountRecords` | src/application/entries/index.js:89 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/getEntryDiscountHistory.js:3 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/getEntryDiscountHistory.js:48 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/getEntryDiscountHistory.js:54 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/getEntryDiscountHistory.js:67 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/getEntryDiscountHistory.js:68 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/index.js:10 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/index.js:24 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/index.js:77 | modulo reutilizavel |
| `normalizeEntryDiscountCycle` | src/application/entries/index.js:91 | modulo reutilizavel |
| `openEntryDiscountHistoryModal` | tests/architecture/global-api-collisions.test.js:13 | teste |
| `openEntryDiscountHistoryModal` | docs/global-api-inventory.md:63 | documentacao |
| `openEntryDiscountHistoryModal` | docs/global-api-reduction-diagnostic.md:30 | documentacao |
| `openEntryDiscountHistoryModal` | docs/global-api-reduction-diagnostic.md:89 | documentacao |
| `openEntryDiscountHistoryModal` | docs/global-api-reduction-diagnostic.md:110 | documentacao |
| `openEntryDiscountHistoryModal` | docs/legacy-module-migration-diagnostic.md:37 | documentacao |
| `openEntryDiscountHistoryModal` | docs/legacy-module-migration-roadmap.md:58 | documentacao |
| `openEntryOtherRevenuesModal` | docs/architecture-current-state.md:63 | documentacao |
| `openEntryOtherRevenuesModal` | docs/global-api-inventory.md:64 | documentacao |
| `openEntryOtherRevenuesModal` | docs/global-api-reduction-diagnostic.md:90 | documentacao |
| `openEntryOtherRevenuesModal` | docs/legacy-module-migration-diagnostic.md:37 | documentacao |

### src/legacy/inline/part-17.js

- No loader atual: sim
- Produtores detectados: `ensureControleHorasCycleFlags`, `getControleHorasCycleFromRecord`, `setControleHorasCycleFilter`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `setControleHorasCycleFilter` | src/ui/legacy-events.js:455 | ui/template |
| `setControleHorasCycleFilter` | docs/behavior-freeze.md:207 | documentacao |
| `setControleHorasCycleFilter` | docs/behavior-freeze.md:460 | documentacao |

### src/legacy/inline/part-18.js

- No loader atual: sim
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-19.js

- No loader atual: sim
- Produtores detectados: `deleteHourControlRecord`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `deleteHourControlRecord` | src/ui/legacy-events.js:312 | ui/template |
| `deleteHourControlRecord` | src/ui/legacy-events.js:313 | ui/template |
| `deleteHourControlRecord` | docs/behavior-freeze.md:206 | documentacao |
| `deleteHourControlRecord` | docs/behavior-freeze.md:459 | documentacao |

### src/legacy/inline/part-20.js

- No loader atual: sim
- Produtores detectados: `buildHourGeneratedEntryPayload`, `calculateHourControlOvertime`, `calculateHourWorkSummary`, `findGeneratedHourEntry`, `getCustomHolidayDates`, `getFixedBrazilHolidayDates`, `getHourControlOvertimePreview`, `getHourControlRecordFinancialTotal`, `getHourControlRecordKind`, `getHourControlSalaryBase`, `isSaturdayOrHoliday`, `renderHourControlOvertimeBreakdown`, `setHourControlFormMode`, `syncGeneratedHourEntry`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `calculateHourWorkSummary` | src/legacy/inline/part-27.js:125 | script legado |
| `findGeneratedHourEntry` | src/legacy/inline/part-19.js:8 | script legado |
| `findGeneratedHourEntry` | src/legacy/inline/part-19.js:9 | script legado |
| `getCustomHolidayDates` | src/legacy/inline/part-27.js:10 | script legado |
| `getCustomHolidayDates` | src/legacy/inline/part-27.js:11 | script legado |
| `getCustomHolidayDates` | docs/planner-user-isolation-diagnostic.md:51 | documentacao |
| `getCustomHolidayDates` | docs/planner-user-isolation-diagnostic.md:52 | documentacao |
| `getCustomHolidayDates` | docs/planner-user-isolation-diagnostic.md:72 | documentacao |
| `getFixedBrazilHolidayDates` | src/domain/dsr.js:4 | modulo reutilizavel |
| `getFixedBrazilHolidayDates` | src/domain/dsr.js:30 | modulo reutilizavel |
| `getFixedBrazilHolidayDates` | src/domain/finance.js:21 | modulo reutilizavel |
| `getFixedBrazilHolidayDates` | src/domain/workSession.js:6 | modulo reutilizavel |
| `getFixedBrazilHolidayDates` | src/domain/workSession.js:476 | modulo reutilizavel |
| `getFixedBrazilHolidayDates` | src/legacy/globalBridge.js:31 | codigo |
| `getFixedBrazilHolidayDates` | src/legacy/globalBridge.js:72 | codigo |
| `getFixedBrazilHolidayDates` | src/legacy/globalBridge.js:88 | codigo |
| `getFixedBrazilHolidayDates` | src/legacy/inline/part-27.js:6 | script legado |
| `getFixedBrazilHolidayDates` | src/legacy/inline/part-27.js:7 | script legado |
| `getFixedBrazilHolidayDates` | tests/domain/dsr.test.js:2 | teste |
| `getFixedBrazilHolidayDates` | tests/domain/dsr.test.js:6 | teste |
| `getFixedBrazilHolidayDates` | tests/domain/dsr.test.js:7 | teste |
| `getFixedBrazilHolidayDates` | tests/legacy/globalBridge.test.js:34 | teste |
| `getHourControlOvertimePreview` | src/legacy/inline/part-27.js:135 | script legado |
| `getHourControlOvertimePreview` | src/legacy/inline/part-27.js:136 | script legado |
| `getHourControlSalaryBase` | src/legacy/inline/part-27.js:132 | script legado |
| `getHourControlSalaryBase` | src/legacy/inline/part-27.js:133 | script legado |

### src/legacy/inline/part-21.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-22.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-23.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-24.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-25.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-26.js

- No loader atual: sim
- Produtores detectados: `closePlannerModal`, `deletePlannerEvent`, `ensurePlannerModal`, `formatPlannerDateLabel`, `getPlannerDerivedHourEvents`, `getPlannerEventVisual`, `getPlannerEventsForMonth`, `getPlannerMonth`, `getPlannerSelectedDate`, `getPlannerTodayIso`, `loadPlannerEvents`, `openPlannerModal`, `renderPlannerBreakdownLines`, `renderPlannerDetails`, `renderPlannerEventDetailCard`, `renderPlannerModal`, `savePlannerEvent`, `savePlannerEvents`, `selectPlannerDate`, `shiftPlannerMonth`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `closePlannerModal` | src/ui/planner/plannerActiveUi.js:52 | ui/template |
| `closePlannerModal` | docs/architecture-current-state.md:577 | documentacao |
| `closePlannerModal` | docs/planner-modernization-diagnostic.md:105 | documentacao |
| `closePlannerModal` | docs/planner-modernization-policy.md:61 | documentacao |
| `closePlannerModal` | docs/planner-user-isolation-policy.md:74 | documentacao |
| `deletePlannerEvent` | src/ui/legacy-events.js:402 | ui/template |
| `deletePlannerEvent` | src/ui/legacy-events.js:402 | ui/template |
| `deletePlannerEvent` | src/ui/planner/plannerActiveUi.js:55 | ui/template |
| `deletePlannerEvent` | tests/ui/plannerController.test.js:176 | teste |
| `deletePlannerEvent` | docs/architecture-current-state.md:577 | documentacao |
| `deletePlannerEvent` | docs/behavior-freeze.md:114 | documentacao |
| `deletePlannerEvent` | docs/planner-modernization-diagnostic.md:58 | documentacao |
| `deletePlannerEvent` | docs/planner-modernization-diagnostic.md:108 | documentacao |
| `deletePlannerEvent` | docs/planner-modernization-policy.md:61 | documentacao |
| `deletePlannerEvent` | docs/planner-user-isolation-policy.md:77 | documentacao |
| `loadPlannerEvents` | docs/planner-user-isolation-diagnostic.md:39 | documentacao |
| `openPlannerModal` | src/app.js:398 | codigo |
| `openPlannerModal` | src/app.js:427 | codigo |
| `openPlannerModal` | src/app.js:428 | codigo |
| `openPlannerModal` | src/app.js:430 | codigo |
| `openPlannerModal` | src/app.js:436 | codigo |
| `openPlannerModal` | src/ui/legacy-events.js:92 | ui/template |
| `openPlannerModal` | src/ui/planner/plannerActiveUi.js:35 | ui/template |
| `openPlannerModal` | src/ui/planner/plannerActiveUi.js:51 | ui/template |
| `openPlannerModal` | tests/playwright/regression-local.spec.js:886 | teste |
| `openPlannerModal` | tests/playwright/regression-local.spec.js:899 | teste |
| `openPlannerModal` | tests/playwright/regression-local.spec.js:922 | teste |
| `openPlannerModal` | tests/playwright/regression-local.spec.js:934 | teste |
| `openPlannerModal` | tests/playwright/regression-local.spec.js:951 | teste |
| `openPlannerModal` | tests/ui/plannerController.test.js:174 | teste |
| `openPlannerModal` | docs/architecture-current-state.md:577 | documentacao |
| `openPlannerModal` | docs/behavior-freeze.md:111 | documentacao |
| `openPlannerModal` | docs/planner-modernization-diagnostic.md:104 | documentacao |
| `openPlannerModal` | docs/planner-modernization-policy.md:61 | documentacao |
| `openPlannerModal` | docs/planner-user-isolation-policy.md:73 | documentacao |
| `renderPlannerModal` | src/legacy/inline/part-19.js:28 | script legado |
| `renderPlannerModal` | src/legacy/inline/part-20.js:587 | script legado |
| `renderPlannerModal` | src/ui/planner/plannerActiveUi.js:53 | ui/template |
| `renderPlannerModal` | src/ui/planner/plannerPresenter.js:82 | ui/template |
| `renderPlannerModal` | tests/ui/plannerController.test.js:175 | teste |
| `renderPlannerModal` | docs/architecture-current-state.md:577 | documentacao |
| `renderPlannerModal` | docs/behavior-freeze.md:112 | documentacao |
| `renderPlannerModal` | docs/planner-modernization-diagnostic.md:63 | documentacao |
| `renderPlannerModal` | docs/planner-modernization-diagnostic.md:106 | documentacao |
| `renderPlannerModal` | docs/planner-modernization-diagnostic.md:116 | documentacao |
| `renderPlannerModal` | docs/planner-modernization-policy.md:61 | documentacao |
| `renderPlannerModal` | docs/planner-user-isolation-policy.md:75 | documentacao |
| `savePlannerEvent` | src/ui/planner/plannerActiveUi.js:54 | ui/template |
| `savePlannerEvent` | src/ui/planner/plannerPresenter.js:101 | ui/template |
| `savePlannerEvent` | tests/playwright/regression-local.spec.js:926 | teste |
| `savePlannerEvent` | tests/playwright/regression-local.spec.js:942 | teste |
| `savePlannerEvent` | docs/architecture-current-state.md:577 | documentacao |
| `savePlannerEvent` | docs/behavior-freeze.md:113 | documentacao |
| `savePlannerEvent` | docs/planner-modernization-diagnostic.md:57 | documentacao |
| `savePlannerEvent` | docs/planner-modernization-diagnostic.md:107 | documentacao |
| `savePlannerEvent` | docs/planner-modernization-policy.md:61 | documentacao |
| `savePlannerEvent` | docs/planner-user-isolation-policy.md:76 | documentacao |
| `savePlannerEvents` | docs/planner-modernization-diagnostic.md:59 | documentacao |
| `savePlannerEvents` | docs/planner-user-isolation-diagnostic.md:34 | documentacao |
| `savePlannerEvents` | docs/planner-user-isolation-diagnostic.md:46 | documentacao |
| `selectPlannerDate` | src/ui/legacy-events.js:396 | ui/template |
| `selectPlannerDate` | src/ui/legacy-events.js:396 | ui/template |
| `selectPlannerDate` | src/ui/planner/plannerActiveUi.js:57 | ui/template |
| `selectPlannerDate` | docs/architecture-current-state.md:577 | documentacao |
| `selectPlannerDate` | docs/planner-modernization-diagnostic.md:110 | documentacao |
| `selectPlannerDate` | docs/planner-modernization-policy.md:61 | documentacao |
| `selectPlannerDate` | docs/planner-user-isolation-policy.md:79 | documentacao |
| `shiftPlannerMonth` | src/ui/legacy-events.js:390 | ui/template |
| `shiftPlannerMonth` | src/ui/legacy-events.js:390 | ui/template |
| `shiftPlannerMonth` | src/ui/planner/plannerActiveUi.js:56 | ui/template |
| `shiftPlannerMonth` | docs/architecture-current-state.md:577 | documentacao |
| `shiftPlannerMonth` | docs/planner-modernization-diagnostic.md:109 | documentacao |
| `shiftPlannerMonth` | docs/planner-modernization-policy.md:61 | documentacao |
| `shiftPlannerMonth` | docs/planner-user-isolation-policy.md:78 | documentacao |

### src/legacy/inline/part-27.js

- No loader atual: sim
- Produtores detectados: `calcularDSRHoraExtra`, `getDSRCalendarFactors`, `getHolidayDatesForCompetence`, `getHoraExtraTotalForDSR`, `getPreviousCompetenceKey`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `calcularDSRHoraExtra` | src/application/entries/consolidatePersonMonthlyEntry.js:203 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/application/entries/consolidatePersonMonthlyEntry.js:204 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/domain/dsr.js:53 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/domain/finance.js:21 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/domain/workSession.js:4 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/domain/workSession.js:438 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/domain/workSession.js:477 | modulo reutilizavel |
| `calcularDSRHoraExtra` | src/legacy/globalBridge.js:29 | codigo |
| `calcularDSRHoraExtra` | src/legacy/globalBridge.js:70 | codigo |
| `calcularDSRHoraExtra` | src/legacy/globalBridge.js:86 | codigo |
| `calcularDSRHoraExtra` | tests/domain/dsr.test.js:2 | teste |
| `calcularDSRHoraExtra` | tests/domain/dsr.test.js:19 | teste |
| `calcularDSRHoraExtra` | tests/legacy/globalBridge.test.js:32 | teste |
| `calcularDSRHoraExtra` | tests/legacy/globalBridge.test.js:67 | teste |
| `getDSRCalendarFactors` | src/domain/dsr.js:17 | modulo reutilizavel |
| `getDSRCalendarFactors` | src/domain/dsr.js:59 | modulo reutilizavel |
| `getDSRCalendarFactors` | src/domain/finance.js:21 | modulo reutilizavel |
| `getDSRCalendarFactors` | src/domain/workSession.js:5 | modulo reutilizavel |
| `getDSRCalendarFactors` | src/domain/workSession.js:475 | modulo reutilizavel |
| `getDSRCalendarFactors` | src/legacy/globalBridge.js:30 | codigo |
| `getDSRCalendarFactors` | src/legacy/globalBridge.js:71 | codigo |
| `getDSRCalendarFactors` | src/legacy/globalBridge.js:87 | codigo |
| `getDSRCalendarFactors` | tests/domain/dsr.test.js:2 | teste |
| `getDSRCalendarFactors` | tests/domain/dsr.test.js:11 | teste |
| `getDSRCalendarFactors` | tests/legacy/globalBridge.test.js:33 | teste |
| `getHolidayDatesForCompetence` | docs/planner-user-isolation-diagnostic.md:40 | documentacao |
| `getPreviousCompetenceKey` | src/application/entries/consolidatePersonMonthlyEntry.js:39 | modulo reutilizavel |
| `getPreviousCompetenceKey` | src/application/entries/consolidatePersonMonthlyEntry.js:153 | modulo reutilizavel |

### src/legacy/inline/part-28.js

- No loader atual: sim
- Produtores detectados: `accountLifecycle`, `applyAuthState`, `applyRoleVisibility`, `clearFinancialUiState`, `ensureHeaderSessionControls`, `ensureUserManagementPanel`, `handleAuthSubmit`, `isCurrentUserAdmin`, `logout`, `refreshAccountStatus`, `refreshManagedUsers`, `renderManagedUsers`, `setAccessNotice`, `setAccountStatusLoading`, `setAuthError`, `setAuthLoading`, `setManagedUserRole`, `setManagedUserStatus`, `syncFinanceAuthContext`, `toggleAuthMode`, `toggleManagedUserStatus`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `accountLifecycle` | src/app.js:31 | codigo |
| `accountLifecycle` | src/application/readModels/userAdminReadModel.js:8 | modulo reutilizavel |
| `accountLifecycle` | src/application/userAdmin/userAdminPermissions.js:6 | modulo reutilizavel |
| `accountLifecycle` | src/services/userAdmin.js:22 | codigo |
| `accountLifecycle` | tests/auth-flow/account-lifecycle-auth-flow.test.js:25 | teste |
| `accountLifecycle` | tests/regression/high-risk-regression.test.js:26 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:111 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:135 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:280 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:316 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:331 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:355 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:390 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:414 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:437 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:456 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:483 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:511 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:766 | teste |
| `applyAuthState` | tests/playwright/regression-local.spec.js:772 | teste |
| `applyAuthState` | docs/account-lifecycle.md:48 | documentacao |
| `applyAuthState` | docs/behavior-freeze.md:47 | documentacao |
| `applyRoleVisibility` | docs/behavior-freeze.md:48 | documentacao |
| `clearFinancialUiState` | docs/planner-user-isolation-diagnostic.md:63 | documentacao |
| `handleAuthSubmit` | src/ui/legacy-events.js:65 | ui/template |
| `handleAuthSubmit` | docs/behavior-freeze.md:44 | documentacao |
| `isCurrentUserAdmin` | src/legacy/inline/part-03.js:5107 | script legado |
| `isCurrentUserAdmin` | src/legacy/inline/part-03.js:5143 | script legado |
| `isCurrentUserAdmin` | src/legacy/inline/part-03.js:5213 | script legado |
| `isCurrentUserAdmin` | src/legacy/inline/part-03.js:5532 | script legado |
| `isCurrentUserAdmin` | src/legacy/inline/part-08.js:37 | script legado |
| `isCurrentUserAdmin` | src/services/dataSdk.js:119 | codigo |
| `isCurrentUserAdmin` | src/ui/admin/userAdminActiveUi.js:35 | ui/template |
| `isCurrentUserAdmin` | src/ui/admin/userAdminActiveUi.js:102 | ui/template |
| `isCurrentUserAdmin` | src/ui/settings/settingsWebAdapter.js:41 | ui/template |
| `isCurrentUserAdmin` | src/ui/settings/settingsWebAdapter.js:44 | ui/template |
| `isCurrentUserAdmin` | src/ui/settings/settingsWebAdapter.js:51 | ui/template |
| `isCurrentUserAdmin` | tests/playwright/regression-local.spec.js:22 | teste |
| `isCurrentUserAdmin` | tests/playwright/regression-local.spec.js:739 | teste |
| `isCurrentUserAdmin` | tests/services/dataSdk.referenceData.test.js:48 | teste |
| `isCurrentUserAdmin` | tests/services/dataSdk.referenceData.test.js:118 | teste |
| `isCurrentUserAdmin` | tests/ui/settingsWebAdapter.test.js:10 | teste |
| `isCurrentUserAdmin` | docs/global-api-inventory.md:61 | documentacao |
| `isCurrentUserAdmin` | docs/global-api-reduction-diagnostic.md:87 | documentacao |
| `isCurrentUserAdmin` | docs/legacy-module-migration-diagnostic.md:40 | documentacao |
| `logout` | src/services/auth.js:27 | codigo |
| `logout` | src/services/dataSdk.js:550 | codigo |
| `logout` | src/ui/templates/authTemplate.js:42 | ui/template |
| `logout` | tests/application/repositories/paginationPerformance.test.js:103 | teste |
| `logout` | tests/playwright/regression-local.spec.js:336 | teste |
| `logout` | tests/playwright/regression-local.spec.js:375 | teste |
| `logout` | tests/services/dataSdk.cache.test.js:92 | teste |
| `logout` | docs/architecture-current-state.md:84 | documentacao |
| `logout` | docs/architecture-current-state.md:587 | documentacao |
| `logout` | docs/architecture-current-state.md:629 | documentacao |
| `logout` | docs/behavior-freeze.md:46 | documentacao |
| `logout` | docs/cache-invalidation-policy.md:23 | documentacao |
| `logout` | docs/cache-invalidation-policy.md:33 | documentacao |
| `logout` | docs/firebase-security.md:42 | documentacao |
| `logout` | docs/firebase-security.md:43 | documentacao |
| `logout` | docs/firebase-security.md:47 | documentacao |
| `logout` | docs/firebase-security.md:93 | documentacao |
| `logout` | docs/hour-control-ui-modernization-diagnostic.md:69 | documentacao |
| `logout` | docs/legacy-module-migration-roadmap.md:127 | documentacao |
| `logout` | docs/legacy-module-migration-roadmap.md:155 | documentacao |
| `logout` | docs/planner-user-isolation-diagnostic.md:61 | documentacao |
| `logout` | docs/planner-user-isolation-diagnostic.md:101 | documentacao |
| `logout` | docs/planner-user-isolation-policy.md:50 | documentacao |
| `logout` | docs/professional-optimization-audit.md:11 | documentacao |
| `logout` | docs/regression-test-matrix.md:685 | documentacao |
| `logout` | docs/subscription-lifecycle-policy.md:11 | documentacao |
| `logout` | docs/user-admin-modernization-diagnostic.md:46 | documentacao |
| `refreshManagedUsers` | src/ui/admin/userAdminActiveUi.js:83 | ui/template |
| `refreshManagedUsers` | src/ui/admin/userAdminActiveUi.js:94 | ui/template |
| `refreshManagedUsers` | src/ui/admin/userAdminPresenter.js:60 | ui/template |
| `refreshManagedUsers` | tests/playwright/regression-local.spec.js:485 | teste |
| `refreshManagedUsers` | docs/behavior-freeze.md:49 | documentacao |
| `refreshManagedUsers` | docs/legacy-module-migration-roadmap.md:155 | documentacao |
| `refreshManagedUsers` | docs/user-admin-modernization-policy.md:15 | documentacao |
| `renderManagedUsers` | src/ui/admin/userAdminActiveUi.js:95 | ui/template |
| ... | 31 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-29.js

- No loader atual: sim
- Produtores detectados: `__financeDataVersion`, `__financeGetPercentageExitRecord`, `__financeHandlePercentageExitRowAction`, `applySettingsAccordions`, `buildPercentageExitRecord`, `buildPercentageRulePayload`, `cancelEditPercentageExitRule`, `clearLocalPercentageExitRulesBackup`, `clearPercentageExitRuleForm`, `dedupePercentageExitRecords`, `deleteEntryIncomeSource`, `deleteGeneratedPercentageExitRecordsForRule`, `deletePercentageExitRule`, `editPercentageExitRule`, `enhanceSettingsPanelAccordion`, `ensureControleHorasMonthNavigator`, `ensureDashboardRangeControls`, `ensureEntradasMonthNavigator`, `ensureEntrySourcesSettingsPanel`, `ensurePercentageExitRulesPanel`, `excludeDashboardDetailRecord`, `filterOrphanPercentageExitRecords`, `findPersistedPercentageExitRecord`, `forceDashboardChartsForCurrentRange`, `getAllEntrySourceOptions`, `getBaseEntrySourceOptions`, `getCycleLabel`, `getDashboardSaidasForBreakdownCharts`, `getDashboardSelectedCompetenceRange`, `getLocalPercentageExitRules`, `getPercentageBaseLabel`, `getPercentageBaseValue`, `getPercentageCycleBaseValue`, `getPercentageExitRecordKey`, `getPercentageExitRecordRank`, `getPercentageGeneratedRecordId`, `getPercentageRuleAmount`, `getPercentageRuleBaseValue`, `getPercentageRuleFirebaseId`, `getPercentageRuleGeneratedRecords`, `getPercentageRuleIdentity`, `getPercentageRuleRecordKey`, `getPercentageRuleRecordsFromFirebase`, `getRegisteredPercentageExitRecord`, `getSettingsPanelTitle`, `getSyncedPercentageExitRules`, `getWorkIncomeBaseValue`, `getWorkLiquidBaseValue`, `groupDashboardBreakdownRecords`, `handlePercentageExitRowAction`, `hasPersistedPercentageExitRecord`, `isCanonicalPercentageExitRecord`, `isPercentageExitRecordLinkedToActiveRule`, `isPercentageExitRecordLinkedToRule`, `isPercentageExitRuleRecord`, `isPersistedPercentageExitRecord`, `isReserveOrInvestmentPercentageRule`, `loadCustomEntrySources`, `loadHiddenEntrySources`, `loadPercentageExitRules`, `materializePercentageExitRulesForRange`, `migrateLocalPercentageExitRulesToFirebase`, `normalizeEntrySourceName`, `normalizePercentageExitRule`, `openDashboardExpenseRecordsWithActions`, `persistCustomEntrySources`, `persistHiddenEntrySources`, `persistPercentageExitOccurrence`, `preservePersistedPercentageExitState`, `refreshPercentageExitRulesFromCloudStorage`, `renderDashboardDetailModalRecords`, `renderDashboardDetailModalSummary`, `renderDashboardMonthRange`, `renderEntrySourcesSettings`, `renderPercentageExitRules`, `renderSettingsLegacySupplementals`, `repairDashboardExpenseBreakdownCharts`, `saveEntryIncomeSource`, `savePercentageExitRule`, `schedulePercentageExitMaterialization`, `setSettingsAccordionOpen`, `shiftControleHorasMonthFilter`, `shiftEntradasMonthFilter`, `shouldUseSettingsAccordion`, `syncEntryIncomeSourceOptions`, `syncPercentageRuleCategoryOptions`, `syncPercentageRuleFormOptions`, `upsertPercentageExitRule`
| Producer | Consumer | Tipo |
| --- | --- | --- |
| `__financeDataVersion` | src/legacy/inline/part-03.js:139 | script legado |
| `__financeDataVersion` | src/legacy/inline/part-03.js:139 | script legado |
| `__financeDataVersion` | src/legacy/inline/part-03.js:167 | script legado |
| `__financeDataVersion` | src/legacy/inline/part-03.js:167 | script legado |
| `__financeDataVersion` | src/legacy/inline/part-03.js:4086 | script legado |
| `__financeDataVersion` | src/legacy/inline/part-03.js:4086 | script legado |
| `__financeDataVersion` | src/state/financeRecordIndex.js:127 | codigo |
| `__financeDataVersion` | src/ui/dashboard/dashboardData.js:20 | ui/template |
| `__financeDataVersion` | src/ui/hours/hourControlActiveUi.js:277 | ui/template |
| `__financeDataVersion` | src/ui/hours/hourControlActiveUi.js:277 | ui/template |
| `__financeDataVersion` | src/ui/monthDetail/monthDetailData.js:10 | ui/template |
| `__financeDataVersion` | tests/architecture/global-api-collisions.test.js:9 | teste |
| `__financeDataVersion` | tests/playwright/regression-local.spec.js:35 | teste |
| `__financeDataVersion` | tests/playwright/regression-local.spec.js:35 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:385 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:385 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:921 | teste |
| `__financeDataVersion` | tests/smoke/smoke.mjs:921 | teste |
| `__financeDataVersion` | tests/state/financeRecordIndex.test.js:47 | teste |
| `__financeDataVersion` | tests/ui/monthDetailData.test.js:12 | teste |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:7 | documentacao |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:27 | documentacao |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:27 | documentacao |
| `__financeDataVersion` | docs/cache-invalidation-policy.md:33 | documentacao |
| `__financeDataVersion` | docs/dashboard-read-model-modernization-policy.md:49 | documentacao |
| `__financeDataVersion` | docs/global-api-inventory.md:42 | documentacao |
| `__financeDataVersion` | docs/global-api-reduction-diagnostic.md:60 | documentacao |
| `__financeDataVersion` | docs/phase-5-part-03-migration.md:57 | documentacao |
| `__financeGetPercentageExitRecord` | src/ui/legacy-events.js:55 | ui/template |
| `__financeGetPercentageExitRecord` | docs/global-api-inventory.md:43 | documentacao |
| `__financeGetPercentageExitRecord` | docs/global-api-reduction-diagnostic.md:61 | documentacao |
| `__financeGetPercentageExitRecord` | docs/percentage-rule-materialization-diagnostic.md:197 | documentacao |
| `__financeHandlePercentageExitRowAction` | src/ui/legacy-events.js:249 | ui/template |
| `__financeHandlePercentageExitRowAction` | src/ui/legacy-events.js:255 | ui/template |
| `__financeHandlePercentageExitRowAction` | docs/global-api-inventory.md:44 | documentacao |
| `__financeHandlePercentageExitRowAction` | docs/global-api-reduction-diagnostic.md:62 | documentacao |
| `__financeHandlePercentageExitRowAction` | docs/percentage-rule-materialization-diagnostic.md:198 | documentacao |
| `buildPercentageExitRecord` | src/ui/dashboard/dashboardData.js:117 | ui/template |
| `buildPercentageExitRecord` | src/ui/dashboard/dashboardData.js:117 | ui/template |
| `buildPercentageExitRecord` | src/ui/dashboard/dashboardData.js:137 | ui/template |
| `buildPercentageExitRecord` | src/ui/dashboard/dashboardData.js:138 | ui/template |
| `buildPercentageExitRecord` | docs/behavior-freeze.md:338 | documentacao |
| `buildPercentageExitRecord` | docs/global-api-reduction-diagnostic.md:64 | documentacao |
| `buildPercentageExitRecord` | docs/percentage-rule-materialization-diagnostic.md:12 | documentacao |
| `buildPercentageExitRecord` | docs/percentage-rule-materialization-diagnostic.md:191 | documentacao |
| `cancelEditPercentageExitRule` | docs/behavior-freeze.md:333 | documentacao |
| `cancelEditPercentageExitRule` | docs/global-api-inventory.md:46 | documentacao |
| `cancelEditPercentageExitRule` | docs/global-api-reduction-diagnostic.md:65 | documentacao |
| `cancelEditPercentageExitRule` | docs/percentage-rule-materialization-diagnostic.md:189 | documentacao |
| `dedupePercentageExitRecords` | src/application/readModels/dashboardReadModel.js:126 | modulo reutilizavel |
| `dedupePercentageExitRecords` | src/application/readModels/dashboardReadModel.js:127 | modulo reutilizavel |
| `dedupePercentageExitRecords` | src/ui/dashboard/dashboardData.js:184 | ui/template |
| `dedupePercentageExitRecords` | src/ui/dashboard/dashboardData.js:184 | ui/template |
| `dedupePercentageExitRecords` | docs/behavior-freeze.md:340 | documentacao |
| `dedupePercentageExitRecords` | docs/global-api-reduction-diagnostic.md:67 | documentacao |
| `dedupePercentageExitRecords` | docs/percentage-rule-materialization-diagnostic.md:193 | documentacao |
| `deleteEntryIncomeSource` | src/ui/legacy-events.js:434 | ui/template |
| `deleteEntryIncomeSource` | src/ui/legacy-events.js:434 | ui/template |
| `deleteEntryIncomeSource` | docs/behavior-freeze.md:254 | documentacao |
| `deleteEntryIncomeSource` | docs/global-api-inventory.md:48 | documentacao |
| `deleteEntryIncomeSource` | docs/global-api-reduction-diagnostic.md:68 | documentacao |
| `deleteGeneratedPercentageExitRecordsForRule` | docs/percentage-rule-materialization-diagnostic.md:145 | documentacao |
| `deletePercentageExitRule` | src/ui/legacy-events.js:447 | ui/template |
| `deletePercentageExitRule` | src/ui/legacy-events.js:449 | ui/template |
| `deletePercentageExitRule` | src/ui/legacy-events.js:449 | ui/template |
| `deletePercentageExitRule` | docs/behavior-freeze.md:332 | documentacao |
| `deletePercentageExitRule` | docs/behavior-freeze.md:475 | documentacao |
| `deletePercentageExitRule` | docs/global-api-inventory.md:49 | documentacao |
| `deletePercentageExitRule` | docs/global-api-reduction-diagnostic.md:69 | documentacao |
| `deletePercentageExitRule` | docs/percentage-rule-materialization-diagnostic.md:188 | documentacao |
| `editPercentageExitRule` | src/ui/legacy-events.js:440 | ui/template |
| `editPercentageExitRule` | src/ui/legacy-events.js:440 | ui/template |
| `editPercentageExitRule` | docs/behavior-freeze.md:331 | documentacao |
| `editPercentageExitRule` | docs/behavior-freeze.md:474 | documentacao |
| `editPercentageExitRule` | docs/global-api-inventory.md:50 | documentacao |
| `editPercentageExitRule` | docs/global-api-reduction-diagnostic.md:70 | documentacao |
| `editPercentageExitRule` | docs/percentage-rule-materialization-diagnostic.md:187 | documentacao |
| `ensureDashboardRangeControls` | docs/global-api-inventory.md:51 | documentacao |
| `ensureDashboardRangeControls` | docs/global-api-reduction-diagnostic.md:71 | documentacao |
| `filterOrphanPercentageExitRecords` | src/application/readModels/dashboardReadModel.js:123 | modulo reutilizavel |
| ... | 132 consumidores adicionais omitidos no relatorio | ... |

### src/legacy/inline/part-30.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

### src/legacy/inline/part-31.js

- No loader atual: nao
- Produtores detectados: nenhum
- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.

## Migracao dos consumidores modernos `financeUI` - 12/09/2026

`src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` deixaram de consumir `window.financeUI`/`financeUiAdapters`. `part-07.js` tambem deixou de chamar `window.financeUI` diretamente e usa o adapter visual temporario enquanto permanecer classico.

| Item | Antes | Depois |
| --- | ---: | ---: |
| Consumidores modernos de `financeUI`/`financeUiAdapters` | 3 arquivos | 0 |
| `window.financeUI` em `part-07.js` | 5 | 0 |
| `window.financeUI` em `part-08.js` | 9 | 0 |
| `window.financeUI` em `part-14.js` | 4 | 0 |
| `part-08.js` navegacao via `financeUI/financeUiAdapters.activateTab` | 1 | 0 |
| `part-08.js` helper visual classico duplicado | 1 | 0 |
| Coordenador ES de navegacao | 0 | 1 |
| Scripts classic/eval | 22/22 | 22/22 |
| APIs globais | 50 | 50 |
| Novo `eval` | 0 | 0 |
| `new Function` | 0 | 0 |

Consumidores runtime remanescentes relacionados a `financeUI`:

- `src/legacy/inline/part-03.js` ainda possui 13 consumidor(es) runtime de `financeUI` ou `financeUiAdapters`.
- `src/legacy/inline/part-07.js` ainda possui 5 consumidor(es) runtime de `financeUI` ou `financeUiAdapters`.
- `src/legacy/inline/part-29.js` ainda possui 3 consumidor(es) runtime de `financeUI` ou `financeUiAdapters`.
- `src/ui/legacy-ui.js` continua sendo a implementacao ES canonica dos helpers visuais e do adapter de compatibilidade.

### Inventario de bridges diretas e indiretas

- Consumidores diretos de `window.financeUI`: nenhum.
- Consumidores de `window.financeApp.financeUiAdapters`: 21.
- Aliases/dinamicos nao resolvidos: nenhum.
- Consumidores runtime consolidados: `src/legacy/inline/part-03.js`, `src/legacy/inline/part-07.js`, `src/legacy/inline/part-29.js`.
- Implementacao visual canonica de navegacao: `src/ui/navigationTabs.js:activateTab`.
- Evidencia de navegacao: ok: switchTab bridge is coordinated by src/ui/navigation/navigationCoordinator.js and visual activation delegates to src/ui/navigationTabs.js:activateTab.
- `window.financeUI` instalada em runtime: nao.
- `window.financeApp.financeUiAdapters` instalada em runtime: sim.
- Superficie global removida: `window.financeUI`.
- Superficie global adicionada: nenhuma.

`window.financeUI` nao e mais instalada no runtime apos a comprovacao de ausencia de consumidores diretos efetivos. `window.financeApp.financeUiAdapters` permanece instalada por compatibilidade com `part-03.js`, `part-07.js` e `part-29.js`. A navegacao efetiva de `part-08.js:switchTab` nao chama mais `financeUI.activateTab` nem `financeUiAdapters.activateTab`, e a ativacao visual e coordenada por `src/ui/navigation/navigationCoordinator.js` delegando para `src/ui/navigationTabs.js:activateTab`. Nenhuma regra financeira, auth, Firestore Rule, importacao, backup/restore, PDF, horas, parcelamentos, recorrencias, tributos ou materializacao percentual foi migrada nesta etapa.
