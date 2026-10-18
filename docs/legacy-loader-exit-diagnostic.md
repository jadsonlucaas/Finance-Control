# Diagnostico de Saida do Loader Legado

Gerado em: 2026-09-08

## Escopo

Esta etapa encerra a Fase 5 com reducao segura e mensuravel do loader legado. A mudanca nao altera regras financeiras, autenticacao, Firestore Rules, UI funcional, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, horas ou materializacao percentual.

## Baseline e Resultado

| Metrica | Antes | Depois |
| --- | ---: | ---: |
| Scripts classicos no loader | 33 | 23 |
| Scripts executados por eval | 33 | 23 |
| Bytes dos scripts classicos carregados | 776933 | 751896 |
| APIs globais inventariadas | 50 | 50 |
| Novo eval fora do loader | 0 | 0 |
| `new Function` | 0 | 0 |
| Budget oficial do entry | 430080 | 430080 |

## Lote Escolhido Antes da Edicao

Scripts classificados como `A. DEAD / SEM CONSUMIDOR` e removidos apenas de `src/legacy/classicScripts.js`:

- `src/legacy/inline/part-21.js`
- `src/legacy/inline/part-22.js`
- `src/legacy/inline/part-23.js`
- `src/legacy/inline/part-24.js`
- `src/legacy/inline/part-25.js`
- `src/legacy/inline/part-30.js`
- `src/legacy/inline/part-31.js`

Os arquivos foram preservados no historico e no diretorio para rastreabilidade, mas deixaram de ser carregados e executados por `eval`. Nenhuma bridge foi criada, movida ou removida porque esses arquivos nao declaram funcoes, nao atribuem `window.*`, nao acessam DOM e nao chamam `dataSdk`.

## Inventario dos 33 Scripts

