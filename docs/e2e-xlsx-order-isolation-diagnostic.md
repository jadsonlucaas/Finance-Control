# Diagnostico de isolamento de ordem do E2E XLSX

Executado em: 18/09/2026

## Escopo

Isolar a falha da suite E2E local completa em `tests/playwright/integration-local-import-xlsx.spec.js`, sem alterar parser XLSX, fingerprint, idempotencia, Firestore Rules, Auth, regras financeiras, UI funcional, timeouts, retries, deploy, push, pull, fetch ou Firebase real.

## Ambiente

- Branch: `melhoria-arquitetura`
- HEAD inicial: `adfb82d fix: corrige rules de horas e homologa persistencia real`
- Remote: nenhum remote configurado
- Projeto emulado: `demo-finance-control-local-e2e`
- Vite E2E local: `http://127.0.0.1:5178`
- Auth Emulator: `127.0.0.1:9099`
- Firestore Emulator: `127.0.0.1:8080`

## Sintoma reproduzido

A suite completa `playwright.e2e-local.config.js` falhava quando os cenarios de importacao XLSX eram executados apos os testes de financeiro e controle de horas. O teste XLSX isolado passava.

Falha observada na etapa 6.5:

- Primeira suite completa: `1 failed`, `7 passed`, falha em `integration-local-import-xlsx.spec.js:468`.
- Segunda suite completa: `2 failed`, `6 passed`, falhas em `integration-local-import-xlsx.spec.js:468` e `integration-local-import-xlsx.spec.js:577`.
- Sintoma: `#modern-import-summary` permanecia vazio logo apos clicar em preview.

## Causa raiz

O helper `preparePreview` clicava em `#modern-import-preview` e imediatamente aguardava texto no DOM (`#modern-import-summary`). Em execucao isolada o processamento do preview e a renderizacao terminavam rapido o suficiente. Na suite completa, apos cenarios anteriores e carregamentos lazy, havia uma janela em que o controller ainda nao tinha publicado `previewModel` nem renderizado o resumo.

A dependencia era de ordem/carga do harness E2E, nao colisao de dados:

- Firestore e Auth eram limpos entre cenarios.
- O parser XLSX puro nao foi alterado.
- Fingerprint, `batchId`, receipts e idempotencia nao foram alterados.
- A falha ocorria antes do commit, no estado de preview/renderizacao.

## Correcao aplicada

Arquivo: `tests/playwright/integration-local-import-xlsx.spec.js`

- `preparePreview` agora espera um sinal deterministico do controller: `previewModel` disponivel ou `viewState.error`.
- Se houver erro, o snapshot de estado e incluido na mensagem `IMPORT_PREVIEW_NOT_READY`.
- A assercao de DOM continua existindo, mas somente depois que o controller publicou o estado de preview.
- O `afterEach` fecha explicitamente `page` e `context` antes da limpeza de Auth/Firestore Emulator, reduzindo residuos de canais do navegador entre cenarios.

## Evidencias

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js tests/playwright/integration-local-finance.spec.js tests/playwright/integration-local-hours.spec.js tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Reproduziu a falha antes da correcao: `1 failed`, `4 passed`, falha no XLSX misto. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Aprovado isolado apos a correcao: `2 passed (40.8s)`, script interno `code 0`; o Firebase CLI retornou timeout apenas no shutdown do emulador em uma execucao isolada. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 1 aprovada: `8 passed (1.5m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 2 aprovada: `8 passed (1.3m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 3 aprovada: `8 passed (2.3m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Auditoria/horas preservada: `2 passed (36.2s)`, `Script exited successfully (code 0)`. |

## Decisao

A falha foi tratada como fragilidade de sincronizacao do teste, nao como bug funcional da importacao. A correcao torna o E2E independente da ordem da suite ao aguardar o estado canonico do controller antes de validar a renderizacao.

Confirmacao: nenhum arquivo funcional da aplicacao foi alterado nesta correcao 6.5A. Nenhum dado real, Firebase real, deploy, push, pull, fetch, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi usado.
