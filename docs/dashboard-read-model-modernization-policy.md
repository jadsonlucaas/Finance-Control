# Politica de Modernizacao do Dashboard e Read Models

Executado em: 02/09/2026

## Fronteira criada

A leitura financeira do Dashboard passa a ter um read model canonico em `src/application/readModels/dashboardReadModel.js`. Esse modulo recebe registros, filtros, dados de referencia e adaptadores opcionais, e devolve `summary`, `kpis`, `charts`, `expenses`, `incomes`, `metadata` e `warnings` sem acessar DOM, `window`, Chart.js, Firebase, toast ou persistencia.

`src/ui/dashboard/dashboardData.js` permanece como adapter legado: ele le filtros da tela, usa bridges globais ainda consumidas pelo legado e delega a composicao final para o read model puro. Essa decisao preserva comportamento enquanto `part-03.js`, `part-16.js` e `part-29.js` ainda fornecem funcoes criticas para consolidacao de entradas, materializacao percentual e compatibilidade visual.

## Filtros

Os filtros puros ficam em `src/application/selectors/dashboardFilters.js`:

- competencia e periodo;
- pessoa;
- tipo;
- status;
- macro;
- categoria;
- ciclo;
- politica de arquivados;
- ordenacao e paginacao visual.

A paginacao visual fica limitada a listagens e nao altera o universo usado por KPIs, cards ou graficos.

## KPIs e graficos

Os KPIs continuam usando `selectDashboardTotals` e `selectPersonBalances`, agora compostos pelo read model. Os builders de dados de graficos ficam em `src/application/readModels/dashboardChartData.js`; o adapter Chart.js permanece em `src/ui/dashboard/dashboardCharts.js` e recebe dados prontos.

## Listagens

`src/application/readModels/expenseListReadModel.js` e `src/application/readModels/incomeListReadModel.js` centralizam leitura, filtros, ordenacao, paginacao visual e detalhe por `id` para Saidas e Entradas. Esses read models assumem dataset ja autorizado/escopado pelo chamador e nao decidem owner nem acessam repositorio.

## Controller e presenter

`src/ui/dashboard/dashboardController.js` orquestra fonte de leitura, read model, `AsyncViewState`, conectividade e relatorio de erro por dependencias injetadas. `src/ui/dashboard/dashboardPresenter.js` apenas distribui o view state para renderizadores recebidos por injecao.

## Bridges e legado

Nenhuma API global nova de topo foi adicionada. As bridges atuais continuam porque ainda ha consumidores em scripts classicos e handlers legados. Nenhum script saiu do loader nesta etapa: a permanencia e intencional porque `part-03.js`, `part-16.js` e `part-29.js` ainda contem dependencias reais de renderizacao, consolidacao de entradas, outras receitas/descontos e materializacao percentual.

## Garantias

- Read models nao usam `window`, `document`, `dataSdk`, Firebase, WhatsApp, webhook, telefone, provider externo ou Admin SDK.
- `source_channel` nao altera filtros, calculos ou KPIs.
- Renderizacao nao grava dados.
- KPIs usam o dataset funcional completo recebido, nunca a primeira pagina de listagem.
- Cache legado continua invalidado por `__financeDataVersion`, filtros e assinaturas de configuracao/regras.
- Troca de usuario deve continuar limpando `allRecords` e listeners no fluxo legado; os novos controllers expoem `destroy()` para encerrar subscriptions injetadas.

## Validacao local

Executada em: 02/09/2026

- `npm run inventory:globals`: aprovado, 50 APIs globais inventariadas.
- `npm test`: aprovado, 79 arquivos e 505 testes.
- `npm run build`: aprovado.
- `npm run smoke`: aprovado, status `ok`, URL local `http://127.0.0.1:5175/`.
- `npx playwright test tests/playwright/regression-local.spec.js`: aprovado, 33 testes.
- `npm run perf:audit`: aprovado, 2 testes.
- `npm run bundle:budget`: aprovado.
- `npm run resilience:dry-run`: aprovado, `wrote=false`, `firebase_touched=false`.
- `npm run post-commit:dry-run`: aprovado, `wrote=false`, `firebase_touched=false`.
- `npm run dashboard:benchmark`: aprovado, `wrote=false`.
- `npm run dashboard-modernization:check`: aprovado, `wrote=false`, 50 globais, 33 scripts classicos, 33 eval.
- `npx firebase emulators:exec --only firestore "npm.cmd run test:rules"`: aprovado, 121 cenarios Firestore.
- `npx firebase emulators:exec --only auth,firestore "npm.cmd run test:auth-flow"`: aprovado, 20 cenarios Auth Flow.

Observacao: `vitest.auth-flow.config.js` recebeu apenas aumento de `hookTimeout` para 60s porque o Emulator local excedeu o limite anterior de 10s no `beforeAll`. Isso nao altera comportamento da aplicacao.