| Script | Bytes | Responsabilidade | Funcoes | Globals | DOM | `dataSdk` | Classificacao | Recomendacao |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| `src/legacy-globals.js` | 11629 | Helpers globais historicos e utilitarios de compatibilidade | 25 | 0 | 0 | 0 | B. BRIDGE-ONLY | Removido do loader no segundo lote; substituido por `installGlobalBridge()` instalado explicitamente antes do legado. |
| `src/services/libraryLoader.global.js` | 2857 | Loader local de bibliotecas visuais/PDF/XLSX | 4 | 0 | 3 | 0 | D. UI MEDIUM-RISK | Removido do loader no terceiro lote; substituido por `src/services/libraryLoader.js` e bridge `src/legacy/libraryLoaderBridge.js`. |
| `src/services/performanceMonitor.global.js` | 9670 | Monitor local de performance e metricas de UI | 16 | 0 | 3 | 0 | C. UI LOW-RISK | Removido do loader no segundo lote; substituido por `src/services/performanceMonitor.js` via ES Module antes do legado. |
| `src/ui/legacy-ui.js` | 5176 | Utilitarios DOM de UI legada | 16 | 0 | 3 | 0 | D. UI MEDIUM-RISK | Manter; pode afetar modais/toasts legados. |
| `src/legacy/inline/part-03.js` | 337625 | Core legado de app, CRUD, dashboard, entradas e PDF legado | 250 | 8 | 417 | 12 | E. FINANCIAL-CRITICAL | Nao migrar em lote amplo; quebrar por dominio com testes especificos. |
| `src/legacy/inline/part-04.js` | 7054 | Calculos tributarios legados/bridge fiscal | 13 | 0 | 0 | 0 | E. FINANCIAL-CRITICAL | Manter; formulas fiscais exigem congelamento versionado. |
| `src/legacy/inline/part-05.js` | 11712 | Persistencia/acoes financeiras legadas | 6 | 0 | 15 | 3 | E. FINANCIAL-CRITICAL | Manter; toca mutacoes financeiras. |
| `src/legacy/inline/part-06.js` | 13045 | Formularios e operacoes legadas de registros | 9 | 0 | 41 | 2 | E. FINANCIAL-CRITICAL | Manter; exige cobertura CRUD e ordem de bootstrap. |
| `src/legacy/inline/part-07.js` | 16805 | UI de listagem/detalhes financeiros | 6 | 0 | 20 | 0 | D. UI MEDIUM-RISK | Candidato apos extrair handlers e validar modais. |
| `src/legacy/inline/part-08.js` | 7397 | Parcelamentos legados e bridge `renderParcelamentos` | 5 | 1 | 15 | 2 | E. FINANCIAL-CRITICAL | Manter; parcelamentos afetam valores e status. |
| `src/legacy/inline/part-09.js` | 30731 | UI e auxiliares de entradas | 7 | 0 | 44 | 0 | E. FINANCIAL-CRITICAL | Manter; depende de consolidacao de entradas. |
| `src/legacy/inline/part-10.js` | 3001 | Fragmento UI de entradas sem funcoes globais | 0 | 0 | 5 | 0 | D. UI MEDIUM-RISK | Nao remover ainda; pode depender de ordem/side effects DOM. |
| `src/legacy/inline/part-11.js` | 7197 | Ajustes/descontos de entradas | 4 | 1 | 6 | 2 | E. FINANCIAL-CRITICAL | Manter; duplicidade com `part-13` ainda documentada. |
| `src/legacy/inline/part-12.js` | 6017 | Complemento visual de entradas | 0 | 0 | 5 | 0 | D. UI MEDIUM-RISK | Candidato futuro apos smoke focado em entradas. |
| `src/legacy/inline/part-13.js` | 3371 | Bridge atual de desconto de entradas | 1 | 1 | 1 | 2 | E. FINANCIAL-CRITICAL | Manter; sobrescreve implementacao antiga com persistencia. |
| `src/legacy/inline/part-14.js` | 15520 | Fluxos legados de despesas/entradas com persistencia | 4 | 0 | 22 | 3 | E. FINANCIAL-CRITICAL | Manter; precisa casos de uso por comando. |
| `src/legacy/inline/part-15.js` | 8756 | UI auxiliar de entradas/detalhes | 3 | 0 | 10 | 0 | D. UI MEDIUM-RISK | Candidato futuro com teste de detalhes de entrada. |
| `src/legacy/inline/part-16.js` | 58685 | Modais de entradas, descontos e outras receitas | 22 | 4 | 63 | 7 | E. FINANCIAL-CRITICAL | Manter; toca outras receitas e descontos. |
| `src/legacy/inline/part-17.js` | 8260 | UI complementar legada | 3 | 0 | 12 | 0 | D. UI MEDIUM-RISK | Candidato futuro apos identificar handlers. |
| `src/legacy/inline/part-18.js` | 4088 | Fragmento UI/templating legado | 0 | 0 | 6 | 0 | D. UI MEDIUM-RISK | Manter; exige prova de side effects. |
| `src/legacy/inline/part-19.js` | 5747 | Persistencia auxiliar financeira | 1 | 0 | 4 | 2 | E. FINANCIAL-CRITICAL | Manter; usa `dataSdk`. |
| `src/legacy/inline/part-20.js` | 36594 | UI/fluxos financeiros legados extensos | 14 | 0 | 48 | 5 | E. FINANCIAL-CRITICAL | Manter; alto acoplamento com registros. |
| `src/legacy/inline/part-21.js` | 122 | Placeholder aposentado de dashboard | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |
| `src/legacy/inline/part-22.js` | 111 | Placeholder aposentado de graficos | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |
| `src/legacy/inline/part-23.js` | 114 | Placeholder aposentado de drilldown | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |
| `src/legacy/inline/part-24.js` | 115 | Placeholder aposentado de tendencias | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |
| `src/legacy/inline/part-25.js` | 181 | Placeholder aposentado de tendencia | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |
| `src/legacy/inline/part-26.js` | 24522 | Controle de horas legado/UI | 20 | 0 | 23 | 0 | E. FINANCIAL-CRITICAL | Manter; calculos/fluxos de jornada requerem lote proprio. |
| `src/legacy/inline/part-27.js` | 16791 | Controle de horas/UI complementar | 5 | 0 | 19 | 0 | E. FINANCIAL-CRITICAL | Manter; acoplado a horas. |
| `src/legacy/inline/part-28.js` | 23422 | Calendario/planner legado e bridges | 21 | 1 | 40 | 0 | D. UI MEDIUM-RISK | Manter; validar lazy planner antes de extrair. |
| `src/legacy/inline/part-29.js` | 100380 | Configuracoes, regras percentuais, filtros e bridges modernas | 75 | 15 | 105 | 4 | E. FINANCIAL-CRITICAL | Manter; regras percentuais e varias bridges ainda consumidas. |
| `src/legacy/inline/part-30.js` | 120 | Placeholder aposentado de dashboard mensal | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |
| `src/legacy/inline/part-31.js` | 118 | Placeholder aposentado de dashboard/graficos | 0 | 0 | 0 | 0 | A. DEAD / SEM CONSUMIDOR | Removido do loader nesta etapa. |

