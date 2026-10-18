# Inventario de API Global

Gerado em: 2026-10-17T17:15:53.490Z

Este documento congela as funcoes globais e handlers inline conhecidos antes da migracao para modulos. A regra de seguranca e: qualquer item usado por HTML, template string ou outro script legado deve continuar disponivel ate que o uso seja migrado para imports explicitos.

## Baseline de Comandos

Executar e atualizar esta secao sempre que uma fase de migracao terminar:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke
```

## Criterio de leitura

A coluna "Situacao preliminar de migracao" nao autoriza migracao por si so. Qualquer item marcado como candidato ainda exige busca completa de consumidores, testes de regressao especificos, smoke aprovado e preservacao de bridge de compatibilidade enquanto houver consumo legado.

## Globais Criticos

| Nome | Origem atual | Quem usa | Tipo | Situacao preliminar de migracao |
| --- | --- | --- | --- | --- |
| `renderDashboard` | src/legacy/inline/part-03.js:3305 (window assignment) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | renderizacao / evento | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `renderEntradas` | src/legacy/inline/part-03.js:3404 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | renderizacao / evento | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `renderSaidas` | src/legacy/inline/part-03.js:3345 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | renderizacao / evento | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `switchTab` | src/legacy/inline/part-03.js:224 (window assignment) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | renderizacao / evento | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `handleSubmit` | src/legacy/inline/part-03.js:784 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | evento / operacao | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `consolidarEntradaMensal` | src/legacy/inline/part-03.js:2105 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | calculo / dados | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `calcularINSS` | src/legacy/inline/part-04.js:119 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | calculo / dados | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `calcularIRRF` | src/legacy/inline/part-04.js:123 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | calculo / dados | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `calcularLiquido` | src/legacy/inline/part-04.js:127 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | calculo / dados | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `openEntryDetailModal` | src/legacy/inline/part-03.js:3888 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | renderizacao / evento | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |
| `exportPDF` | src/legacy/inline/part-03.js:4632 (function declaration) | Chamado por scripts legados e/ou testes; sem handler inline direto encontrado. | evento / operacao | Nao migrar nesta fase; exige bridge global e smoke test cobrindo. |

## Handlers e APIs Globais Detectados

| Nome | Origem atual | Quem usa | Tipo | Situacao preliminar de migracao |
| --- | --- | --- | --- | --- |
| `__financeDashboardHydratedFromCache` | src/legacy/inline/part-03.js:4087 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `__financeDataVersion` | src/legacy/inline/part-03.js:139 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `__financeGetPercentageExitRecord` | src/legacy/inline/part-29.js:826 (window assignment) | Sem handler inline direto encontrado. | calculo / dados | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `__financeHandlePercentageExitRowAction` | src/legacy/inline/part-29.js:827 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `__legacyRenderDashboardPersonBalanceCards` | src/ui/dashboard/dashboardCards.js:303 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `cancelEditPercentageExitRule` | src/legacy/inline/part-29.js:1088 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `dashboardDataLabelPlugin` | src/legacy/inline/part-03.js:2384 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `deleteEntryIncomeSource` | src/legacy/inline/part-29.js:166 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `deletePercentageExitRule` | src/legacy/inline/part-29.js:1155 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `editPercentageExitRule` | src/legacy/inline/part-29.js:1092 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `ensureDashboardRangeControls` | src/legacy/inline/part-29.js:1424 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `financeApp` | src/app.js:571 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `fmt` | src/ui/dashboard/dashboardCards.js:77 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `fmtCompactCurrency` | src/ui/dashboard/dashboardCharts.js:197 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `formatCompetence` | src/ui/dashboard/dashboardCards.js:72 (window assignment) | Sem handler inline direto encontrado. | calculo / dados | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `getEntradasConsolidadas` | src/legacy/inline/part-03.js:2144 (window assignment) | Sem handler inline direto encontrado. | calculo / dados | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `getEntryOtherRevenueRecords` | src/legacy/inline/part-16.js:82 (window assignment) | Sem handler inline direto encontrado. | calculo / dados | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `getSyncedPercentageExitRules` | src/legacy/inline/part-29.js:352 (window assignment) | Sem handler inline direto encontrado. | calculo / dados | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `getThemeTextSecondaryColor` | src/ui/dashboard/dashboardCharts.js:47 (window assignment) | Sem handler inline direto encontrado. | calculo / dados | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `goBackTab` | src/ui/router.js:22 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `isCurrentUserAdmin` | src/legacy/inline/part-28.js:29 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `isFinancialEntradaRecord` | src/ui/dashboard/dashboardData.js:222 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `openEntryDiscountHistoryModal` | src/legacy/inline/part-16.js:345 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `openEntryOtherRevenuesModal` | src/legacy/inline/part-16.js:212 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `openMonthlyDetailTab` | src/ui/dashboard/dashboardCharts.js:219 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `renderDashboardParcelamentosCards` | src/ui/dashboard/dashboardRenderer.js:84 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `renderDashboardPersonBalanceCards` | src/ui/dashboard/dashboardCards.js:305 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `renderParcelamentos` | src/legacy/inline/part-08.js:61 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `repairDashboardExpenseBreakdownCharts` | src/legacy/inline/part-29.js:1425 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `saveEntryDiscountAdjustmentByEntry` | src/legacy/inline/part-11.js:75 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `saveEntryIncomeSource` | src/legacy/inline/part-29.js:145 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `savePercentageExitRule` | src/legacy/inline/part-29.js:1115 (window assignment) | Sem handler inline direto encontrado. | evento / operacao | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `setFocusedCard` | src/ui/dashboard/dashboardEvents.js:36 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `shiftControleHorasMonthFilter` | src/legacy/inline/part-29.js:252 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `shiftEntradasMonthFilter` | src/legacy/inline/part-29.js:214 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `shiftMonthValue` | src/ui/dashboard/dashboardRenderer.js:67 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `showToast` | src/ui/toast.js:38 (window assignment) | Sem handler inline direto encontrado. | renderizacao / evento | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `sortRecordsNewestFirst` | src/ui/dashboard/dashboardCharts.js:209 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |
| `syncPercentageRuleCategoryOptions` | src/legacy/inline/part-29.js:1005 (window assignment) | Sem handler inline direto encontrado. | evento / global | Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados. |

## Observacoes de Migracao

- Itens com uso em `onclick`, `onchange` ou `onsubmit` devem continuar em `window` ate que o handler seja movido para `src/ui/legacy-events.js` ou modulo equivalente.
- Funcoes criticas de calculo devem ser migradas primeiro para `src/domain`/`src/core`, mas expostas por uma bridge global enquanto scripts legados dependerem delas.
- Antes de remover qualquer global, procurar pelo nome em `index.html`, `src/legacy/inline`, `src/ui` e nos testes de smoke.
