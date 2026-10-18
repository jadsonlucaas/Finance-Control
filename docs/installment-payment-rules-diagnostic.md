# Diagnostico de Rules - pagamento de parcela

Data: 2026-09-12

Escopo: corrigir a validacao local do pagamento de parcela no Firestore Emulator, sem deploy, sem Firebase real e sem alteracao de regras financeiras.

## Ambiente

| Item | Valor |
| --- | --- |
| Projeto local de Rules | `finance-control-local-test` |
| Projeto E2E emulado | `demo-finance-control-local-e2e` |
| Auth Emulator | `127.0.0.1:9099` |
| Firestore Emulator | `127.0.0.1:8080` |
| Vite local E2E | `http://127.0.0.1:5178` |
| Spec Rules | `tests/firestore/firestore-rules.test.js` |
| Spec E2E | `tests/playwright/integration-local-installments.spec.js` |

## Sintoma reproduzido

O pagamento da primeira parcela pelo fluxo real da aplicacao chamava `MarkExpenseAsPaidCommand`, mas o update em `users/{uid}/finance_records/{recordId}` era negado pelo Firestore Emulator com:

```text
Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.
```

O teste focado `91A usuario ativo paga a propria parcela com payload completo sem relaxar isolamento` foi criado para reproduzir o problema antes da correcao. Antes do ajuste, o update valido da propria parcela falhava com `PERMISSION_DENIED` por limite de expressoes.

## Causa

`hasValidFinanceShape()` validava todos os tipos financeiros por uma cadeia de `||` e a validacao de `saida` ainda tinha um ramo redundante para `generated_percentage_rule`. Para um payload completo de parcela, o custo acumulado da avaliacao de Rules excedia o limite do Firestore Rules durante o update.

## Correcao aplicada

- Removido o ramo redundante de `hasValidGeneratedPercentageSaidaShape()` na decisao de `hasValidFinanceShape()`. A validacao de `saida` continua passando por `hasValidSaidaShape()`, que ja contempla os campos percentuais opcionais usados pelas saidas materializadas.
- As funcoes de validacao de shape financeiro passaram a cachear `request.resource.data` em `let d`, reduzindo expressoes repetidas sem mudar os predicados de validacao.
- Nenhuma autorizacao por metadata foi adicionada.
- `owner_uid`, `owner_email` e `type` continuam imutaveis em update.
- Campos sensiveis como telefone/WhatsApp continuam proibidos.

## Cobertura adicionada

`tests/firestore/firestore-rules.test.js`

- Permite usuario ativo pagar a propria parcela com payload completo.
- Confirma persistencia de `status: Pago` e `paid_at`.
- Rejeita usuario nao autenticado.
- Rejeita outro owner, mesmo com metadata de integracao.
- Rejeita pending/inactive.
- Rejeita mutacao de `owner_uid` e `type`.
- Rejeita `status` e `paid_at` invalidos.
- Rejeita campo proibido.

`tests/playwright/integration-local-installments.spec.js`

- Cria parcelamento real pela UI.
- Paga a primeira parcela pela UI real.
- Confirma persistencia autenticada no Firestore Emulator.
- Recarrega a aplicacao e confirma que a parcela continua paga.
- Troca A -> B -> A e confirma ausencia de vazamento e retorno da serie paga.

## Resultado observado

Comando focado de Rules:

```powershell
npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore 'npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t "91A" --reporter=dot'
```

Resultado: `Test Files 1 passed (1)`, `Tests 1 passed | 105 skipped`, `Script exited successfully (code 0)`.

Comando focado E2E:

```powershell
npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore 'npm.cmd run test:e2e-local -- tests/playwright/integration-local-installments.spec.js'
```

Resultado: `1 passed (51.6s)`, `Script exited successfully (code 0)`.

Observacao: o Firestore Emulator ainda pode emitir avisos `entity already exists` em `audit_logs` durante auditoria concorrente. Isso nao bloqueou a persistencia funcional do pagamento e permanece como lacuna separada de auditoria.

## Limites

- Nao houve deploy.
- Nao houve uso de Firebase real.
- Nao houve push, pull ou fetch.
- Nao houve webhook, WhatsApp, telefone, provider externo ou Admin SDK.
- A correcao ficou restrita a Rules, testes e documentacao.
