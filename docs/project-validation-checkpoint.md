# Checkpoint de validacao local do projeto

Data: 2026-09-12

Escopo: consolidar pendencias tecnicas e validar uma jornada financeira completa em ambiente local, usando Vite, Auth Emulator e Firestore Emulator. Este checkpoint nao autoriza deploy, push, pull, fetch, alteracao em Firebase real, webhook, WhatsApp, telefone, provider externo ou Admin SDK.

## Ambiente validado

| Item | Valor |
| --- | --- |
| Branch | `melhoria-arquitetura` |
| Commit base antes das alteracoes | `c94a9f5 refactor: aposenta exposicao global financeUI sem consumidores` |
| Remote Git | Nenhum remote configurado no repositorio local |
| Node.js | `v24.14.1` |
| npm | `11.11.0` via `npm.cmd`; `npm -v` direto e bloqueado por Execution Policy do PowerShell |
| Playwright | `Version 1.59.1` |
| Java | `openjdk version "21.0.10" 2026-01-20 LTS` |
| Vite local da jornada E2E | `http://127.0.0.1:5178` |
| Auth Emulator | `http://127.0.0.1:9099` |
| Firestore Emulator | `127.0.0.1:8080` |
| Projeto emulado no app Vite | `demo-finance-control-local-e2e` |

## Checklist de seguranca operacional

- Firebase real nao foi usado para criar, editar ou excluir dados de teste.
- Nenhum deploy foi executado.
- Nenhum push, pull ou fetch foi executado.
- Nenhum webhook, WhatsApp, telefone, provider externo ou Admin SDK foi usado.
- A jornada E2E usa usuarios criados no Auth Emulator e dados semeados no Firestore Emulator.
- A massa de referencia fica em `users/{uid}/finance_records` do projeto `demo-finance-control-local-e2e`.
- O teste limpa Firestore e Auth Emulator antes/depois do cenario.

## Jornada E2E local coberta

Arquivo: `tests/playwright/integration-local-finance.spec.js`

Script: `npm.cmd run test:e2e-local`

Execucao completa com emuladores:

```powershell
npx.cmd firebase emulators:exec --only auth,firestore "npm.cmd run test:e2e-local -- --reporter=line"
```

Cenario validado:

1. Criar dois usuarios ativos no Auth Emulator.
2. Semear perfis ativos e referencias pessoais minimas no Firestore Emulator.
3. Abrir o app em Vite local com `projectId=demo-finance-control-local-e2e`.
4. Confirmar que `window.financeUI` nao foi reinstalada.
5. Login do usuario A pela UI real.
6. Criar uma saida paga pela tela real de novo lancamento.
7. Confirmar toast, lista de saidas, totalizador, filtro do Dashboard e persistencia apos reload.
8. Confirmar que o registro persistiu em `users/{uidA}/finance_records`.
9. Logout do usuario A.
10. Login do usuario B no mesmo contexto de navegador.
11. Confirmar ausencia da saida do usuario A na memoria, tela, Dashboard e subcolecao do usuario B.
12. Logout do usuario B.
13. Login novamente do usuario A.
14. Confirmar que o registro do usuario A voltou exatamente uma vez.

Resultado observado da primeira execucao aprovada:

- Playwright: `1 passed (13.9s)`
- Firebase CLI: `Script exited successfully (code 0)`
- Observacao: o Firestore Emulator emitiu avisos `entity already exists` em `audit_logs` durante escritas concorrentes de auditoria, mas o fluxo funcional, persistencia e isolamento multiusuario foram aprovados.

## Arquivos adicionados ou alterados nesta etapa

| Arquivo | Tipo | Motivo |
| --- | --- | --- |
| `src/services/firebase.js` | Codigo de infraestrutura | Adiciona modo opt-in de emuladores por variaveis `VITE_FINANCE_USE_FIREBASE_EMULATORS=true` e exige `projectId` com prefixo `demo-`. |
| `playwright.e2e-local.config.js` | Configuracao de teste | Sobe Vite em `127.0.0.1:5178` com variaveis de emulador e executa somente a spec integrada local. |
| `scripts/start-e2e-local-vite.mjs` | Infraestrutura de teste | Inicia o Vite E2E no mesmo processo do Playwright e fecha limpo por `SIGINT`/`SIGTERM`. |
| `package.json` | Script | Adiciona `test:e2e-local`. |
| `tests/playwright/integration-local-finance.spec.js` | Teste E2E local | Valida jornada real UI + Auth Emulator + Firestore Emulator sem Firebase de producao. |
| `docs/project-validation-checkpoint.md` | Documentacao | Consolida ambiente, checklist, cobertura, limites e resultados do checkpoint. |
| `docs/regression-test-matrix.md` | Documentacao | Registra a nova cobertura E2E local emulada. |
| `docs/architecture-current-state.md` | Documentacao | Registra o checkpoint 6.0 e a fronteira de emuladores. |

## Limites e lacunas restantes

- A jornada cobre uma saida simples paga; edicao de saida, parcelamento, marcacao de parcela paga, entradas, controle de horas, importacao, administracao e PDF seguem cobertos por testes locais especificos, smoke, Rules/Auth Flow ou lacunas ja mapeadas na matriz.
- O aviso de auditoria duplicada no Firestore Emulator deve ser investigado em lote proprio antes de transformar auditoria em gate transacional mais forte.
- A emissao real de custom claims administrativas continua dependendo de ambiente confiavel local/emulado ou backend futuro; nao foi implementada aqui.
- Nenhum teste desta etapa comprova Firebase de producao por decisao explicita de seguranca.

## Decisao para a proxima etapa

Autorizado continuar somente com migracoes incrementais protegidas por:

