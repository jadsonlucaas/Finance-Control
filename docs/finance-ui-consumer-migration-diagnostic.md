# Diagnostico de migracao dos consumidores `financeUI`

Executado em: 12/09/2026

## Escopo

Esta etapa mapeia somente chamadas diretas a `window.financeUI` em:

- `src/legacy/inline/part-03.js`
- `src/legacy/inline/part-29.js`

Nenhuma regra financeira, formula, persistencia, autenticacao, Firestore Rule, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, horas ou materializacao percentual foi movida neste diagnostico.

## Resumo antes da migracao

| Arquivo | Chamadas diretas `window.financeUI` | Funcoes usadas | Classificacao dominante |
| --- | ---: | --- | --- |
| `src/legacy/inline/part-03.js` | 11 | `toggleSidebar`, `updateBackButton`, `activateTab`, `showToast`, `showOverlay`, `hideOverlay`, `renderListState`, `renderTotalBox` | DOM visual, toast, overlay, navegacao, lista e totalizador |
| `src/legacy/inline/part-29.js` | 3 | `setHtml`, `showOverlay` | DOM visual e overlay |

## Chamadas em `part-03.js`

| Linha baseline | Chamada | Fluxo/evento | DOM afetado | Classe | Equivalente ES | Depende de regra financeira? | Decisao | Risco |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 206 | `window.financeUI.toggleSidebar(isSidebarOpen)` | Botao menu/sidebar | `#sidebar-overlay`, `#sidebar` | D. NAVEGACAO / TAB | Adapter visual sobre DOM | Nao | Migrar para adapter ES instalado antes do legado | Medio, por timing visual |
| 210 | `window.financeUI.updateBackButton(...)` | Historico de abas | `#btn-go-back` | D. NAVEGACAO / TAB | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 219 | `window.financeUI.activateTab(tab)` | `switchTab` | `#main-tabs button`, `#view-*` | D. NAVEGACAO / TAB | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Medio, por navegacao legada |
| 954 | `window.financeUI.showToast(msg, isError)` | Feedback CRUD/import/PDF/formularios | `#toast` | B. TOAST | Adapter visual preservando toast legado | Nao | Migrar para adapter ES | Medio, por timing/classe |
| 959 | `window.financeUI.showOverlay(overlayId)` | Abertura generica de overlay | Overlays por id | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 1039 | `window.financeUI.hideOverlay('delete-overlay')` | Cancelar exclusao | `#delete-overlay` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 1045 | `window.financeUI.hideOverlay('delete-overlay')` | Confirmar exclusao | `#delete-overlay` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 1081 | `window.financeUI.hideOverlay('delete-person-overlay')` | Cancelar exclusao pessoa | `#delete-person-overlay` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 1086 | `window.financeUI.hideOverlay('delete-person-overlay')` | Confirmar exclusao pessoa | `#delete-person-overlay` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 1109 | `window.financeUI.hideOverlay('delete-macro-overlay')` | Cancelar exclusao macro | `#delete-macro-overlay` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 1114 | `window.financeUI.hideOverlay('delete-macro-overlay')` | Confirmar exclusao macro | `#delete-macro-overlay` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |
| 3382 | `window.financeUI.renderListState({...})` | Renderizacao da lista de saidas | `#saidas-list`, `#saidas-empty`, `#saidas-meta`, `#saidas-pagination` | E. LISTA / EMPTY STATE | Adapter visual sobre `src/ui/dom.js` | Nao | Migrar para adapter ES | Medio, por markup e paginacao |
| 3396 | `window.financeUI.renderTotalBox(...)` | Total visual de saidas exibidas | `#saidas-total` | F. TOTALIZADOR VISUAL | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |

Observacao: o `rg` inicial conta 14 ocorrencias totais nos dois arquivos. Em `part-03`, ha 13 chamadas diretas se cada chamada em linha propria for contada; o agrupamento anterior de 11 considerava familias de uso. Para o check estrutural, a meta e contar ocorrencias textuais reais.

## Chamadas em `part-29.js`

| Linha baseline | Chamada | Fluxo/evento | DOM afetado | Classe | Equivalente ES | Depende de regra financeira? | Decisao | Risco |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1360 | `window.financeUI.setHtml('dashboard-expense-category-list', ...)` | Renderizacao de registros do modal de categorias | `#dashboard-expense-category-list` | A. DOM PURO | Adapter visual sobre `src/ui/dom.js` | Nao | Migrar para adapter ES | Baixo |
| 1370 | `window.financeUI.setHtml('dashboard-expense-category-summary', ...)` | Resumo visual do modal | `#dashboard-expense-category-summary` | A. DOM PURO / F. TOTALIZADOR VISUAL | Adapter visual sobre `src/ui/dom.js` | Nao, total ja calculado no fluxo existente | Migrar para adapter ES | Baixo |
| 1393 | `window.financeUI.showOverlay('dashboard-expense-category-modal')` | Abertura do modal de detalhe | `#dashboard-expense-category-modal` | C. MODAL / OVERLAY | Adapter visual sobre DOM | Nao | Migrar para adapter ES | Baixo |

## Adapter escolhido

Como `part-03.js` e `part-29.js` continuam sendo scripts classicos carregados por `eval`, eles nao podem importar ES Modules diretamente. A opcao segura e instalar um adapter ES fino em `window.financeApp.financeUiAdapters` antes da execucao do pacote classico.

Esse adapter:

- reutiliza `src/ui/dom.js` para helpers DOM canonicos;
- preserva a semantica visual de toast, overlay, sidebar, tabs, lista e totalizador;
- nao cria nova global no `window`;
- nao usa `dataSdk`, Firebase, auth ou regras financeiras;
- nao remove `window.financeUI`, pois `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos ainda eram consumidores reais naquele lote.

## Bloqueios

- `window.financeUI` nao pode ser removido nesta etapa.
- `part-07.js`, `part-08.js` e `part-14.js` ficam apenas mapeados como consumidores remanescentes.
- Naquele lote, fallbacks modernos em `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` tambem continuavam usando `financeUI`.

## Atualizacao do lote seguinte - 12/09/2026

O lote seguinte removeu a dependencia de `financeUI` dos modulos modernos e eliminou as chamadas diretas de `window.financeUI` em `part-07.js`.

Resultado do gate `npm run finance-ui-consumers:check`:

- `modernFinanceUiConsumers = []`;
- `part07FinanceUiCalls = 0`;
- `part08FinanceUiCalls = 9`;
- `part14FinanceUiCalls = 4`;
- `remainingConsumers = ["src/legacy/inline/part-08.js", "src/legacy/inline/part-14.js"]`;
- `classicScripts = 22`;
- `evalExecutedScripts = 22`;
- `globals = 50`;
- `newEval = 0`;
- `newFunction = 0`;
- `wrote = false`.

`src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` agora usam imports ES/injecao local para toast e navegacao. `part-07.js` continua classico, mas suas chamadas visuais passam por `window.financeApp.financeUiAdapters`. Estado historico daquele lote: `part-08.js` e `part-14.js` permaneciam intocados por escopo e seguiam bloqueando a remocao de `window.financeUI`. Atualizacao 5.20: `window.financeUI` nao e mais instalada; os adapters aninhados permanecem para consumidores classicos remanescentes.
