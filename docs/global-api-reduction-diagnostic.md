# Diagnostico de reducao de APIs globais

Gerado em: 22/08/2026

## Resumo

| Item | Antes | Depois |
| --- | ---: | ---: |
| APIs globais top-level inventariadas | 58 | 58 |
| Scripts classicos no loader | 33 | 33 |
| Scripts executados por eval legado | 33 | 33 |
| Bridges registradas por mecanismo explicito | 0 | 31 |
| Exposicoes removidas de `window.financeApp` | 0 | 1 |
| Novas APIs globais top-level | 0 | 0 |

Nenhuma regra financeira, tributaria, de autenticacao, Firestore Rules, parcelamento, recorrencia, hora, importacao ou relatorio foi alterada. A reducao segura desta etapa foi a remocao de `window.financeApp.installLegacyEventBindings`, que nao tinha consumidor real apos o bootstrap.

## Duplicacoes reais encontradas

| API | Ocorrencias | Canonica atual | Status |
| --- | --- | --- | --- |
| `calcularHoras` | `src/domain/workSession.js`, `src/domain/hours.js`, `src/legacy-globals.js`, `part-04.js` | `src/domain/hours.js` via `createWorkSessionEngine` | Mantida como bridge legada |
| `calcularHoraExtra` | dominio moderno, `src/legacy-globals.js`, `part-04.js` | `src/domain/hours.js` | Mantida como bridge legada |
| `calcularINSS` | `src/domain/taxEngine.js`, `src/domain/taxes.js`, `src/legacy-globals.js`, `part-04.js` | `src/domain/taxes.js` / `taxEngine` | Mantida como bridge critica |
| `calcularIRRF` | dominio tributario e bridges legadas | `src/domain/taxes.js` / `taxEngine` | Mantida como bridge critica |
| `calcularLiquido` | dominio tributario e bridges legadas | `src/domain/taxes.js` / `taxEngine` | Mantida como bridge critica |
| `renderEntradas` | fallbacks em `part-03`, override posterior | `part-03.js` atual | Nao migrar nesta fase |
| `openEntryDetailModal` | fallback antigo e implementacao atual | `part-03.js` atual | Nao migrar nesta fase |
| `saveEntryDiscountAdjustmentByEntry` | `part-11.js` e `part-13.js` | `part-13.js` | Duplicacao documentada; nao removida por risco de ordem |
| `openEntryDiscountHistoryModal` | duas atribuicoes em `part-16.js` | implementacao componentizada posterior em `part-16.js` | Duplicacao documentada |
| `showToast` | fallback legado, `legacy-ui`, `src/ui/toast.js` | `src/ui/toast.js` | Mantida ate migracao de UI base |
| `switchTab` / `goBackTab` | legado e router moderno | `src/ui/router.js` para modulo moderno | Mantida por compatibilidade |
| `formatCompetence` / `fmt` | formatadores legados e modulos de UI | `src/core/formatters.js` onde importavel | Mantida enquanto UI legada consome globals |

## `window.financeApp`

`window.financeApp` continua sendo objeto de composicao/debug da aplicacao web. Ele contem bootstrap, engines, dependencias modernas e instaladores usados por smoke/testes. A propriedade `installLegacyEventBindings` foi removida porque:

- a instalacao acontece diretamente em `bootstrapApp()`;
- nao ha consumidor estatico ou dinamico encontrado fora de testes do modulo;
- manter a funcao dentro de `financeApp` criava uma exposicao de debug sem necessidade;
- `window.financeEvents` permanece disponivel para compatibilidade.

## Tabela das 58 APIs globais