## Scripts Criticos Mantidos

Os scripts mantidos com classificacao `FINANCIAL-CRITICAL` continuam no loader porque possuem calculo financeiro, persistencia, `dataSdk`, regras percentuais, entradas, parcelamentos ou controle de horas. A proxima migracao deve ser por caso de uso, com testes de regressao dedicados e bridge explicita.

## Segundo Lote - Bridges e Monitor

Executado em: 2026-09-08

- `src/legacy-globals.js`: removido do classic/eval loader. A compatibilidade agora vem da instalacao ES explicita `installGlobalBridge(globalThis)`, que delega para `src/core` e `src/domain`, preserva `window.financeDomain` e e reaplicada depois do pacote classico para restaurar bridges canonicas sobrescritas por declaracoes globais legadas.
- `src/services/performanceMonitor.global.js`: removido do classic/eval loader. O monitor foi migrado para `src/services/performanceMonitor.js` e instalado por `loadLegacyClassicScripts()` antes do lote legado remanescente.
- `src/services/libraryLoader.global.js`: mantido. Ainda possui consumidores reais em `part-03.js`, importacao, PDF lazy e testes; a decisao segura e migrar em lote proprio de dependencias visuais.
- `src/ui/legacy-ui.js`: mantido. Ainda fornece `window.financeUI` para `part-03.js`, `part-08.js` e UI moderna; a decomposicao deve separar navegacao, toast/modal e helpers DOM antes de sair do loader.
- Bridges mantidas: todas as bridges de dominio/core instaladas por `installGlobalBridge()`, `window.financeDomain`, `window.financeGlobalBridge`, `window.financePerformance`, `window.financeUI` e bibliotecas lazy.
- Bridges removidas: nenhuma.
- APIs globais removidas: nenhuma; total permaneceu em 50.
- Resultado: classic/eval `26/26 -> 24/24`; bytes legados `776052 -> 754753`; `new Function = 0`; nenhum novo `eval` fora do loader.

## Terceiro Lote - Loader de Bibliotecas

Executado em: 2026-09-08

`src/services/libraryLoader.global.js` saiu do classic/eval loader. A implementacao canonica ficou em `src/services/libraryLoader.js`, com URLs existentes, Promise cacheada por biblioteca, retry apos falha, erro normalizado como `LAZY_LOAD_FAILED`, suporte a `target/documentRef` injetavel e sem `eval`/`new Function`.

Bridges temporarias mantidas por `src/legacy/libraryLoaderBridge.js`: `financeLibraryLoader`, `loadExternalLibrary`, `isAllowedExternalLibraryUrl`, `ensurePdfLibraries` e `ensureSpreadsheetLibrary`. Elas continuam necessarias porque `part-03.js` chama `ensurePdfLibraries()` no PDF legado, `ensureSpreadsheetLibrary()` na importacao XLSX legada, `src/ui/importacao.js` usa `loadExternalLibrary()` para PDFJS e a UI moderna de PDF/importacao ainda injeta os helpers globais como compatibilidade.

Classificacao das bibliotecas: Chart.js e Lucide usam ES import local em `src/services/localVisualLibraries.js`; XLSX usa `ensureSpreadsheetLibrary()` sob demanda; jsPDF/autotable usa `ensurePdfLibraries()` sob demanda; PDFJS permanece lazy em `src/ui/importacao.js`; Firebase continua fora desse loader e carrega por `installFirebaseServicesWhenReady()`.

`legacy-ui.js` foi revalidado e permaneceu no loader. Funcoes A-D identificadas: `byId`, `showElement`, `hideElement`, `showToast`, `showOverlay`, `hideOverlay`, `setSidebarOpen`, `toggleSidebar`, `updateBackButton`, `setHidden`, `setHtml`, `setNodes`, `setText`, `renderListState`, `renderTotalBox` e `activateTab`. O arquivo ainda e bloqueado por consumidores classicos reais em `part-03.js`, `part-07.js`, `part-08.js`, `part-14.js`, `part-29.js` e fallback moderno em `financialCrudControllerInstaller.js`/`importacao.js`. Nenhuma funcao foi extraida nesta etapa para nao alterar timing visual, markup, IDs ou navegacao.

Resultado: classic/eval `24/24 -> 23/23`; bytes legados `754753 -> 751896`; APIs globais `50 -> 50`; nenhum novo `eval`; `new Function = 0`.

## Proximo Lote Recomendado