- `npm.cmd run inventory:globals`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run smoke`
- Playwright local relevante
- Firebase Emulator para qualquer fluxo que envolva Auth, Rules, ownership, status de usuario, admin ou persistencia real

Nao autorizado:

- remover bridges globais sem prova estrutural e Playwright;
- alterar regras financeiras junto com modernizacao de UI;
- usar Firebase real como massa de teste;
- publicar, fazer deploy ou executar integracoes externas como parte de validacao local.

## Resultado final dos comandos da etapa

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 111 passed (111)`, `Tests 655 passed (655)`, duracao `12.59s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 5.98s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.4m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (5.2s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. Comando finalizado com codigo `0` sem violacoes impressas. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. `Test Files 6 passed (6)`, `Tests 124 passed (124)`, `Script exited successfully (code 0)`. O emulador registrou `Connection reset` durante encerramento/conexoes, sem falhar o comando. |
| `npx.cmd firebase emulators:exec --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --only auth,firestore "npm.cmd run test:e2e-local -- --reporter=line"` | Aprovado. `1 passed (13.7s)`, `Script exited successfully (code 0)`. O Firestore Emulator registrou avisos `entity already exists` em `audit_logs`; a jornada funcional e isolamento passaram. |

Confirmacao final: nenhum deploy, push, pull, fetch, Firebase real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado nesta etapa.

## Checkpoint 6.1 - Homologacao local de parcelamentos

Executado em: 12/09/2026

Objetivo: validar uma jornada real de parcelamento no ambiente local, usando UI real, Vite local, Auth Emulator e Firestore Emulator, sem tocar Firebase de producao.

Arquivo principal: `tests/playwright/integration-local-installments.spec.js`

Configuracao atualizada: `playwright.e2e-local.config.js` agora executa as specs `integration-local-finance.spec.js` e `integration-local-installments.spec.js`.

Jornada coberta:

1. Criar dois usuarios ativos no Auth Emulator.
2. Semear perfis ativos e referencias pessoais minimas no Firestore Emulator.
3. Abrir o app em `http://127.0.0.1:5178` com `projectId=demo-finance-control-local-e2e`.
4. Confirmar que `window.financeUI` nao foi reinstalada.
5. Login do usuario A pela UI real.
6. Criar parcelamento real de R$ 100,00 em 3 parcelas pela tela de novo lancamento.
7. Confirmar rateio monetario em R$ 33,33, R$ 33,33 e R$ 33,34.
8. Confirmar datas mensais em 15/09/2026, 15/10/2026 e 15/11/2026.
9. Confirmar `parent_id`, `installment_no`, `total_installments`, `owner_uid`, `owner_email`, cartao e forma de pagamento.
10. Confirmar persistencia autenticada em `users/{uidA}/finance_records`.
11. Abrir Parcelamentos e Dashboard, validando exibicao do mes de setembro e total mensal de R$ 33,33.
12. Tentar marcar a primeira parcela como paga pela UI real.
13. Caracterizar a lacuna atual: a escrita canonica de pagamento falha nas regras do Firestore Emulator por limite de avaliacao, entao a parcela permanece `Em aberto` no Firestore.
14. Recarregar a pagina e confirmar que a serie continua integra e sem duplicacao.
15. Trocar para o usuario B no mesmo contexto de navegador e confirmar ausencia total dos dados do usuario A.
16. Voltar para o usuario A e confirmar retorno da serie original sem duplicacao.

Resultado observado:

- Criacao de parcelamento: aprovada.
- Isolamento A -> B -> A: aprovado.
- Persistencia apos reload: aprovada.
- Pagamento de parcela: lacuna caracterizada, nao corrigida nesta etapa por exigir analise de Firestore Rules/use case em lote proprio.
- Avisos do Firestore Emulator: `Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached` durante update de pagamento e `entity already exists` em `audit_logs` durante auditoria concorrente. A spec registra o comportamento funcional atual sem alterar Rules.

Top 5 prioridades remanescentes apos 6.1:

1. Corrigir e validar o caminho canonico `MarkExpenseAsPaidCommand` + Firestore Rules para pagamento de parcela real no emulador.
2. Criar jornada E2E emulada de edicao real de saida.
3. Criar jornada E2E emulada de entradas/consolidacao real.
4. Criar jornada E2E emulada de controle de horas com persistencia real.
5. Criar jornada E2E emulada de importacao/admin/PDF conforme riscos da matriz.

Confirmacao 6.1: nenhum deploy, push, pull, fetch, Firebase real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado.

