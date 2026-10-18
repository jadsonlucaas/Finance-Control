# Fase 5 - Inventario e Quebra do `part-03.js`

Data: 2026-04-17

## Tamanho Inicial

- Arquivo: `src/legacy/inline/part-03.js`
- Tamanho antes desta etapa: 6.028 linhas
- Tamanho apos a primeira extracao: 5.891 linhas
- Primeiro corte aplicado: tema e helpers de registros/transacoes

## Blocos Identificados

| Bloco | Linhas aproximadas antes da extracao | Responsabilidade | Risco | Status |
| --- | ---: | --- | --- | --- |
| Estado legado | 1-45 | variaveis de fluxo, filtros, paginacao, limites | alto | permanece no legado |
| Tema | 47-91 | tema claro/escuro e cores dos graficos | baixo | migrado para `src/legacy/theme.js` |
| Tipos de hora extra | 93-149 | tipos, persistencia local e seletores de HE | medio | permanece no legado |
| Helpers de registros | 153-229 | filtros de transacao, archive, escape e pagamento | baixo | migrado para `src/legacy/recordHelpers.js` |
| Element SDK e Data SDK | 230-330 | bootstrap do SDK e snapshot de dados | alto | permanece no legado |
| Navegacao e formulario | 335-995 | abas, formulario de lancamento, submit e edicao | alto | permanece no legado |
| Exclusao e arquivamento | 996-1208 | overlays, delete, pago/arquivado, arquivar por competencia | medio | permanece no legado |
| Render geral e filtros | 1209-1890 | renderAll, filtros, listas, relatorios de importacao | alto | permanece no legado |
| Pessoas e salarios | 1913-2315 | filtros, salario vigente, historico salarial | medio | permanece no legado |
| Dashboard legado | 2316-3376 | graficos antigos, cards, detalhes e lista recente | alto | permanece no legado |
| Entradas/Saidas/Horas | 3378-3996 | renderizacao de listas, modais de entrada e horas | alto | permanece no legado |
| PDF | 4000-4726 | filtros, insights, desenho e exportacao PDF | medio | permanece no legado |
| Categorias/macros/pessoas | 4726-5137 | CRUD de configuracoes principais | medio | permanece no legado |
| Importacao | 5138-5923 | parsing, validacao e importacao de planilhas | alto | permanece no legado |
| Configuracoes | 5976-fim | render de pessoas/macros/configuracoes | medio | permanece no legado |

## Globais Lidas

- `window.financeState`
- `window.elementSdk`
- `window.dataSdk`
- `window.authSdk`
- `window.financeUI`
- `window.Chart`
- `window.jspdf`
- `window.XLSX`
- `window.firebaseBatchDeleteRecords`
- `allRecords`
- `chartInstances`
- `currentTab`
- `editingRecordId`
- `focusedDashboardCard`
- `thisMonth`
- `today`

## Globais Escritas

- `allRecords`
- `currentTab`
- `editingRecordId`
- `focusedDashboardCard`
- `window.__financeDataVersion`
- `window.financeApp`
- funcoes de compatibilidade expostas pela bridge/modulos legados

## DOM Usado Com Frequencia

- Filtros: `f-comp-start`, `f-comp-end`, `f-person`, `f-macro`, `f-cycle`
- Dashboard: `summary-cards`, `recent-list`, `chart-category`, `chart-person`, `chart-trend`
- Formulario: `form-*`, `saida-fields`, `entrada-fields`, `btn-submit`
- Listas: `saidas-list`, `entradas-list`, `controle-horas-list`
- Modais: `dashboard-expense-category-modal`, `entry-detail-modal`, `hour-detail-modal`, `category-modal`
- Configuracoes/importacao: `categories-list`, `pessoas-list`, `macro-list`, `import-saidas-file`, `import-entradas-file`

## Extracoes Aplicadas

### `src/legacy/theme.js`

Funcoes migradas:

- `getThemeChartColor`
- `getThemeTextSecondaryColor`
- `getThemeSurfaceStrokeColor`
- `updateThemeToggleButton`
- `applyTheme`
- `toggleTheme`

Compatibilidade:

- `installThemeGlobals(window)` expoe as mesmas funcoes temporariamente.
- `currentTheme` foi mantido como propriedade global com getter/setter para scripts classicos que ainda usam o identificador.

### `src/legacy/recordHelpers.js`

Funcoes migradas:

- `getTransactionCount`
- `countRecordsByType`
- `isTransactionRecord`
- `isArchivedRecord`
- `getTransactionRecords`
- `getArchiveCounts`
- `isReferenceSalaryRecord`
- `isFinancialEntradaRecord`
- `escapeHtml`
- `normalizePaymentFilterValue`
- `getRemainingTransactionSlots`
- `hasTransactionCapacity`

Compatibilidade:

- `installRecordHelperGlobals(window)` expoe as mesmas funcoes temporariamente.
- As funcoes leem `window.allRecords` no momento da chamada, preservando o comportamento com snapshots do SDK.

## Proximos Cortes Recomendados

1. Extrair `overtimeTypes` para `src/legacy/overtimeTypes.js`.
2. Extrair exclusao/arquivamento para `src/legacy/recordActions.js`.
3. Extrair configuracoes de categorias/macros/pessoas para `src/ui/settings/settingsRenderer.js`.
4. Extrair importacao para `src/legacy/importSpreadsheet.js`, reaproveitando `src/domain/imports.js`.
5. Deixar dashboard legado por ultimo, porque ainda tem muita dependencia cruzada com graficos e filtros.