1. `src/ui/legacy-ui.js`: extrair `financeUI` para installer ES apenas depois de cobrir navegacao, overlay, toast e render list em smoke/Playwright focados.
2. `src/legacy/inline/part-12.js` ou `part-18.js`: investigar side effects DOM antes de remover do loader.
3. `src/legacy/inline/part-07.js`, `part-10.js`, `part-15.js` e `part-17.js`: mapear UI pura sem tocar regras financeiras.

Nenhum item acima esta autorizado automaticamente. Cada lote exige grafo de consumidores atualizado, smoke, Playwright, `legacy-loader:check` e preservacao de bridge quando houver consumidor legado.

## Correcao de Bootstrap dos Loaders - 09/09/2026

A regressao observada de `203.899ms -> 248.914ms` foi auditada antes de novo lote de remocao. A bridge de bibliotecas deixou de importar `src/services/libraryLoader.js` estaticamente e passou a carregar o loader canonico apenas no primeiro uso real de XLSX/PDF/PDFJS.

Resultado estrutural preservado: `classic/eval=23/23`, bytes legados `751896`, APIs globais `50`, entry `373064` bytes, sem retorno de `src/services/libraryLoader.global.js`, sem migrar `src/ui/legacy-ui.js`.

O benchmark final ainda nao atingiu o limite orientativo de `224.3ms` para `loadMs`; a instrumentacao mostrou predominancia de `document-load`/Vite local e chunks legados. Portanto, nenhum novo script legado foi migrado nesta etapa.

## Decomposicao de `legacy-ui.js` - 11/09/2026

`src/ui/legacy-ui.js` saiu do classic/eval loader e passou a ser ES Module instalado por `installLegacyUiBridge(target)` em `src/legacy/classicScripts.js` antes do pacote classico. A API `window.financeUI` foi preservada via `bridgeRegistry`.

## Consumidores `financeUI` em `part-03` e `part-29` - 12/09/2026

`part-03.js` e `part-29.js` continuam no pacote classic/eval, mas suas chamadas visuais diretas a `window.financeUI` foram migradas para `window.financeApp.financeUiAdapters`, instalado por ES Module antes dos scripts classicos.

Resultado estrutural preservado: `classic/eval=22/22`, APIs globais `50`, novo `eval=0`, `new Function=0`, budget oficial `430080`. Bytes legados ficaram em `747024`, ainda abaixo do baseline de saida do loader (`776933`). Naquele lote, a bridge `window.financeUI` permanecia porque `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos ainda consumiam a API em runtime.

Resultado estrutural: `classic/eval=23/23 -> 22/22`, bytes legados `751896 -> 746720`, APIs globais `50 -> 50`, nenhum novo `eval`, `new Function=0`. Consumidores classicos reais permanecem em `part-03.js`, `part-07.js`, `part-08.js`, `part-14.js` e `part-29.js`, portanto a bridge ainda nao pode ser removida.

## Consumidores modernos `financeUI` e `part-07` - 12/09/2026

Os consumidores modernos de Importacao, Month Detail e records deixaram de acessar `window.financeUI`/`financeUiAdapters`. `part-07.js` deixou de chamar `window.financeUI` diretamente e usa o adapter visual temporario por ainda estar no pacote classico.

Resultado estrutural esperado daquele lote: `classic/eval=22/22`, `modernFinanceUiConsumers=[]`, `part07FinanceUiCalls=0`, consumidores diretos remanescentes apenas em `part-08.js` e `part-14.js`. Nenhum script foi removido do loader naquela etapa. Atualizacao 5.20: `window.financeUI` nao e mais instalada; `financeApp.financeUiAdapters` permanece para consumidores classicos remanescentes.

## Consumidores criticos `financeUI` em `part-08` e `part-14` - 12/09/2026

As chamadas puramente visuais de Configuracoes foram caracterizadas em Playwright antes da mudanca e migradas para DOM local equivalente. `part-08.js` caiu de `9` para `1` chamada direta (`switchTab -> activateTab`), e `part-14.js` caiu de `4` para `0`.

Resultado estrutural preservado: `classic/eval=22/22`, APIs globais `50`, novo `eval=0`, `new Function=0`. Nenhum script saiu do loader. Apos a extracao ES da navegacao, `part-08.js:switchTab` nao depende de `window.financeUI.activateTab`, nao usa `financeUiAdapters.activateTab` e nao contem mais helper visual classico duplicado; a ativacao visual efetiva passa por `src/ui/navigation/navigationCoordinator.js` e `src/ui/navigationTabs.js:activateTab`.