| API | Implementacao canonica atual | Definicoes | Consumidores encontrados | Status |
| --- | --- | ---: | --- | --- |
| `renderDashboard` | `src/ui/dashboard/dashboardRenderer.js` com fallback legado | 2 | scripts legados, smoke, Playwright | Manter |
| `renderEntradas` | `part-03.js` atual | 3 | entradas legadas | Manter |
| `renderSaidas` | `part-03.js` | 1 | saidas legadas | Manter |
| `switchTab` | `src/ui/router.js` | 2 | navegacao legada e testes | Manter |
| `handleSubmit` | `part-03.js` | 1 | formulario legado | Manter |
| `consolidarEntradaMensal` | dominio `entries` via bridge legada | 2 | entradas/dashboard | Manter |
| `calcularINSS` | `src/domain/taxes.js` | 3 | entradas/dashboard/testes | Manter bridge |
| `calcularIRRF` | `src/domain/taxes.js` | 3 | entradas/dashboard/testes | Manter bridge |
| `calcularLiquido` | `src/domain/taxes.js` | 3 | entradas/dashboard/testes | Manter bridge |
| `openEntryDetailModal` | `part-03.js` atual | 2 | entradas/dashboard | Manter |
| `exportPDF` | `part-03.js` | 1 | relatorio PDF | Manter |
| `__financeDashboardHydratedFromCache` | cache legado | 1 | dashboard/cache | Manter |
| `__financeDataVersion` | invalidador de cache legado | 2 | dashboard/testes | Manter |
| `__financeGetPercentageExitRecord` | `part-29.js` | 1 | regras percentuais | Manter |
| `__financeHandlePercentageExitRowAction` | `part-29.js` | 1 | regras percentuais | Manter |
| `__legacyRenderDashboardPersonBalanceCards` | bridge de fallback dashboard | 1 | dashboard cards | Manter |
| `buildPercentageExitRecord` | `part-29.js` | 1 | dashboard data | Manter |
| `cancelEditPercentageExitRule` | `part-29.js` | 1 | configuracao percentual | Manter |
| `dashboardDataLabelPlugin` | `part-03.js` | 1 | graficos dashboard | Manter |
| `dedupePercentageExitRecords` | `part-29.js`/dashboard data | 1 | dashboard data | Manter |
| `deleteEntryIncomeSource` | `part-29.js` | 1 | configuracao entradas | Manter |
| `deletePercentageExitRule` | `part-29.js` | 1 | configuracao percentual | Manter |
| `editPercentageExitRule` | `part-29.js` | 1 | configuracao percentual | Manter |
| `ensureDashboardRangeControls` | `part-29.js` | 1 | dashboard filtros | Manter |
| `filterOrphanPercentageExitRecords` | `part-29.js`/dashboard data | 1 | dashboard data | Manter |
| `financeApp` | `src/app.js` | 1 | bootstrap/testes | Manter |
| `fmt` | `src/core/formatters.js` via bridge | 2 | UI legada | Manter bridge |
| `fmtCompactCurrency` | `src/core/formatters.js` via bridge | 1 | dashboard charts | Manter bridge |
| `formatCompetence` | `src/core/dates.js`/formatadores UI | 2 | dashboard/month detail | Manter bridge |
| `getEntradasConsolidadas` | `part-03.js` | 1 | entradas/dashboard | Manter |
| `getEntryOtherRevenueRecords` | `part-16.js` | 1 | entradas outras receitas | Manter |
| `getPeopleRecords` | `part-03.js`/importacao | 2 | entradas/dashboard/importacao | Manter |
| `getPercentageCycleBaseValue` | `src/domain/percentage-rules.js` | 1 | dashboard data | Manter bridge |
| `getPercentageRuleBaseValue` | `src/domain/percentage-rules.js` | 1 | dashboard data | Manter bridge |
| `getSalarioVigente` | `part-03.js`/`part-04.js` | 2 | entradas/horas | Manter |
| `getSyncedPercentageExitRules` | `part-29.js` | 1 | dashboard data | Manter |
| `getThemeTextSecondaryColor` | tema legado | 1 | dashboard charts | Manter |
| `goBackTab` | `src/ui/router.js` | 2 | navegacao | Manter |
| `hasPersistedPercentageExitRecord` | `part-29.js`/dashboard data | 1 | dashboard data | Manter |
| `isCurrentUserAdmin` | `part-28.js` | 1 | admin/configuracoes | Manter |
| `isFinancialEntradaRecord` | dashboard data | 1 | dashboard trend | Manter |
| `openEntryDiscountHistoryModal` | `part-16.js` | 2 | entradas descontos | Manter |
| `openEntryOtherRevenuesModal` | `part-16.js` | 1 | entradas outras receitas | Manter |
| `openMonthlyDetailTab` | dashboard/month detail | 1 | graficos dashboard | Manter |
| `renderDashboardParcelamentosCards` | dashboard renderer/cards | 1 | dashboard | Manter |
| `renderDashboardPersonBalanceCards` | dashboard cards | 1 | dashboard | Manter |
| `renderParcelamentos` | `part-08.js` | 1 | aba parcelamentos | Manter |
| `repairDashboardExpenseBreakdownCharts` | `part-29.js` | 1 | dashboard layout | Manter |
| `saveEntryDiscountAdjustmentByEntry` | `part-13.js` | 2 | entradas descontos | Manter |
| `saveEntryIncomeSource` | `part-29.js` | 1 | configuracao entradas | Manter |
| `savePercentageExitRule` | `part-29.js` | 1 | configuracao percentual | Manter |
| `setFocusedCard` | dashboard events | 1 | dashboard cards | Manter |
| `shiftControleHorasMonthFilter` | `part-29.js` | 1 | controle horas | Manter |
| `shiftEntradasMonthFilter` | `part-29.js` | 1 | entradas | Manter |
| `shiftMonthValue` | dashboard renderer | 1 | dashboard filtros | Manter |
| `showToast` | `src/ui/toast.js` | 3 | UI legada | Manter |
| `sortRecordsNewestFirst` | dashboard charts/cards | 1 | modais dashboard | Manter |
| `syncPercentageRuleCategoryOptions` | `part-29.js` | 1 | configuracao percentual | Manter |

