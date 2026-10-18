# Diagnostico de Decomposicao da UI Legada

Executado em: 11/09/2026

## Escopo

`src/ui/legacy-ui.js` foi inventariado antes de qualquer alteracao funcional. O arquivo continha 16 funcoes auxiliares: 15 expostas em `window.financeUI` e 1 helper interno (`byId`). Nenhuma funcao continha `dataSdk`, Firebase, regra financeira, regra de autenticacao, Firestore Rules, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, horas ou materializacao percentual.

## Decisao

O arquivo saiu do loader classico e passou a ser instalado como ES Module por `installLegacyUiBridge(target)`, antes da execucao dos scripts classicos. A API `window.financeUI` foi preservada via `bridgeRegistry` porque, naquele momento, ainda havia consumidores runtime em `part-03.js`, `part-07.js`, `part-08.js`, `part-14.js`, `part-29.js` e fallbacks modernos.

`src/ui/dom.js` ja era o modulo canonico para helpers DOM basicos. A migracao reutilizou esse modulo para `setHidden`, `setHtml`, `setNodes`, `setText` e `renderListState`, sem duplicar utilitarios.

## Inventario por funcao

| Funcao | Classe | Responsabilidade | Consumidores runtime | Side effects | Usa window | Usa DOM | State global | dataSdk/Firebase | Regra financeira | Equivalente moderno | Bridge necessaria | Risco | Decisao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `byId` | A | Buscar elemento por id | Somente helpers internos | Nao | Nao | Sim | Nao | Nao | Nao | `src/ui/dom.js:byId` | Nao | Baixo | Migrado para ES Module e delegado ao helper canonico. |
| `showElement` | A | Remover `hidden` | Bridge `financeUI` | Sim, classe DOM | Nao | Sim | Nao | Nao | Nao | Parcial em `src/ui/dom.js` | Sim | Baixo | Mantido na bridge ES para compatibilidade. |
| `hideElement` | A | Adicionar `hidden` | `hideOverlay` e bridge `financeUI` | Sim, classe DOM | Nao | Sim | Nao | Nao | Nao | Parcial em `src/ui/dom.js` | Sim | Baixo | Mantido na bridge ES para compatibilidade. |
| `showToast` | B | Atualizar `#toast` legado e timer de ocultacao | `part-03.js` via `showToast`, varios `part-XX`, `importacao.js`, `financialCrudControllerInstaller.js` | Sim, texto/classe/timer | Nao | Sim | Timer visual | Nao | Nao | `src/ui/toast.js`, mas sem equivalencia visual/timing total | Sim | Medio | Mantido com semantica legada; nao consolidado para evitar mudanca visual. |
| `showOverlay` | C | Exibir overlay e garantir parent em `body` | `part-03.js`, `part-29.js` | Sim, DOM append/classe | Nao | Sim | Nao | Nao | Nao | Nao canonico equivalente | Sim | Medio | Mantido na bridge ES. |
| `hideOverlay` | C | Ocultar overlay | `part-03.js` | Sim, classe DOM | Nao | Sim | Nao | Nao | Nao | Nao canonico equivalente | Sim | Baixo | Mantido na bridge ES. |
| `setSidebarOpen` | D | Abrir/fechar sidebar com timers | `toggleSidebar` | Sim, classes/timer | Nao | Sim | Timer visual | Nao | Nao | Nao canonico equivalente | Sim | Medio | Mantido na bridge ES. |
| `toggleSidebar` | D | Alternar estado visual da sidebar | `part-03.js`, `legacy-events.js` por `toggleSidebar` global | Sim, chama sidebar | Nao | Sim | Timer visual | Nao | Nao | Nao canonico equivalente | Sim | Medio | Mantido na bridge ES. |
| `updateBackButton` | D | Mostrar/ocultar botao voltar | `part-03.js` | Sim, classe DOM | Nao | Sim | Nao | Nao | Nao | Router moderno parcial | Sim | Medio | Mantido; navegacao legada ainda controla historico. |
| `setHidden` | A | Toggle `hidden` por id | `part-07.js`, `part-08.js`, `part-14.js` | Sim, classe DOM | Nao | Sim | Nao | Nao | Nao | `src/ui/dom.js:setHidden` | Sim | Baixo | Bridge ES delega ao modulo canonico. |
| `setHtml` | A | Setar `innerHTML` por id | `part-07.js`, `part-08.js`, `part-14.js`, `part-29.js` | Sim, HTML DOM | Nao | Sim | Nao | Nao | Nao | `src/ui/dom.js:setHtml` | Sim | Medio | Bridge ES delega ao modulo canonico. |
| `setNodes` | A | Trocar filhos por nodes | `renderListState` e consumidores futuros | Sim, filhos DOM | Nao | Sim | Nao | Nao | Nao | `src/ui/dom.js:setNodes` | Sim | Baixo | Bridge ES delega ao modulo canonico. |
| `setText` | A | Setar `textContent` por id | `part-07.js` | Sim, texto DOM | Nao | Sim | Nao | Nao | Nao | `src/ui/dom.js:setText` | Sim | Baixo | Bridge ES delega ao modulo canonico. |
| `renderListState` | A | Renderizar lista/meta/empty/paginacao | `part-03.js`, `part-07.js` | Sim, DOM combinado | Nao | Sim | Nao | Nao | Nao | `src/ui/dom.js:renderListState` | Sim | Medio | Bridge ES adapta ids para elementos e delega. |
| `renderTotalBox` | A | Mostrar total e HTML condicional | `part-03.js` | Sim, HTML/classe | Nao | Sim | Nao | Nao | Nao | Nao canonico completo | Sim | Baixo | Mantido na bridge ES. |
| `activateTab` | D | Ativar botao de aba e exibir view | `part-03.js`, `part-08.js`, `monthDetailEvents.js` | Sim, classes/views | Nao | Sim | Nao | Nao | Nao | Router moderno parcial | Sim | Alto | Mantido na bridge ES; remocao bloqueada por navegacao classica. |

