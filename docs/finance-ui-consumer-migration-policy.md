# Politica de migracao dos consumidores `financeUI`

## Objetivo

Reduzir chamadas diretas a `window.financeUI` e impedir que a exposicao publica volte a ser instalada. Consumidores classicos remanescentes devem usar apenas `window.financeApp.financeUiAdapters` ate migrarem para ES Modules ou dependencias explicitas.

## Regras

- `part-03.js` e `part-29.js` devem usar `window.financeApp.financeUiAdapters` para chamadas visuais ja migradas.
- `part-07.js` deve usar `window.financeApp.financeUiAdapters` apenas para chamadas visuais enquanto permanecer no pacote classico.
- Modulos modernos em `src/ui/importacao.js`, `src/ui/monthDetail/**`, `src/ui/records/**`, `src/ui/imports/**`, `src/ui/settings/**`, `src/ui/admin/**`, `src/ui/planner/**`, `src/ui/hours/**`, `src/ui/reports/**` e `src/ui/backup/**` nao podem depender de `window.financeUI` nem de `window.financeApp.financeUiAdapters`; devem usar imports ES explicitos ou injecao local.
- O adapter deve permanecer fino, visual e sem dependencia de `dataSdk`, Firebase, auth, Firestore Rules, formulas financeiras, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, horas ou materializacao percentual.
- O adapter nao pode criar nova global em `window`; ele fica sob `window.financeApp.financeUiAdapters`, que e um namespace ja existente da aplicacao.
- `window.financeUI` nao deve ser reinstalada: a exposicao publica foi aposentada apos auditoria sem consumidores runtime efetivos.
- `src/ui/legacy-ui.js` permanece como implementacao ES dos helpers visuais e dos adapters aninhados.
- Migrar uma chamada para `window.financeApp.financeUiAdapters` e apenas consolidacao de compatibilidade; nao conta como injecao de dependencia nem como eliminacao de superficie global.
- Antes de remover qualquer funcao da bridge, executar busca textual completa, smoke, Playwright, `npm run finance-ui-consumers:check`, `npm run legacy-loader:check`, `npm run bundle:budget` e testes de regressao.
- Nenhuma migracao de consumidor visual autoriza mover regra financeira ou alterar payloads/persistencia.

## Gate estrutural

`npm run finance-ui-consumers:check` deve permanecer aprovado com:

- `modernFinanceUiConsumers = []`;
- `part07FinanceUiCalls = 0`;
- `part08FinanceUiCalls = 0`;
- `part14FinanceUiCalls = 0`;
- `remainingConsumers = ["src/legacy/inline/part-03.js","src/legacy/inline/part-07.js","src/legacy/inline/part-29.js"]`, representando consumidores runtime diretos e indiretos conhecidos;
- `directFinanceUiConsumers = []`;
- `financeUiAdapterConsumers` lista consumidores remanescentes de `window.financeApp.financeUiAdapters`;
- `navigationBridgeConsumers = []`;
- `globals <= 50`;
- `classicScripts <= 22`;
- `evalExecutedScripts <= 22`;
- `newEval = 0`;
- `newFunction = 0`;
- `wrote = false`.

## Proximo lote recomendado

Converter `part-08.js:switchTab` inteiro para ES Module somente em lote proprio de estado de navegacao. A exposicao `window.financeUI` nao deve voltar; qualquer mudanca nos adapters aninhados ainda exige cobertura de router, historico de tabs, lazy loaders, sidebar, reload por hash, smoke e Playwright.

## Atualizacao 5.20 - aposentadoria de `window.financeUI`

`window.financeUI` deixou de ser instalada no runtime. Os consumidores remanescentes continuam usando `window.financeApp.financeUiAdapters`, que agora recebe a implementacao ES diretamente por `createLegacyUiBridge(target)`.

Essa retirada nao elimina o legado, nao remove `financeUiAdapters`, nao reduz `classic/eval` artificialmente e nao autoriza migrar `part-03`, `part-07` ou `part-29` sem lote especifico.
