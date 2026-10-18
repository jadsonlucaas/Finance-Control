# Diagnostico de Modernizacao do Dashboard e Read Models

Gerado em: 02/09/2026

Este diagnostico registra a arquitetura de leitura financeira antes da migracao incremental para read models canonicos. Nao altera regras financeiras, formulas, autenticacao, Firestore Rules, importacoes, backup/restore, parcelamentos, recorrencias, tributos, horas, materializacao percentual, Firebase real ou canais externos.

## Arquitetura atual de leitura

O Dashboard moderno ja esta parcialmente separado em `src/ui/dashboard`, mas ainda depende de adapters legados e estado global:

- `src/ui/dashboard/dashboardRenderer.js`: orquestra render do Dashboard, instala bridges globais e agenda graficos pesados.
- `src/ui/dashboard/dashboardData.js`: monta bases de entradas/saidas, totais, agregacoes e series de tendencia, mas ainda le filtros do DOM, usa `window`, `localStorage` e bridges legadas.
- `src/ui/dashboard/dashboardCharts.js`: mistura builder de configuracao visual Chart.js com preparacao de datasets e callbacks de detalhe.
- `src/ui/dashboard/dashboardCards.js`: renderiza cards, listas recentes e modais de detalhe usando DOM e algumas leituras globais.
- `src/ui/dashboard/dashboardEvents.js`: instala listeners com marcadores `dataset` para evitar duplicacao.
- `src/ui/dashboard/dashboardFilters.js`: normaliza range de competencias, mas ainda le e escreve diretamente nos campos do DOM.

## Origem dos dados

O fluxo principal obtem dados de `window.allRecords`, atualizado pelo `dataHandler` de `part-03.js` apos `window.dataSdk.init`. A leitura moderna usa `queryFinanceRecordsForTarget` de `src/state/financeRecordIndex.js`, que indexa o array completo autorizado por tipo, pessoa, status e competencia. Esse indice e local/cacheado por versao de dados e nao deve ser substituido por pagina unica para KPIs.

Leituras paginadas existem em repositorios de aplicacao e Firestore, mas os KPIs do Dashboard dependem do dataset funcional completo autorizado. A paginacao deve ser usada para listagens, nunca como universo de agregacao financeira.

## Filtros atuais

Filtros de Dashboard sao lidos de:

- `#f-comp-start`
- `#f-comp-end`
- `#f-person`
- `#f-macro`
- `#f-cycle`
- foco visual de card em `appState.focusedDashboardCard`

Filtros de listagem usam tambem status, forma de pagamento, macro, pessoa, busca textual e modo de arquivo. A logica esta distribuida entre `part-03.js`, `dashboardData.js`, `dashboardFilters.js` e `financeRecordIndex.js`.

## Agregacoes e KPIs

Os KPIs reais ja existentes sao:

- total de entradas;
- total de saidas;
- saldo/sobra;
- saidas pagas;
- saidas em aberto;
- entradas por pessoa/ciclo/tipo;
- saidas por macro/categoria, subcategoria e pessoa;
- balances por pessoa;
- evolucao mensal/diaria para grafico.

Parte dos calculos esta em `src/application/selectors/financialSelectors.js` e `src/domain/dashboard.js`, mas a composicao ainda ocorre em `dashboardData.js` com dependencia de DOM e `window`.

## Graficos

Os graficos usam Chart.js em `dashboardCharts.js`:

- rosca por macro/categoria;
- barras horizontais por subcategoria;
- barras horizontais por pessoa;
- tendencia diaria quando ha uma competencia;
- tendencia mensal quando ha range.

Os dados de tendencia sao preparados em `dashboardData.js`, enquanto as configuracoes e callbacks visuais ficam em `dashboardCharts.js`. A etapa segura e extrair builders puros de dados e manter Chart.js somente no adapter visual.

## Globais e bridges

Bridges atuais relevantes:

- `renderDashboard`
- `renderSaidas`
- `renderEntradas`
- `openEntryDetailModal`
- `formatCompetence`
- `fmt`
- `switchTab`
- `goBackTab`
- `getDashboardBaseSaidas`
- `getDashboardBaseEntradas`
- `getDashboardTotals`
- `getDashboardAggregations`

