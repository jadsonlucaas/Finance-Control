# Contratos de comandos de aplicacao

Todos os comandos usam envelope padrao:

```json
{
  "commandName": "CreateExpenseCommand",
  "schemaVersion": 1,
  "actor": { "type": "user", "id": "user-1", "role": "user" },
  "source": { "channel": "web", "referenceId": "form" },
  "idempotencyKey": "opcional",
  "correlationId": "corr-1",
  "requestedAt": "2026-07-18T12:00:00.000Z",
  "payload": {}
}
```

`actor.type`: `user`, `admin`, `system`, `integration`.

`source.channel`: `web`, `bank_import`, `spreadsheet_import`, `system`, `migration`, `future_integration`.

Nao existe canal `whatsapp` nesta etapa.

## Resultado padrao

Todo comando retorna:

```json
{
  "success": true,
  "code": "OK",
  "message": "Operacao concluida.",
  "entityId": "",
  "entityIds": [],
  "data": null,
  "warnings": [],
  "validationErrors": [],
  "applicationError": null,
  "idempotentReplay": false,
  "correlationId": "corr-1",
  "processedAt": "2026-07-18T12:00:00.000Z"
}
```

Codigos: `OK`, `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `IDEMPOTENT_REPLAY`, `PERSISTENCE_ERROR`, `BUSINESS_RULE_ERROR`, `CONFIGURATION_ERROR`.

## Comandos

| Comando | Payload | Regra usada |
| --- | --- | --- |
| `CreateExpenseCommand` | Registro `saida` ou payload de formulario de saida | `buildSaidaPayload`, `normalizeFinanceRecord`, `validateFinanceRecord`, `createRecord` |
| `UpdateExpenseCommand` | `id` e `fields`/`record` | `normalizeFinanceRecord`, `validateFinanceRecord`, `updateRecord` |
| `MarkExpenseAsPaidCommand` | `id`, `paidAt` opcional | Update de `status=Pago` e `paid_at` |
| `ArchiveExpenseCommand` | `expenseId` ou `id` | Caso de uso `ArchiveExpense`, update idempotente de `archived=true` |
| `DeleteExpenseCommand` | `expenseId` ou `id` | Caso de uso `DeleteExpense`, delete por registro unico |
| `CreateIncomeCommand` | Registro `entrada` ou payload de entrada | `buildEntradaPayload`, contrato financeiro e `createRecord` |
| `ConsolidateMonthlyIncomeCommand` | `person`, `competencia` | `consolidatePersonMonthlyEntry` |
| `CreateInstallmentSeriesCommand` | Dados da saida, `installments`, `totalAmount`, `baseDueDate` | `buildInstallmentSaidaPayloads`, `createManyRecords` |
| `CreateRecurrenceSeriesCommand` | Dados da saida, `recurrence`, frequencia e termino | `buildRecurringSaidaPayloads`, `createManyRecords` |
| `CreateHourEntryCommand` | Pessoa, competencia/data, horarios e parametros | `CalculateWorkSession`, contrato `controle_horas`, `createRecord` |
| `UpdateHourEntryCommand` | `id` e campos de jornada | `CalculateWorkSession`, contrato `controle_horas`, `updateRecord` |
| `MaterializePercentageRulesForCompetenceCommand` | `competence`, `optionalRuleIds` opcional | `MaterializePercentageRulesForCompetence`, occurrence key deterministica, `createIfAbsent` e `IdempotencyRepository` |
| `PrepareImportBatch` | Linhas parseadas, tipo de importacao, nome original e conteudo canonico | Valida, gera fingerprints e classifica candidatos sem escrever registros |
| `CommitImportBatch` | Batch preparado e candidatos selecionados | Reserva receipts, persiste linhas `ready` via `createMany` e audita resultado |

## Observacoes

- Idempotencia e opcional por comando.
- Quando `idempotencyKey` esta presente, o gateway cria/reserva `IdempotencyReceipt` antes do use case.
- Replay completo retorna `IDEMPOTENT_REPLAY` sem chamar o handler novamente.
- Payload diferente para a mesma chave logica retorna `CONFLICT`.
- Perda de resposta depois de commit confirmado retorna `POST_COMMIT_RESPONSE_LOST` com `mutationOutcome=uncertain`; o cliente deve reconciliar antes de qualquer nova gravacao.
- `MutationAttemptContext` e o contrato de resultado pos-commit estao descritos em `docs/mutation-attempt-contract.md` e `docs/post-commit-reconciliation-policy.md`.
- Handlers nao acessam DOM, `window`, Firebase SDK direto ou provedor externo.
- Handlers recebem repositorios por dependencia via `ApplicationCommandGateway`; no runtime web a dependencia e o adapter Firebase Web, e em testes e in-memory explicito.
- Handlers delegam para `src/application/useCases/financeRecordUseCases.js`; regra canonica de aplicacao nao fica no handler.
- Metadados `source_channel`, `source_reference_id`, `created_by_type`, `created_by_id`, `idempotency_key`, `correlation_id`, `received_at` e `processed_at` sao preenchidos pelo gateway quando aplicavel.
- Payload com `owner_uid` divergente nao substitui o owner do contexto autenticado.
- Contratos de importacao estao detalhados em `docs/import-batch-contract.md`.
- Materializacao percentual esta detalhada em `docs/percentage-rule-materialization-policy.md`; o comando nao depende de DOM/window e nao implementa backend, WhatsApp ou Admin SDK.
- Falhas normalizadas podem preencher `applicationError` mantendo os campos legados. Consumidores devem usar `code`/`applicationError.code`, nunca texto visual, para decidir comportamento.
- Retry de comandos deve seguir `docs/retry-policy.md`; mutacoes sem `idempotencyKey` nao recebem retry automatico.