## Candidatos nao removidos

- `saveEntryDiscountAdjustmentByEntry` em `part-11.js`: duplicado por `part-13.js`, mas mantido ate teste especifico de ordem dos scripts e desconto legado.
- `openEntryDiscountHistoryModal` fallback DOM em `part-16.js`: mantido porque o arquivo ainda contem transicao entre modal antigo e `financeUiComponents`.
- `showToast` fallback em `part-03.js`/`legacy-ui`: manter ate migracao de UI base.
- `calcularHoras`, `calcularHoraExtra`, `calcularINSS`, `calcularIRRF`, `calcularLiquido`: canonicos no dominio, mas bridges continuam criticas para legado.

## Lacunas para server-side

- Qualquer modulo que dependa de `window.financeApp`, `window.financeEvents`, `classicScripts.js` ou `src/legacy/inline/*` nao e reutilizavel por backend.
- Backend futuro deve entrar por `src/application` e `src/domain`.
- Nenhum telefone, WhatsApp, webhook, Admin SDK ou canal externo foi implementado.

## Atualizacao - Saida do Loader Legado 08/09/2026

APIs globais permaneceram em `50`; nenhuma bridge foi adicionada ou removida. A reducao desta etapa foi estrutural no loader: `part-21.js`, `part-22.js`, `part-23.js`, `part-24.js`, `part-25.js`, `part-30.js` e `part-31.js` deixaram de ser carregados por `eval` por nao exporem globals nem consumidores runtime.

Novo contrato: `npm run legacy-loader:check` deve retornar `ok=true`, `classicScriptsAfter <= 26`, `evalExecutedAfter <= 26`, `globals <= 50`, `newEval=[]` e `newFunction=[]`.

## Segundo Lote do Loader - 08/09/2026

`src/legacy-globals.js` saiu do loader classico sem remover APIs globais porque suas bridges permanecem instaladas por `src/legacy/globalBridge.js`. `src/services/performanceMonitor.global.js` saiu do loader classico e passou a delegar para `src/services/performanceMonitor.js` via `window.financePerformance`. O total inventariado permaneceu `50`; nenhuma global nova foi criada e nenhuma bridge real foi removida. Novo contrato: `classicScriptsAfter <= 24`, `evalExecutedAfter <= 24`, `globals <= 50`, `newEval=[]` e `newFunction=[]`.

## Terceiro Lote - Loader de Bibliotecas