Essas bridges ainda possuem consumidores legados ou de smoke/Playwright. Nenhuma deve ser removida sem busca completa de consumidores e teste especifico.

## Side effects

Renderizacao do Dashboard atual:

- atualiza DOM;
- agenda icones;
- cria/destroi instancias Chart.js;
- abre/fecha modais;
- instala listeners com guards;
- nao deve gravar dados financeiros.

Foram identificadas escritas fora do render principal, como atualizacao por competencia arquivada em `part-03.js`, mas elas nao pertencem ao caminho de read model e nao devem ser acionadas por render.

## Scripts classicos

`src/legacy/classicScripts.js` carrega 33 scripts por `eval`. O principal script envolvido em Dashboard/listagens e `src/legacy/inline/part-03.js`. Ele ainda contem bootstrap de dados, tabs, formulario, detalhes, listagens e handlers globais. Remover esse script nesta etapa nao e seguro.

Cenario adotado: extrair read models puros e manter bridges legadas. A reducao de `eval` fica bloqueada ate que `renderDashboard`, `renderSaidas`, `renderEntradas`, detalhes e tabs tenham consumidores migrados com testes de regressao especificos.

## Riscos de regressao

- KPI calculado sobre pagina de listagem em vez de dataset completo.
- Filtro de competencia variar conforme ordem de aplicacao.
- `source_channel` alterar indevidamente totais.
- Registro arquivado ou cancelado entrar em KPI ativo.
- Render criar listener duplicado ou instancia Chart.js duplicada.
- Troca de usuario reutilizar cache derivado de owner anterior.
- Read model mutar `allRecords`.
- Bridge removida com consumidor legado ainda ativo.

## Sequencia segura

1. Criar selectors puros compartilhados para filtros.
2. Criar read model puro do Dashboard.
3. Criar builders puros de dados de grafico.
4. Criar read models de listagem de saidas e entradas.
5. Criar controller/presenter modernos com dependencia injetavel.
6. Adaptar `dashboardData.js` para consumir o read model, preservando as bridges.
7. Adicionar testes de equivalencia, pureza, paginação visual e ausencia de novas globais/eval.
8. Documentar permanencia dos scripts classicos.

## Resultado da modernizacao local

Foram criados read models puros para Dashboard, Saidas e Entradas e builders puros de grafico. `src/ui/dashboard/dashboardData.js` passou a ser adapter de compatibilidade, mantendo as bridges globais existentes. Nenhum script classico foi removido porque os consumidores legados reais permanecem em `part-03.js`, `part-16.js` e `part-29.js`.

Contadores preservados nesta etapa:

- APIs globais: <= 58
- scripts classicos/eval: <= 33
- novas APIs globais de topo: 0
- novos eval: 0
- Firebase real, deploy, WhatsApp, webhook, telefone, provider externo ou Admin SDK: nao

## Evidencias executadas

- `npm run inventory:globals`: 50 APIs globais.
- `npm test`: 79 arquivos, 505 testes.
- `npm run build`: aprovado.
- `npm run smoke`: `status=ok`, localhost `http://127.0.0.1:5175/`.
- `npx playwright test tests/playwright/regression-local.spec.js`: 33 testes.
- `npm run perf:audit`: 2 testes.
- `npm run bundle:budget`: aprovado.
- `npm run resilience:dry-run`: `ok=true`, `wrote=false`, `firebase_touched=false`.
- `npm run post-commit:dry-run`: `ok=true`, `wrote=false`, `firebase_touched=false`.
- `npm run dashboard:benchmark`: 100 registros `0.282ms`, 1.000 registros `0.556ms`, 5.000 registros `2.135ms`, 10.000 registros `2.429ms`, `wrote=false`.
- `node scripts/analyze-legacy-loader.mjs`: 33 scripts classicos, 33 eval executados, 2 ocorrencias de `eval` no loader, 0 `new Function`.
- `npx firebase emulators:exec --only firestore "npm.cmd run test:rules"`: aprovado.
- `npx firebase emulators:exec --only auth,firestore "npm.cmd run test:auth-flow"`: aprovado apos ajuste de `hookTimeout` de teste para 60s.