## Consumidores e bloqueios

- Consumidores classicos reais: `part-03.js`, `part-07.js`, `part-08.js`, `part-14.js`, `part-29.js`.
- Consumidores modernos/fallback: `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js`, `src/ui/records/financialCrudControllerInstaller.js`.
- HTML inline direto: nenhum novo encontrado para `financeUI`; o acesso ocorre por scripts e event bindings.
- Estado historico daquele lote: `window.financeUI` permanecia porque `part-03.js` e outros `part-XX` ainda chamavam a API em runtime. Atualizacao 5.20: `window.financeUI` nao e mais instalada; `window.financeApp.financeUiAdapters` permanece para os consumidores classicos remanescentes.

## Resultado estrutural

| Metrica | Antes | Depois |
| --- | ---: | ---: |
| Scripts classic/eval | 23/23 | 22/22 |
| Bytes do loader classico | 751896 | 746720 |
| APIs globais | 50 | 50 |
| Novo `eval` | 0 | 0 |
| `new Function` | 0 | 0 |

## Proximo lote

O proximo lote seguro deve atacar consumidores de navegacao e overlay em `part-03.js` e `part-29.js`, criando cobertura especifica para `switchTab`, `goBackTab`, dashboard detail modal e modais de exclusao antes de reduzir a bridge `financeUI`.

## Atualizacao dos consumidores `financeUI` - 12/09/2026

O lote seguinte removeu as chamadas diretas de `window.financeUI` em `part-03.js` e `part-29.js` sem remover a bridge. As chamadas visuais passaram a usar `window.financeApp.financeUiAdapters`, adapter ES fino instalado antes do pacote classico.

| Arquivo | Chamadas diretas antes | Chamadas diretas depois | Status |
| --- | ---: | ---: | --- |
| `src/legacy/inline/part-03.js` | 13 | 0 | Migrado para adapter visual |
| `src/legacy/inline/part-29.js` | 3 | 0 | Migrado para adapter visual |

Naquele lote, a bridge ainda era necessaria para `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos. O adapter novo nao contem `dataSdk`, Firebase, auth, formulas financeiras nem cria nova global.

## Atualizacao de consumidores modernos - 12/09/2026

`src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` nao dependem mais de `window.financeUI` nem de `window.financeApp.financeUiAdapters`. `part-07.js` tambem nao chama mais `window.financeUI` diretamente; por continuar classico, usa o adapter visual temporario apenas para DOM/lista/meta.

Bridge ainda necessaria para `part-08.js` e `part-14.js`. O gate `npm run finance-ui-consumers:check` passa a proteger `modernFinanceUiConsumers=[]` e `part07FinanceUiCalls=0`.