`src/services/libraryLoader.global.js` saiu do loader classico sem remover nomes globais temporarios de runtime. `src/services/libraryLoader.js` passou a ser a fonte canonica para `loadExternalLibrary`, `isAllowedExternalLibraryUrl`, `ensurePdfLibraries` e `ensureSpreadsheetLibrary`; `src/legacy/libraryLoaderBridge.js` instala as bridges por `bridgeRegistry`. O total inventariado permaneceu `50`; nenhuma global nova foi criada. Novo contrato: `classicScriptsAfter <= 23`, `evalExecutedAfter <= 23`, `globals <= 50`, `newEval=[]`, `newFunction=[]` e `npm run library-loader:check` aprovado.

## Correcao de Bootstrap dos Loaders - 09/09/2026

Nenhuma API global foi adicionada ou removida. `src/legacy/libraryLoaderBridge.js` continua expondo os mesmos nomes temporarios, mas agora delega para `src/services/libraryLoader.js` por import dinamico somente na primeira chamada real. `npm run bootstrap:check` passa a proteger `globals <= 50`, `classic/eval <= 23`, budget `430080`, ausencia de import estatico do loader na bridge e ausencia de bibliotecas lazy no entry.

## Decomposicao de `financeUI` - 11/09/2026

Nenhuma API global foi adicionada. `window.financeUI` foi preservado com o mesmo contrato publico, mas sua origem deixou de ser script raw em `classicScripts.js` e passou a ser `src/ui/legacy-ui.js` como ES Module instalado por `installLegacyUiBridge()`.

Resultado: APIs globais `50 -> 50`, bridges removidas `0`, bridges mantidas `financeUI`, `showToast` global legado em `part-03.js`/`src/ui/toast.js` e demais bridges existentes. `financeUI` nao pode ser removido enquanto houver consumidores runtime nos scripts classicos documentados no grafo.

## Consumidores diretos de `financeUI` - 12/09/2026

`part-03.js` e `part-29.js` deixaram de consumir `window.financeUI` diretamente. Nenhuma API global foi adicionada: o adapter visual fica sob `window.financeApp.financeUiAdapters`, namespace ja existente da aplicacao.

Contagens apos aquela etapa: `part03FinanceUiCalls=0`, `part29FinanceUiCalls=0`, APIs globais `50`, novo `eval=0`, `new Function=0`. A bridge `financeUI` continuava porque ainda havia consumidores runtime em `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos.

## Consumidores modernos de `financeUI` - 12/09/2026

Nenhuma API global foi adicionada ou removida. `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` nao consomem mais `window.financeUI` nem `window.financeApp.financeUiAdapters`; usam imports ES/injecao local.

`part-07.js` tambem nao chama mais `window.financeUI` diretamente. Como ainda e script classico, suas chamadas visuais passam por `window.financeApp.financeUiAdapters`, sem criar global top-level nova.

Contagens daquele gate: `modernFinanceUiConsumers=[]`, `part07FinanceUiCalls=0`, `part08FinanceUiCalls=9`, `part14FinanceUiCalls=4`, APIs globais `50`, novo `eval=0`, `new Function=0`. A bridge `financeUI` permanecia por consumidores diretos em `part-08.js` e `part-14.js`.

## Consumidores criticos de `financeUI` - 12/09/2026

Nenhuma API global foi adicionada ou removida. As chamadas puramente visuais de Configuracoes em `part-08.js` e no fallback de pessoas em `part-14.js` foram desacopladas de `window.financeUI` por DOM local equivalente, sem passar por `financeUiAdapters`.

Contagens atuais do gate apos navegacao: `modernGlobalUiConsumers=[]`, `part07FinanceUiCalls=0`, `part08FinanceUiCalls=0`, `part14FinanceUiCalls=0`, `navigationBridgeConsumers=[]`, APIs globais top-level `50`, novo `eval=0`, `new Function=0`. Atualizacao 5.20: a exposicao publica `window.financeUI` nao e mais instalada; os adapters aninhados em `window.financeApp.financeUiAdapters` permanecem por compatibilidade.