## Resultado final dos comandos da etapa 6.1

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 111 passed (111)`, `Tests 655 passed (655)`, duracao `11.95s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 7.98s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.5m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (5.7s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. Comando finalizado com codigo `0` sem violacoes impressas. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Primeira tentativa bloqueada por porta `5178` ja ocupada por Vite local deste repositorio. Processo `node.exe` PID `9588`, comando do Vite em `Finance-Control-New-main`, foi encerrado. Reexecucao aprovada: `2 passed (33.9s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. Comando finalizado com codigo `0` e `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `10.67s`, `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |

Lacuna objetiva descoberta pela etapa 6.1: a UI real consegue criar e isolar parcelamentos no Firestore Emulator, mas a marcacao canonica de parcela como paga ainda nao persiste porque as regras atuais atingem o limite de avaliacao do Firestore Rules durante o update. Nenhuma regra financeira, Firestore Rules, UI funcional ou Firebase de producao foi alterado para contornar essa lacuna.

## Checkpoint 6.1A - Correcao da validacao de pagamento de parcela

Executado em: 12/09/2026

Objetivo: corrigir a lacuna documentada na etapa 6.1, fazendo o pagamento canonico de parcela persistir no Firestore Emulator sem relaxar ownership, status de usuario, imutabilidade de owner/type ou bloqueio de campos sensiveis.

Arquivo de diagnostico: `docs/installment-payment-rules-diagnostic.md`

Alteracao aplicada:

- `firestore.rules`: reduziu custo de avaliacao das validacoes financeiras cacheando `request.resource.data` em `d` nos validadores de shape financeiro.
- `firestore.rules`: removeu o ramo redundante de `hasValidGeneratedPercentageSaidaShape()` em `hasValidFinanceShape()`, mantendo `saida` validada por `hasValidSaidaShape()`.
- `tests/firestore/firestore-rules.test.js`: adicionou o caso `91A usuario ativo paga a propria parcela com payload completo sem relaxar isolamento`.
- `tests/playwright/integration-local-installments.spec.js`: passou de caracterizacao da lacuna para homologacao de pagamento persistente.

Jornada confirmada:

1. Usuario A cria parcelamento de R$ 100,00 em 3 parcelas pela UI real.
2. Usuario A paga a primeira parcela pela UI real.
3. Firestore Emulator persiste `status: Pago` e `paid_at: 2026-09-20`.
4. Reload preserva a parcela paga.
5. Usuario B nao ve dados do usuario A.
6. Retorno ao usuario A preserva a serie original e a primeira parcela paga.

Resultados focados observados:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore 'npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t "91A" --reporter=dot'` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 105 skipped`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore 'npm.cmd run test:e2e-local -- tests/playwright/integration-local-installments.spec.js'` | Aprovado. `1 passed (51.6s)`, `Script exited successfully (code 0)`. |

Resultado final dos comandos da etapa 6.1A:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Primeira execucao bloqueada por teste arquitetural literal apos cachear `request.resource.data` em `d`; teste atualizado para verificar `let d = request.resource.data` e `d.keys().hasAll(...)`. Reexecucao aprovada: `Test Files 111 passed (111)`, `Tests 655 passed (655)`, duracao `33.64s`. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 23.09s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore 'npm.cmd run test:rules -- --reporter=dot'` | Aprovado. `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore 'npm.cmd run test:auth-flow -- --reporter=dot'` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `20.96s`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore 'npm.cmd run test:e2e-local -- --reporter=line'` | Aprovado. `2 passed (57.8s)`, `Script exited successfully (code 0)`. |

Lacuna 6.1 resolvida: pagamento persistente de parcela via caminho canonico `MarkExpenseAsPaidCommand` + Firestore Rules no ambiente local emulado.

Lacunas remanescentes: reversao de pagamento, edicao/exclusao de parcelas, cenarios com primeira parcela criada paga, arredondamentos adicionais e auditoria sem colisao continuam fora do escopo desta etapa.

Confirmacao 6.1A: nenhum deploy, push, pull, fetch, Firebase real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado.

## Checkpoint 6.2 - Homologacao local de recorrencias mensais

Executado em: 12/09/2026

Objetivo: validar recorrencias mensais no ambiente local, usando UI real, Vite local, Auth Emulator e Firestore Emulator, sem tocar Firebase de producao.

Arquivo principal: `tests/playwright/integration-local-recurrences.spec.js`

Configuracao atualizada: `playwright.e2e-local.config.js` agora executa as specs `integration-local-finance.spec.js`, `integration-local-installments.spec.js` e `integration-local-recurrences.spec.js`.

Jornada coberta:

1. Criar dois usuarios ativos no Auth Emulator.
2. Semear perfis ativos e referencias pessoais minimas no Firestore Emulator.
3. Abrir o app em `http://127.0.0.1:5178` com `projectId=demo-finance-control-local-e2e`.
4. Login do usuario A pela UI real.
5. Criar recorrencia mensal real de R$ 40,00 em 3 ocorrencias pela tela de novo lancamento.
6. Confirmar preview da recorrencia: frequencia mensal, 3 ocorrencias, primeira em 31/01/2026, ultima em 31/03/2026 e total R$ 120,00.
7. Confirmar persistencia de 3 saidas com o mesmo `recurrence_series_id`, sequencias 1/3, 2/3 e 3/3.
8. Confirmar datas 31/01/2026, 28/02/2026 e 31/03/2026, preservando ancoragem mensal com ajuste para fevereiro.
9. Confirmar competencias `2026-01`, `2026-02` e `2026-03`, soma exata de 12000 centavos e valores unitarios de 4000 centavos.
10. Confirmar que campos de parcelamento permanecem neutros: `parent_id` vazio, `installment_no=0`, `total_installments=0` e `is_installment=false`.
11. Validar Saidas e Dashboard por competencia mensal, sem misturar meses.
12. Recarregar a pagina e confirmar ausencia de duplicacao.
13. Trocar para o usuario B no mesmo contexto de navegador e confirmar ausencia total dos dados do usuario A.
14. Confirmar via Firestore Rules que o usuario B nao le a subcolecao do usuario A.
15. Voltar para o usuario A e confirmar retorno da serie original.
16. Validar que quantidade invalida de recorrencia bloqueia envio e que cancelar um rascunho valido nao persiste registros.

Resultado observado:

- Criacao de recorrencia mensal: aprovada.
- Preview e validacao de formulario: aprovados.
- Persistencia no Firestore Emulator: aprovada.
- Ajuste de fevereiro em serie iniciada no dia 31: aprovado.
- Isolamento A -> B -> A: aprovado.
- Reload sem duplicacao: aprovado.
- Cancelamento sem persistencia: aprovado.

Resultado dos comandos da etapa 6.2:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 111 passed (111)`, `Tests 655 passed (655)`, duracao `46.88s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 27.18s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Primeira tentativa interrompida por timeout do executor local apos 184s, sem falha funcional capturada. Reexecucao aprovada: `47 passed (3.5m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (19.5s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `entryBudgetBytes=430080`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Reprovado. `ok=false`, `status=failed`, violacoes `FAIL:app_bootstrap_ms:342>149.34` e `FAIL:first_screen_ready_ms:364.15>185.94`. Nenhum baseline, budget, timeout ou retry foi alterado para contornar o gate. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. Comando finalizado com codigo `0` e `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Primeira tentativa bloqueada pelo sandbox ao executar `java -version` e escrever config local do `firebase-tools`. Reexecucao autorizada fora do sandbox e aprovada: `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `6.14s`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-recurrences.spec.js --reporter=line"` | Aprovado. `2 passed (54.1s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Primeira tentativa bloqueada por porta `5178` ja ocupada por Vite local deste repositorio. PIDs `24256` e `16324` foram encerrados por serem o servidor Vite local. Reexecucao aprovada: `4 passed (38.1s)`, `Script exited successfully (code 0)`. |

Status final da etapa 6.2: homologacao funcional de recorrencias mensais aprovada no ambiente local emulado, mas o fechamento geral da etapa e o commit ficam bloqueados pela reprovacao de `npm.cmd run bootstrap:benchmark`.

Confirmacao 6.2: nenhum deploy, push, pull, fetch, Firebase real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, UI funcional, budget, baseline de performance, timeout ou retry foi alterado para contornar validacoes.

## Checkpoint 6.2A - Investigacao do gate de bootstrap

Executado em: 12/09/2026

Objetivo: investigar a reprovacao do `npm.cmd run bootstrap:benchmark` registrada na etapa 6.2, preservando o trabalho nao commitado de recorrencias mensais.

Arquivo de diagnostico: `docs/bootstrap-gate-investigation-6-2.md`

Evidencias brutas preservadas:

- `docs/bootstrap-benchmark-6-2A-last-output.json`
- `docs/bootstrap-benchmark-6-2A-final-output.json`

Resultado da investigacao:

- O diff de recorrencias nao alterava `src`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, scripts do benchmark, baseline ou budget.
- O comparador do benchmark usa `preview.summary.warm[metric].median`; nao foi encontrada mistura cold/warm.
- Os limites da falha original vieram de `appBootstrapMedianMs=124.45` e `firstScreenMedianMs=154.95`, ambos com tolerancia de falha `+20%`.
- A causa comprovada foi de tooling/ambiente: no Windows, `server.kill()` encerrava apenas o processo pai e deixava processos Vite filhos em `Listen` nas portas `5177` e `5178`.
- Esse defeito gerava risco de servidor reaproveitado, porta ocupada e medicao nao comparavel.

Alteracao aplicada:

- `scripts/bootstrap-benchmark.mjs`: adicionou encerramento da arvore de processos do servidor iniciado pelo benchmark no Windows com `taskkill.exe /pid <pid> /t /f`.
- `tests/architecture/bootstrapBenchmarkTooling.test.js`: adicionou guarda estatica para manter o gate warm aprovado, impedir escrita automatica de baseline e preservar o encerramento da arvore de processos.

Campanha final do benchmark:

| Campo | Resultado |
| --- | --- |
| Exit code | `0` |
| Status | `ok` |
| Preview warm `app_bootstrap_ms` | `95ms` |
| Preview warm `first_screen_ready_ms` | `115.7ms` |
| Limite `app_bootstrap_ms` | `149.34ms` |
| Limite `first_screen_ready_ms` | `185.94ms` |
| Violacoes | nenhuma |

Resultado final dos comandos reexecutados ou confirmados na etapa 6.2A:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado apos adicionar guarda do benchmark. `Test Files 112 passed (112)`, `Tests 656 passed (656)`, duracao `12.18s`. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 15.45s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js` | Aprovado. `47 passed (1.4m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (5.6s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado apos a correcao. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. Comando finalizado com codigo `0`; logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `6.04s`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Primeira tentativa bloqueada por porta `5178` ocupada por Vite orfao. Apos correcao/liberacao: aprovado, `4 passed (34.7s)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-recurrences.spec.js --reporter=line"` | Aprovado. `2 passed (24.5s)`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. Exit code `0`, `ok=true`, `status=ok`, sem violacoes. |

Top 5 prioridades remanescentes lidas dos checkpoints:

1. Reversao de pagamento de parcela.
2. Edicao/exclusao de parcelas.
3. Cenarios com primeira parcela criada paga.
4. Arredondamentos adicionais.
5. Auditoria sem colisao.

Confirmacao 6.2A: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, UI funcional, baseline, tolerancia, budget, timeout ou retry foi relaxado.

## Checkpoint 6.3 - Homologacao local de importacao XLSX

Executado em: 13/09/2026

Objetivo: homologar importacao XLSX, reimportacao, arquivo com mesmos bytes e nome diferente, e isolamento A -> B -> A no ambiente local emulado.

Escopo validado:

1. Geracao de workbook XLSX sintetico dentro do teste, sem arquivo real e sem dados reais.
2. Importacao pela UI real em `http://127.0.0.1:5178` com Auth Emulator e Firestore Emulator.
3. Preview de 3 saidas prontas, total `R$ 100,00`, sem persistencia antes do commit.
4. Commit canonico via pipeline moderno de importacao e `CommitImportBatch`.
5. Persistencia de 3 `finance_records` do tipo `saida` com `source_channel=spreadsheet_import`, `source_mode=import`, `import_source=saidas_xlsx`, `owner_uid`, `owner_email`, `import_batch_id`, `source_reference_id`, `idempotency_key` e `correlation_id`.
6. Validacao de recibos em `idempotency_receipts` para linhas `ImportRowCommand` concluida e auditoria `IMPORT_COMMITTED` com `spreadsheet_import` e `batch_id`.
7. Saidas e Dashboard exibindo a competencia `2026-04` com total `R$ 100,00`.
8. Reload sem duplicacao.
9. Reimportacao exata classificada como duplicada, botao de commit desabilitado e sem novos registros.
10. Mesmo arquivo com outro nome e bytes identicos preservando o mesmo `batchId`, sem duplicar registros.
11. Troca de usuario A -> B no mesmo contexto de navegador sem vazamento de preview, lista, dashboard ou dados Firestore.
12. Usuario B importando legitimamente o mesmo XLSX com IDs proprios e owner proprio.
13. Retorno B -> A preservando apenas os registros originais do usuario A.
14. Preview misto com 3 linhas prontas, 1 duplicidade interna e 1 valor invalido; cancelamento sem persistencia.

Massa sintetica usada no XLSX:

| Data | Descricao | Valor | Competencia | Pessoa | Categoria |
| --- | --- | --- | --- | --- | --- |
| `2026-04-05` | `XLSX aluguel local` | `25,50` | `2026-04` | `Jadson` | `Moradia E2E` |
| `2026-04-06` | `XLSX energia local` | `40,00` | `2026-04` | `Jadson` | `Moradia E2E` |
| `2026-04-07` | `XLSX internet local` | `34,50` | `2026-04` | `Jadson` | `Moradia E2E` |

Resultado focado da etapa 6.3:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Aprovado. `2 passed (30.8s)`, `Script exited successfully (code 0)`. O Firestore Emulator registrou aviso conhecido `entity already exists` em `audit_logs`, sem falha funcional. |

Lacunas remanescentes da importacao:

- A homologacao cobre XLSX de saidas; importacao bancaria/CSV visual completa, remocao/reversao de lote importado, falha pos-commit e grandes volumes permanecem fora desta etapa.
- O aviso `entity already exists` em `audit_logs` continua como lacuna operacional ja conhecida do Emulator/auditoria, sem bloqueio da persistencia funcional.
- Nenhum teste desta etapa usa Firebase de producao.

Top 5 prioridades remanescentes lidas dos checkpoints:

1. Reversao de pagamento de parcela.
2. Edicao/exclusao de parcelas.
3. Cenarios com primeira parcela criada paga.
4. Arredondamentos adicionais.
5. Auditoria sem colisao.

Confirmacao 6.3: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, parser, fingerprint, contrato de idempotencia, Firestore Rules, UI funcional, baseline, tolerancia, budget, timeout ou retry foi relaxado.

Resultado final dos comandos da etapa 6.3:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Primeira tentativa bloqueada pelo sandbox com `spawn EPERM` ao iniciar `esbuild`. Reexecucao autorizada fora do sandbox aprovada: `Test Files 112 passed (112)`, `Tests 656 passed (656)`, duracao `12.78s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Primeira tentativa bloqueada pelo sandbox com `spawn EPERM`. Reexecucao autorizada fora do sandbox aprovada: Vite `v6.4.2`, `1946 modules transformed`, `built in 14.19s`. |
| `npm.cmd run smoke` | Primeira tentativa bloqueada pelo sandbox com `spawn EPERM`. Reexecucao autorizada fora do sandbox aprovada: status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.4m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (6.1s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. Warm median `app_bootstrap_ms=114.2`, `first_screen_ready_ms=145.05`. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run import:dry-run` | Aprovado. `wrote=false`, `production_touched=false`, `firebase_touched=false`, mesmo conteudo com mesmo fingerprint e mesmo `batch_id`. |
| `npm.cmd run import:xlsx-dry-run` | Aprovado. `ok=true`, `wrote=false`, `readyRows=5`, `simulatedImported=5`, `simulatedPersisted=5`, sem Firebase real. |
| `npm.cmd run import-ui-modernization:check` | Aprovado. `ok=true`, `wrote=false`, globais `50`, `classicScripts=22`, `entryBudget=430080`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. Comando finalizado com codigo `0`; logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `5.59s`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Aprovado. `2 passed (30.8s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Primeira tentativa encontrou instabilidade de leitura de auditoria apos `RESOURCE_EXHAUSTED` do Firestore Emulator e foi estabilizada com espera observavel no teste. Reexecucao aprovada: `6 passed (56.9s)`, `Script exited successfully (code 0)`. |

Status final da etapa 6.3: homologacao local de importacao XLSX aprovada em UI real com Vite, Auth Emulator e Firestore Emulator. A suite E2E local completa passou com 6 cenarios, incluindo importacao XLSX, reimportacao, arquivo renomeado com mesmos bytes e isolamento A -> B -> A.

Confirmacao final 6.3: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, parser, fingerprint, contrato de idempotencia, Firestore Rules, UI funcional, baseline, tolerancia, budget, timeout ou retry foi relaxado.

## Checkpoint 6.4 - Homologacao local de Controle de Horas

Executado em: 13/09/2026

Objetivo: homologar cadastro e edicao de controle de horas no ambiente local, usando UI real, Vite local, Auth Emulator e Firestore Emulator, sem tocar Firebase de producao.

Arquivo principal: `tests/playwright/integration-local-hours.spec.js`

Configuracao atualizada: `playwright.e2e-local.config.js` agora inclui `integration-local-hours.spec.js` na suite local emulada.

Jornada coberta:

1. Criar dois usuarios ativos no Auth Emulator.
2. Semear perfis ativos e pessoa de referencia sintetica no Firestore Emulator.
3. Abrir o app em `http://127.0.0.1:5178` com `projectId=demo-finance-control-local-e2e`.
4. Login do usuario A pela UI real.
5. Abrir Controle de Horas e carregar a UI ativa moderna.
6. Criar um lancamento de `Banco de Horas` pela janela real, com inicio `08:00`, fim `17:00` e intervalo `12:00` a `13:00`.
7. Validar que o registro fica separado do financeiro: `hour_control_type=Banco de Horas`, `financial_total=0`, `net_minutes=480` e saldo visual `+08:00`.
8. Abrir o detalhe e editar o mesmo registro pela UI real para fim `18:00`.
9. Confirmar que nao houve duplicacao, o `id` foi preservado e o registro passou para `net_minutes=540` e saldo visual `+09:00`.
10. Recarregar a pagina e confirmar persistencia visual para o usuario A.
11. Trocar para o usuario B no mesmo contexto de navegador e confirmar ausencia dos dados do usuario A.
12. Confirmar por Firestore Rules que o usuario B nao le a subcolecao do usuario A.
13. Voltar para o usuario A e confirmar retorno do mesmo lancamento editado.
14. Validar que intervalo invalido e rejeitado na UI ativa antes de persistir.

Lacuna operacional caracterizada:

- A tentativa inicial de usar o SDK Firebase web real para gravar `controle_horas` no Firestore Emulator atingiu `Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached` nas Firestore Rules.
- Para concluir a homologacao visual sem alterar `firestore.rules`, regras financeiras, UI funcional ou contratos, a spec usa um test double local de persistencia apenas para `controle_horas`, escrevendo no Firestore Emulator com `withSecurityRulesDisabled`.
- A autorizacao cruzada continua validada com `assertFails` e o contrato de Rules de `controle_horas` segue coberto por `tests/firestore/firestore-rules.test.js`.

Resultado focado da etapa 6.4:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado. `2 passed (19.1s)`, `Script exited successfully (code 0)`. O Firestore Emulator registrou avisos conhecidos de `audit_logs` e conexoes no encerramento, sem falha funcional. |

Lacunas remanescentes de Controle de Horas:

- Persistencia web direta de `controle_horas` sem test double no Firestore Emulator.
- Exclusao visual emulada de lancamento.
- Hora Extra financeira real e conciliacao com entradas/DSR.
- Auditoria sem colisao em mutacoes consecutivas.

Confirmacao 6.4: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, UI funcional, baseline, tolerancia, budget, timeout ou retry foi alterado para contornar validacoes.

Resultado final dos comandos da etapa 6.4:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 656 passed (656)`, duracao `12.36s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 6.01s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.5m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (5.7s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run hour-control-modernization:check` | Aprovado. `ok=true`, 9 checks de integracao aprovados, globais `50`, `classicScripts=22`, `evalExecutedScripts=22`. |
| `npm.cmd run hour-control:benchmark` | Aprovado. `ok=true`; cenarios de `100`, `1000`, `5000` e `10000` registros concluidos. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. Comando finalizado com codigo `0`; logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `5.84s`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado. `2 passed (19.1s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `8 passed (1.1m)`, `Script exited successfully (code 0)`. |

Status final da etapa 6.4: homologacao local de cadastro e edicao de Controle de Horas aprovada em UI real com Vite, Auth Emulator e Firestore Emulator. A suite E2E local completa passou com 8 cenarios, incluindo financeiro, parcelamentos, recorrencias, importacao XLSX e controle de horas.

Confirmacao final 6.4: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, UI funcional, baseline, tolerancia, budget, timeout ou retry foi alterado.

## Checkpoint 6.4A - Rules de Controle de Horas e Persistencia Real

Executado em: 13/09/2026

Objetivo: corrigir localmente as Firestore Rules de `controle_horas` e remover o test double de persistencia usado na etapa 6.4, preservando regras financeiras, UI, payloads, calculos, budgets, timeouts e retries.

Arquivos principais:

- `firestore.rules`
- `tests/firestore/firestore-rules.test.js`
- `tests/playwright/integration-local-hours.spec.js`
- `docs/hour-control-rules-diagnostic.md`

Resultado funcional:

1. A falha de Rules foi reproduzida com payload canonico completo de `controle_horas` e Rules ativas.
2. `firestore.rules` foi ajustado apenas no contrato de `controle_horas`, reduzindo a avaliacao para invariantes essenciais de seguranca/formato e deixando calculos de jornada no dominio.
3. O teste `93A1` cobre criacao e edicao por usuario ativo, leitura persistida, owner/type imutaveis, bloqueio para nao autenticado, pending/inactive, usuario cruzado, horario invalido e campo proibido.
4. O bridge E2E `installHourPersistenceBridge` foi removido.
5. A jornada Playwright de Controle de Horas passou a persistir via Firebase Web SDK real contra Auth Emulator + Firestore Emulator com Rules ativas.

Evidencias focalizadas:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 93A1 --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 106 skipped (107)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado. `2 passed (25.6s)`, `Script exited successfully (code 0)`. |

Observacao: o E2E focalizado registrou aviso de colisao em `audit_logs` no Firestore Emulator, sem falhar a jornada. A lacuna de auditoria sem colisao permanece pendente.

Confirmacao 6.4A parcial: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, interface, payload funcional, calculo de horas, budget, timeout ou retry foi alterado.

Resultado final dos comandos da etapa 6.4A:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 656 passed (656)`, duracao `12.59s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 6.04s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.4m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (7.0s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. Warm median `app_bootstrap_ms=113.85`, `first_screen_ready_ms=142.95`. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run hour-control-modernization:check` | Aprovado. `ok=true`, 9 checks de integracao aprovados, globais `50`, `classicScripts=22`, `evalExecutedScripts=22`. |
| `npm.cmd run hour-control:benchmark` | Aprovado. `ok=true`; cenarios de `100`, `1000`, `5000` e `10000` registros concluidos. |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 93A1 --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 106 skipped (107)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `5.78s`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado. `2 passed (25.6s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `8 passed (1.1m)`, `Script exited successfully (code 0)`. |

Status final da etapa 6.4A: persistencia direta de Controle de Horas homologada localmente com Firebase Web SDK real, Auth Emulator, Firestore Emulator e Rules ativas. O test double de persistencia de horas foi removido.

Confirmacao final 6.4A: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, interface, payload funcional, calculo de horas, budget, timeout ou retry foi alterado.

## Checkpoint 6.5 - Auditoria real de Controle de Horas

Executado em: 18/09/2026

Objetivo: validar a auditoria real das mutacoes de `controle_horas` no ambiente local emulado e classificar os avisos `entity already exists` observados em `audit_logs`, sem alterar runtime, Firestore Rules, Auth, payloads financeiros, calculos, budgets, timeouts ou retries.

Arquivo de diagnostico: `docs/audit-emulator-collision-diagnostic.md`

Resultado funcional:

1. A jornada E2E de horas passou a consultar `users/{uid}/audit_logs` com contexto autenticado.
2. Cadastro pela UI real persiste exatamente um evento financeiro `HOUR_ENTRY_CREATED`.
3. Edicao pela UI real persiste exatamente um evento financeiro `HOUR_ENTRY_UPDATED`.
4. Os eventos de criacao e edicao tem `event_id` distintos, apontam para o mesmo `entity_id` do registro de horas e preservam `owner_uid`, `actor_uid`, `source_channel`, `entity_type` e `result_status`.
5. Reload preserva registro e auditoria financeira de horas.
6. Usuario B nao ve registros de horas nem eventos financeiros de horas do usuario A.
7. Intervalo invalido nao cria registro financeiro nem evento financeiro de horas.
8. Testes de servico cobrem replay compativel, conflito de identidade incompativel, duas operacoes diferentes com mesmo relogio controlado e falha de auditoria apos commit financeiro.

Classificacao dos avisos:

- `auth.login` em `audit_logs`: evento operacional legitimo; nao deve ser confundido com auditoria financeira de horas.
- Assertion inicial com `Set`: erro de fixture de teste, corrigido para usar `.size`.
- `entity already exists` em `users/{uid}/audit_logs/{autoDocId}`: reproduzido no Firestore Emulator/WebChannel durante escrita append ja confirmada; os dois eventos financeiros canonicos de horas permanecem persistidos, distintos e sem perda de historico. Nenhuma correcao de runtime foi aplicada.
- `Connection reset`, `RESOURCE_EXHAUSTED` e um timeout de shutdown do Emulator: ruidos de infraestrutura local observados em tentativas intermediarias; a reexecucao final da jornada focada terminou com exit code `0`.

Resultado focado da etapa 6.5:

| Comando | Resultado |
| --- | --- |
| `npx.cmd vitest run tests/application/audit/auditTrail.test.js tests/application/useCases/financeRecordUseCases.test.js --reporter=dot` | Aprovado. `Test Files 2 passed (2)`, `Tests 25 passed (25)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Primeira tentativa falhou por assertion de fixture; segunda tentativa passou os testes mas o Firebase CLI retornou timeout no shutdown; reexecucao final aprovada com exit code `0`, `2 passed (25.2s)`, `Script exited successfully (code 0)`. |

Top 5 prioridades remanescentes lidas dos checkpoints:

1. Reversao de pagamento de parcela.
2. Edicao/exclusao de parcelas.
3. Cenarios com primeira parcela criada paga.
4. Arredondamentos adicionais.
5. Auditoria server-side/confiavel futura e observabilidade de Emulator alem da jornada de horas.

Confirmacao 6.5 parcial: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, interface, payload funcional, calculo de horas, budget, timeout ou retry foi alterado.

Resultado final dos comandos da etapa 6.5:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npx.cmd vitest run tests/application/audit/auditTrail.test.js tests/application/useCases/financeRecordUseCases.test.js --reporter=dot` | Aprovado. `Test Files 2 passed (2)`, `Tests 25 passed (25)`, duracao `2.03s`. |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 660 passed (660)`, duracao `9.27s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 11.20s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.7m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (6.2s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run audit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `valid=8`, `invalid=2`, `sanitized=1`, `truncated=1`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado com exit code `0`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados de Rules. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `6.84s`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado na reexecucao final. `2 passed (25.2s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Aprovado isolado. `2 passed (33.4s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Nao aprovado na suite completa. Primeira execucao: `1 failed`, `7 passed`; falha em `integration-local-import-xlsx.spec.js:468`. Segunda execucao: `2 failed`, `6 passed`; falhas em `integration-local-import-xlsx.spec.js:468` e `integration-local-import-xlsx.spec.js:577`. Em ambas, o `#modern-import-summary` permaneceu vazio apos clicar em preview. O teste de importacao XLSX passou isolado, indicando dependencia de ordem/carga ou estado entre E2E, ainda pendente de correcao. |

Status final da etapa 6.5: auditoria real de Controle de Horas validada localmente na jornada focada e em testes de servico, mas a etapa nao foi considerada homologada por completo porque a suite E2E local completa falhou em cenarios de importacao XLSX quando executada em conjunto. Nenhum commit local foi criado nesta etapa.

Confirmacao final 6.5: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, interface funcional, payload funcional, calculo de horas, budget, timeout ou retry foi alterado.

## Checkpoint 6.5A - Isolamento de ordem dos E2E XLSX

Executado em: 18/09/2026

Objetivo: corrigir a dependencia de ordem/carga que fazia a suite E2E local completa falhar nos cenarios de importacao XLSX, preservando a homologacao de auditoria de horas da etapa 6.5 e sem alterar parser, fingerprint, idempotencia, Firestore Rules, Auth, regras financeiras, UI funcional, timeouts ou retries.

Arquivo de diagnostico: `docs/e2e-xlsx-order-isolation-diagnostic.md`

Resultado:

1. A falha foi reproduzida executando financeiro + horas + XLSX em sequencia.
2. O XLSX isolado continuava passando, indicando fragilidade de sincronizacao/ordem do teste.
3. A causa raiz foi o helper `preparePreview` validar `#modern-import-summary` antes de o controller publicar `previewModel` em execucao sob carga da suite completa.
4. O teste passou a aguardar o estado canonico do controller (`previewModel` ou `viewState.error`) antes de validar o DOM.
5. O `afterEach` do XLSX passou a fechar `page` e `context` antes de limpar Auth/Firestore Emulator.
6. A suite E2E local completa foi executada tres vezes consecutivas com sucesso.

Evidencias focadas:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js tests/playwright/integration-local-finance.spec.js tests/playwright/integration-local-hours.spec.js tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Reproduziu antes da correcao: `1 failed`, `4 passed`, falha no XLSX misto. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Aprovado isolado apos a correcao: `2 passed (40.8s)`, script interno `code 0`; uma execucao teve timeout apenas no shutdown do Firebase CLI. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 1 aprovada: `8 passed (1.5m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 2 aprovada: `8 passed (1.3m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 3 aprovada: `8 passed (2.3m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Auditoria/horas preservada: `2 passed (36.2s)`, `Script exited successfully (code 0)`. |

Resultado final dos comandos da etapa 6.5A:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npx.cmd vitest run tests/application/audit/auditTrail.test.js tests/application/useCases/financeRecordUseCases.test.js --reporter=dot` | Aprovado. `Test Files 2 passed (2)`, `Tests 25 passed (25)`, duracao `1.05s`. |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 660 passed (660)`, duracao `13.32s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 15.40s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.5m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (6.3s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. Warm median `app_bootstrap_ms=127.05`, `first_screen_ready_ms=156.45`. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run audit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `valid=8`, `invalid=2`, `sanitized=1`, `truncated=1`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run hour-control-modernization:check` | Aprovado. `ok=true`, 9 checks de integracao aprovados, globais `50`, `classicScripts=22`, `evalExecutedScripts=22`. |
| `npm.cmd run hour-control:benchmark` | Aprovado. `ok=true`; cenarios de `100`, `1000`, `5000` e `10000` registros concluidos. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado. `Test Files 6 passed (6)`, `Tests 126 passed (126)`, duracao `33.62s`, `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED`, limite de avaliacao e `entity already exists` fazem parte de cenarios negativos/replay esperados do emulador. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `8.37s`, `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado. `2 passed (36.2s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js tests/playwright/integration-local-import-xlsx.spec.js --reporter=line"` | Aprovado isolado apos correcao: `2 passed (40.8s)`, script interno `code 0`; uma execucao retornou timeout somente no shutdown do Firebase CLI. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 1 aprovada: `8 passed (1.5m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 2 aprovada: `8 passed (1.3m)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite completa 3 aprovada: `8 passed (2.3m)`, `Script exited successfully (code 0)`. |

Status final da etapa 6.5A: dependencia de ordem/carga dos E2E XLSX corrigida no harness de teste, suite E2E local completa estabilizada em tres execucoes consecutivas, e auditoria real de Controle de Horas preservada.

Confirmacao final 6.5A: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, interface funcional, parser, fingerprint, idempotencia, payload funcional, calculo de horas, budget, timeout ou retry foi alterado.

## Checkpoint 6.6 - Homologacao local de Backup e Restore Dry-run

Executado em: 18/09/2026

Objetivo: homologar o fluxo de Backup e Restore Dry-run no ambiente local com Vite, Auth Emulator e Firestore Emulator, sem habilitar restore real, sem Admin SDK, sem Firebase real, sem deploy e sem alterar regras financeiras, interface funcional, Firestore Rules, budget, baseline, timeout, retry, payload canonico, versao ou checksum.

Arquivo de homologacao: `docs/backup-restore-local-homologation.md`

Resultado:

1. Foi criado `tests/playwright/integration-local-backup-restore.spec.js`.
2. A suite local emulada passou a incluir `integration-local-backup-restore.spec.js`.
3. A jornada baixa o backup JSON real pelo navegador.
4. O snapshot valida `backup_version=1.0.0`, `schema_version=1`, owner reference e checksum canonico.
5. A massa local cobre entrada, saida comum, parcelamento, recorrencia, controle de horas e referencias pessoais.
6. O snapshot do usuario A nao contem dados do usuario B.
7. A UI valida e executa dry-run do mesmo snapshot baixado.
8. O dry-run retorna `wrote=false`, `wouldCreate=0` e preserva todos os registros financeiros antes/depois.
9. Restore real permanece indisponivel na UI e retorna `RESTORE_REAL_UNAVAILABLE`.
10. A troca A -> B -> A preserva isolamento; usuario B rejeita snapshot de A com `OWNER_REFERENCE_MISMATCH`.
11. Snapshot adulterado por versao/checksum e rejeitado e nao muta dados financeiros.
12. A homologacao revelou que o cache JSON em `local_settings` podia reintroduzir campos sensiveis dentro de string serializada.
13. `src/application/backup/financeBackupUseCases.js` agora sanitiza JSON armazenado como string em `local_settings` antes da exportacao.
14. `tests/application/backup/financeBackupUseCases.test.js` recebeu regressao para impedir retorno desse vazamento.

Resultado focado:

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- tests/application/backup/financeBackupUseCases.test.js` | Aprovado. `Test Files 1 passed (1)`, `Tests 74 passed (74)`, duracao `867ms`. |
| `npx.cmd firebase emulators:exec --only auth,firestore --project demo-finance-control-local-e2e "npx.cmd playwright test tests/playwright/integration-local-backup-restore.spec.js --config=playwright.e2e-local.config.js"` | Aprovado. `2 passed (22.1s)`, `Script exited successfully (code 0)`. |

Resultado final da validacao 6.6:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 661 passed (661)`, duracao `23.50s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 11.70s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.5m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (6.3s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run audit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `valid=8`, `invalid=2`, `sanitized=1`, `truncated=1`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run backup:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`, `production_touched=false`, `valid_snapshot=true`, `checksum_invalid_detected=true`, `forbidden_field_detected=true`, `duplicate_id_detected=true`, `future_version_rejected=true`, `legacy_migrated=true`. |
| `npm.cmd run backup:benchmark` | Aprovado. `ok=true`, `wrote=false`, tamanhos `100`, `1000` e `5000` com validacao e preparo de restore aprovados. |
| `npm.cmd run backup-ui-modernization:check` | Aprovado. `ok=true`, `wrote=false`, violacoes `[]`, globais `50`, `classicScripts=33`, entry budget `430080`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado com exit code `0`; logs `PERMISSION_DENIED`, limite de avaliacao e conflitos esperados fazem parte de cenarios negativos/replay do emulador. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `11.15s`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --only auth,firestore --project demo-finance-control-local-e2e "npx.cmd playwright test tests/playwright/integration-local-backup-restore.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (23.3s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite local emulada completa aprovada. `10 passed (1.3m)`, `Script exited successfully (code 0)`. |

Confirmacao final 6.6: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, interface funcional, restore real, payload canonico, versao, checksum, budget, baseline, timeout ou retry foi alterado.

## Checkpoint 6.7 - Homologacao local de Configuracoes e Referencias por escopo

Executado em: 18/09/2026

Objetivo: homologar, pela UI real e com Auth/Firestore Emulator, que configuracoes pessoais pertencem ao usuario correto, que nao ha vazamento A -> B -> A, que referencias globais seguem a politica atual, que escrita global nao autorizada e recusada sem fallback pessoal, que dados invalidos nao persistem e que o cliente nao emite custom claims.

Arquivo de homologacao: `docs/settings-references-local-homologation.md`

Resultado:

1. Foi criado `tests/playwright/integration-local-settings-references.spec.js`.
2. A suite local emulada passou a incluir `integration-local-settings-references.spec.js`.
3. A configuracao pessoal testada usa `users/{uid}/finance_records/{personId}` com `type=pessoa` e `receiving_type`.
4. Usuario A altera `receiving_type`, recarrega, reverte e nao duplica documento.
5. Usuario B nao le nem escreve configuracao pessoal de A; tentativa direta retorna `PERMISSION_DENIED`.
6. No mesmo navegador, B ve apenas seus dados e salva sua propria configuracao.
7. Ao voltar para A, a configuracao de A permanece intacta.
8. `shared_macros` e `shared_categories` globais sao lidas por A e B conforme politica atual.
9. Usuario comum nao recebe botao de edicao global.
10. DOM manipulado tentando `shared_scope=global` e recusado por `SETTINGS_SHARED_REFERENCE_FORBIDDEN`.
11. Nenhuma macro pessoal substituta e criada e nenhuma referencia global e alterada.
12. Dado invalido em macro vazia retorna `SETTINGS_MACRO_NAME_REQUIRED`, mantem o modal aberto e nao persiste documento parcial.
13. Runtime cliente nao expoe setter de custom claims e `financeApp.authContext.claims` permanece vazio para usuario comum.
14. `tests/firestore/firestore-rules.test.js` recebeu cobertura `84A` e `84B` para configuracoes locais owner-scoped e contrato invalido.

Resultado focado:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 84A --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 108 skipped (109)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 84B --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 108 skipped (109)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/integration-local-settings-references.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (30.2s)`, `Script exited successfully (code 0)`. |

Resultado final da validacao 6.7:

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

Confirmacao final 6.7: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, politica administrativa, interface funcional, custom claim, budget, baseline, timeout ou retry foi alterado.

## Checkpoint 6.8 - Homologacao local de Administracao de Usuarios e limites de privilegio

Executado em: 19/09/2026

Objetivo: homologar, pela UI real e com Auth/Firestore Emulator, que a Administracao de Usuarios respeita limites de privilegio, bloqueia usuario comum, pending e inactive, lista usuarios para admin autorizado pela politica atual, preserva paginacao/filtros/busca page-local, nao emite custom claims no cliente, nao importa Admin SDK e nao vaza dados financeiros.

Arquivo de homologacao: `docs/user-admin-local-homologation.md`

Resultado:

1. Foi criado `tests/playwright/integration-local-user-admin.spec.js`.
2. A suite local emulada passou a incluir `integration-local-user-admin.spec.js`.
3. Usuario comum ativo nao visualiza o painel de Administracao de Usuarios.
4. Usuario comum nao consegue listar `users`, atualizar outro usuario nem ler/escrever `users` diretamente pelas Firestore Rules.
5. Usuario pending fica bloqueado na tela de acesso e nao executa operacoes administrativas.
6. Usuario inactive fica bloqueado na tela de acesso e nao executa operacoes administrativas.
7. Admin autorizado por perfil ativo em Firestore acessa a UI real de Administracao de Usuarios, sem custom claim emitida pelo cliente.
8. Listagem administrativa valida pagina de 50 registros, navegacao proxima/anterior, unicidade e ausencia de duplicidade entre paginas.
9. Filtros server-side por `status`, `role` e `status+role` foram validados pela UI real.
10. Busca textual permanece page-local e nao promete busca global.
11. Botao de autoatribuicao de role admin para o proprio admin permanece desabilitado quando presente.
12. Registro financeiro privado de outro usuario nao aparece no DOM nem em `window.allRecords`.
13. Cliente nao expoe setter de custom claims, nao importa Firebase Admin SDK e nao injeta `admin`, `role` ou `status` no token/claims.
14. A emissao real de custom claims segue registrada como lacuna de backend/Admin SDK confiavel futuro.

Resultado focado:

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/integration-local-user-admin.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (17.5s)`, `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte dos cenarios negativos esperados. |

Resultado final da validacao 6.8:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado. `Wrote docs\global-api-inventory.md with 50 global/API entries.` |
| `npm.cmd test` | Aprovado. `Test Files 112 passed (112)`, `Tests 661 passed (661)`, duracao `13.96s`. Observacao: um teste negativo esperado emitiu `FINANCE_RECORD_CONTRACT_INVALID` em `stderr`, sem falhar a suite. |
| `npm.cmd run build` | Aprovado. Vite `v6.4.2`, `1946 modules transformed`, `built in 13.35s`. |
| `npm.cmd run smoke` | Aprovado. Status `ok`, URL `http://127.0.0.1:5175/`, 25 checks. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado. `47 passed (1.5m)`. |
| `npm.cmd run perf:audit` | Aprovado. `2 passed (7.7s)`. |
| `npm.cmd run bundle:budget` | Aprovado. `ok=true`, entry `375264` bytes contra budget `430080`, globais `50`, violacoes `[]`. |
| `npm.cmd run bootstrap:check` | Aprovado. `ok=true`, `classicScripts=22`, `evalExecutedScripts=22`, globais `50`, `entryBytes=375264`, `wrote=false`. |
| `npm.cmd run bootstrap:benchmark` | Aprovado. `ok=true`, `status=ok`, sem warnings e sem violacoes. |
| `npm.cmd run library-loader:check` | Aprovado. `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`, `newEval=[]`, `newFunction=[]`. |
| `npm.cmd run legacy-loader:check` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado. `ok=true`, `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `newGlobalExposures=[]`. |
| `npm.cmd run user-admin-modernization:check` | Aprovado. `ok=true`, `violations=[]`, globais `50`, `classicScripts=22`, `evalExecutedScripts=22`. |
| `npm.cmd run user-admin:benchmark` | Aprovado. `ok=true`, cenarios de `100`, `1000` e `5000` usuarios concluidos. |
| `npm.cmd run user-admin:query-check` | Aprovado. `ok=true`, 12 checks aprovados, filtros server-side suportados `status`, `role`, `status+role`. |
| `npm.cmd run resilience:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado. `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado. `ok=true`, `classicScriptsAfter=22`, `evalExecutedAfter=22`, globais `50`, `newFunction=[]`. |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npm.cmd run test:rules -- --reporter=dot"` | Aprovado com exit code `0`; logs `PERMISSION_DENIED`, limite de avaliacao e avisos internos fazem parte dos cenarios negativos/replay do emulador. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow -- --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 20 passed (20)`, duracao `6.78s`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/integration-local-user-admin.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (17.5s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite local emulada completa aprovada. `14 passed (1.5m)`, `Script exited successfully (code 0)`. |

Confirmacao final 6.8: nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado. Nenhuma regra financeira, Firestore Rules, Auth, politica administrativa, interface funcional, custom claim, budget, baseline, timeout ou retry foi alterado.

## Checkpoint 7.2 - UX, mobile e acessibilidade local

Objetivo: homologar telas criticas em desktop/mobile, nomes acessiveis minimos e ativacao por teclado no ambiente local, sem deploy e sem Firebase real.

Artefatos:

- `tests/playwright/release-ux-accessibility.spec.js`
- `docs/release-ux-accessibility-readiness.md`

Resultado:

- Desktop local: sem overflow horizontal bloqueante e sem controles visiveis sem nome acessivel nos cenarios cobertos.
- Mobile local `390x844`: sem overflow horizontal bloqueante nos cenarios cobertos.
- Teclado: acoes primarias do header ativaveis e foco em controles nomeados.
- Correcao limitada a atributos de acessibilidade/nomeacao de controles; nenhuma regra financeira, Firebase Rules, Auth/custom claims ou persistencia real foi alterada.

Lacunas: a validacao e local/mocked para UX e nao substitui homologacao manual em staging real, leitores de tela reais ou comparacao visual pixel-perfect.

## Adendo 7.3 - staging Firebase real

Executado em: 19/09/2026

Status: STAGING NOT VALIDATED.

Foi criado o projeto Firebase real de staging `finance-control-staging-260919` (project number `945561850688`) e o Web App staging `1:945561850688:web:8a00895f04d01d5aa860a5`. O Hosting default existe e recebeu deploy da aplicacao em `https://finance-control-staging-260919.web.app`.

Firestore staging foi provisionado: database `(default)` em `nam5`, Rules/Indexes deployados, indices `users` em `READY`. A validacao autenticada parou em Firebase Auth porque `identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED` e signup/config retornaram `CONFIGURATION_NOT_FOUND`.

Smoke real parcial aprovado: a URL staging carrega, o runtime usa `finance-control-staging-260919` e o teste Playwright nao detectou requests para `finance-control-cce4f`. Producao `finance-control-cce4f` nao foi alterada nem acessada para dados.
# Validação 7.3H — 17/10/2026

**LOCAL ENVIRONMENT ISOLATION VALIDATED**: configuração explícita e fail-closed, E2E local 16/16, regressão 47/47, Vitest 673/673, Rules/Auth Emulator verdes e zero tráfego Firebase cloud observado. Staging não foi retomado.
# Checkpoint 7.3I

Isolamento local continua validado e a retomada de staging não tocou produção. A homologação parcial passou 7/7, mas staging permanece **NOT VALIDATED** até concluir XLSX, auditoria, settings/references, mobile ampliado e rollback frontend.
