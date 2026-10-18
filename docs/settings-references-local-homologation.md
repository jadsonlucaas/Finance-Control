# Homologacao local de Configuracoes e Referencias

Executado em: 18/09/2026

## Escopo

Esta homologacao cobre Configuracoes e Referencias no ambiente local com Vite, Auth Emulator e Firestore Emulator. Nao houve Firebase real, deploy, push, pull, fetch, Admin SDK, backend novo, alteracao de `firestore.rules`, alteracao de regras financeiras, mudanca de budget, baseline, timeout ou retry.

## Fluxo atual mapeado

UI ativa:

`viewConfiguracoesTemplate` -> `loadSettingsActiveUi` -> `settingsActiveUi` -> `settingsController` -> `settingsWebAdapter` -> `financeRecordMutations`/`dataSdk` -> Firestore Emulator.

Leitura:

`settingsController.load` -> `settingsWebAdapter.readSource.read` -> `financeApp.applicationDependencies.repositories.financeRecords.list` -> registros combinados em memoria, incluindo referencias pessoais e globais carregadas pelo `dataSdk`.

Escrita pessoal:

`settingsController.updatePersonReceivingType` -> `settingsWebAdapter.actions.updatePerson` -> `financeRecordMutations.updateRecord` -> `users/{uid}/finance_records/{recordId}`.

Escrita global solicitada por usuario comum:

`settingsController.saveMacro` -> `settingsWebAdapter.actions.createMacro` -> `resolveReferenceWriteScope` -> `SETTINGS_SHARED_REFERENCE_FORBIDDEN`. A gravacao e recusada antes de chamar repositorio/mutacao, sem converter para `personal`.

## Colecoes pessoais

- `users/{uid}`: perfil de conta.
- `users/{uid}/finance_records`: pessoas, macros pessoais, categorias pessoais e demais registros financeiros do owner.
- `users/{uid}/local_storage`: configuracoes locais sincronizaveis com prefixo `finance-control-`.

## Colecoes globais

- `shared_macros`: macros globais, leitura por usuario ativo, escrita apenas por admin autorizado.
- `shared_categories`: categorias globais, leitura por usuario ativo, escrita apenas por admin autorizado.

## Politica validada

- Usuario ativo le suas configuracoes pessoais.
- Usuario ativo le referencias globais conforme politica atual.
- Usuario comum nao recebe edicao visual para referencia global.
- Pedido manipulado de escopo `global` por usuario comum e recusado com `SETTINGS_SHARED_REFERENCE_FORBIDDEN`.
- Nao ha fallback silencioso de global para pessoal.
- Usuario B nao le nem altera configuracao pessoal de A.
- Troca A -> B -> A no mesmo navegador preserva somente o estado correto do usuario autenticado.
- Cliente nao emite, edita ou simula custom claims.

## Cobertura E2E

Arquivo: `tests/playwright/integration-local-settings-references.spec.js`

Teste 1, configuracoes pessoais e isolamento:

- Usuario A abre Configuracoes e ve apenas sua pessoa.
- A altera `receiving_type` de `mensal` para `quinzenal`.
- Reload preserva a configuracao de A.
- A reverte para `mensal` sem duplicar documento.
- B nao le nem escreve o documento pessoal de A.
- B abre Configuracoes e ve apenas sua pessoa.
- B altera sua propria configuracao para `quinzenal`.
- A volta e permanece intacto.

Teste 2, escopo global e fallback:

- A le `shared_macros` e `shared_categories` globais.
- Referencias globais aparecem como `Global` e sem botao de edicao para usuario comum.
- DOM manipulado tenta salvar macro global.
- A operacao e recusada, o modal permanece aberto e nenhum registro pessoal/global equivalente e criado.
- Snapshot adulterado por campo vazio retorna `SETTINGS_MACRO_NAME_REQUIRED` e nao persiste documento parcial.
- B le as mesmas referencias globais e nao recebe copia pessoal silenciosa.

## Cobertura Rules

Arquivo: `tests/firestore/firestore-rules.test.js`

Foram adicionados:

- `84A configuracao local pessoal e owner-scoped e rejeita acesso cruzado`.
- `84B configuracao local com contrato invalido e rejeitada`.

Esses testes complementam a cobertura ja existente de referencias globais/pessoais:

- Usuario ativo le `shared_macros` e `shared_categories`.
- Usuario comum nao cria, atualiza ou exclui globais.
- Admin autorizado mantem globais.
- Usuario ativo cria referencias pessoais proprias.
- Outro usuario nao le nem altera referencia pessoal.
- `shared_scope` invalido e rejeitado.
- Global em `finance_records` privado e rejeitado.
- Personal em caminho shared e rejeitado.

## Custom claims

O fluxo exercitado nao usa Admin SDK. O runtime validado nao expoe setter de custom claims e `financeApp.authContext.claims` permanece vazio para usuario comum. Perfil `role=user` e status `active` nao viram capacidade administrativa nem permissao para criar global.

## Dados invalidos

Cenario invalidado pela UI real:

- Modal de macro aberto.
- Campo `macro-input` vazio.
- `window.saveMacroCategory()` retorna `SETTINGS_MACRO_NAME_REQUIRED`.
- Modal permanece aberto.
- Nenhum documento pessoal parcial e criado.
- Nenhum global e alterado.

## Lacunas administrativas remanescentes

- Edicao global positiva por UI nao foi exercitada, porque exige autoridade administrativa confiavel fora do cliente.
- Emissao real de custom claims continua dependente de processo confiavel com Console, backend ou script server-side/Admin SDK futuro.
- UI admin completa com Emulator segue como lacuna propria ja rastreada.
- Busca administrativa global indexada segue fora do escopo desta homologacao.

## Resultado focado

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 84A --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 108 skipped (109)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 84B --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 108 skipped (109)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/integration-local-settings-references.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (30.2s)`, `Script exited successfully (code 0)`. |

## Resultado final da validacao 6.7

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 661 passed (661)`, duracao `14.08s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 11.59s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Primeira tentativa bloqueada por porta `5173` em uso; segunda execucao aprovada. `47 passed (1.4m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (8.8s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run settings-modernization:check` | Aprovado. `ok=true`, `violations=[]`, globais `50`, `classicScripts=22`, `evalExecutedScripts=22`. |
| `npm.cmd run settings:benchmark` | Aprovado. `ok=true`, cenarios de `100`, `1000` e `5000` referencias concluidos. |
| `npm.cmd run user-admin-modernization:check` | Aprovado. `ok=true`, `violations=[]`, globais `50`, `classicScripts=22`, `evalExecutedScripts=22`. |
| `npm.cmd run user-admin:benchmark` | Aprovado. `ok=true`, cenarios de `100`, `1000` e `5000` usuarios concluidos. |
| `npm.cmd run user-admin:query-check` | Aprovado. `ok=true`, 12 checks aprovados, filtros server-side suportados `status`, `role`, `status+role`. |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado com exit code `0`; logs `PERMISSION_DENIED`, limite de avaliacao e avisos internos fazem parte dos cenarios negativos/replay do emulador. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `6.00s`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/integration-local-settings-references.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (18.3s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite local emulada completa aprovada. `12 passed (1.6m)`, `Script exited successfully (code 0)`. |

Observacao: logs `PERMISSION_DENIED` sao esperados nos cenarios negativos de acesso cruzado e escrita global recusada. Avisos de WebChannel/Connection reset no encerramento sao ruido conhecido do Emulator.

Confirmacao final 6.7: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, politica administrativa, interface funcional, custom claim, budget, baseline, timeout ou retry foi alterado.
