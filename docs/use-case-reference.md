# Referencia de casos de uso financeiros

## Diagrama

```text
UI / Future Backend
        |
        v
Gateway
        |
        v
Command Handler
        |
        v
Use Case
        |
        +----> Domain Engine
        |
        +----> Repository Interface
        |
        +----> Audit Repository
```

Um backend futuro podera chamar os mesmos comandos e casos de uso com contexto confiavel. Nenhum WhatsApp, webhook, telefone, identidade externa, permissao publica ou Admin SDK foi implementado nesta etapa.

## Casos

| Caso | Entrada | Contexto | Dependencias | Regras | Persistencia | Auditoria | Retorno/erros | Compatibilidade futura |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CreateExpense` | Payload de saida ou `record` | Ator ativo, owner autorizado, source/correlation/idempotency | `FinanceRecordRepository`, `AuditRepository`, `buildSaidaPayload` | Saida simples, owner do contexto, schema v1, status/paid_at validados | `create` | `finance_record.create` apos sucesso | `OK`, `VALIDATION_ERROR`, `PERSISTENCE_ERROR` | Backend envia mesmo payload sem DOM |
| `UpdateExpense` | `id`, `fields` ou `record` | Mesmo owner ou admin via gateway | `FinanceRecordRepository`, `AuditRepository` | Busca atual, type/owner/series imutaveis, nao altera irma | `update` por id | `finance_record.update` before/after | `OK`, `NOT_FOUND`, `FORBIDDEN`, `BUSINESS_RULE_ERROR` | Edicao de serie futura deve ter caso especifico |
| `MarkExpenseAsPaid` | `expenseId`/`id`, `paidAt` opcional | Ator ativo | `FinanceRecordRepository`, `AuditRepository` | Idempotente se ja pago, nao altera valor/serie | `update` por id | `finance_record.mark_paid` before/after | `OK`, replay idempotente, erros estruturados | Sem toggle ambiguo para integracoes |
| `ArchiveExpense` | `expenseId`/`id` | Ator ativo | `FinanceRecordRepository`, `AuditRepository` | Arquiva idempotente, preserva owner/type | `update` por id | `finance_record.archive` before/after | `OK`, replay idempotente | Preferencial para historico |
| `DeleteExpense` | `expenseId`/`id` | Ator ativo | `FinanceRecordRepository`, `AuditRepository` | Exclui apenas registro alvo; nao apaga parent_id inteiro | `delete` por id | `finance_record.delete` com snapshot before | `OK`, `NOT_FOUND`, `FORBIDDEN` | Politicas destrutivas futuras devem ser explicitas |
| `CreateIncome` | Payload de entrada ou `record` | Ator ativo | `FinanceRecordRepository`, `AuditRepository`, `buildEntradaPayload` | Entrada normalizada, owner e metadata | `create` | `finance_record.create_income` | `OK`, `VALIDATION_ERROR` | Nao calcula folha; consolidacao separada |
| `ConsolidateMonthlyIncome` | `person`, `competence`/`competencia` | Ator ativo | `FinanceRecordRepository`, motor tributario via consolidacao | Competencia explicita, base trabalho sem outras receitas | Leitura; nao persiste nesta etapa | Nao grava mutacao | `OK` com breakdown/versoes | Backend pode consultar sem DOM |
| `CreateInstallmentSeries` | Payload de saida, parcelas, total e data base | Ator ativo | Dominio `buildInstallmentSaidaPayloads`, `FinanceRecordRepository`, `AuditRepository` | Nao reimplementa centavos, valida todas ocorrencias | `createMany` atomico | `finance_record.create_installment_series` | ids, count, itens ou erro | Mesmo wrapper serve backend |
| `CreateRecurrenceSeries` | Payload de saida, frequencia e termino | Ator ativo | Dominio `buildRecurringSaidaPayloads`, `FinanceRecordRepository`, `AuditRepository` | Nao reimplementa datas, valida todas ocorrencias | `createMany` atomico | `finance_record.create_recurrence_series` | ids, count, itens ou erro | Mesmo wrapper serve backend |
| `CreateHourEntry` | Pessoa, competencia/data, horarios e parametros | Ator ativo | `CalculateWorkSession`, `ResolveEffectiveSalary`, `FinanceRecordRepository`, `AuditRepository` | Calcula um lancamento, sem DSR duplicado | `create` | `finance_record.create_hour_entry` | record `controle_horas` ou erros de jornada | Backend envia horarios/contexto |
| `UpdateHourEntry` | `id`, `fields`/`record` | Ator ativo e owner | `CalculateWorkSession`, `ResolveEffectiveSalary`, `FinanceRecordRepository`, `AuditRepository` | Recalcula apenas registro alvo, preserva historico | `update` por id | `finance_record.update_hour_entry` before/after | `OK`, `NOT_FOUND`, `VALIDATION_ERROR` | Nao reprocessa mes |
| `MaterializePercentageRulesForCompetence` | `competence`, `optionalRuleIds` opcional | Ator ativo e owner | `CalculatePercentageRuleOccurrence`, `FinanceRecordRepository`, `IdempotencyRepository`, `AuditRepository` | Cria faltantes, nao reescreve existentes | `createIfAbsent` | Eventos `PERCENTAGE_RULE_*` | resumo com created/alreadyExisting/skips/conflicts | Backend futuro pode chamar sem DOM/window |
| `CreateFinanceBackupSnapshot` | Sem payload financeiro mutavel | Ator ativo e owner | `FinanceRecordRepository`, `LocalSettingsRepository`, `AuditRepository` | Exporta somente dados recuperaveis e sanitizados | Nenhuma escrita financeira | `BACKUP_CREATED` resumido | snapshot, warnings, checksum | Backend futuro pode reutilizar com repositorios confiaveis |
| `ValidateFinanceBackupSnapshot` | `snapshot`, owner esperado opcional | Nao exige DOM/UI | Nenhuma | Versao, schema, checksum, duplicidade, campos proibidos e referencias | Nenhuma | Nao grava por padrao | validacao estruturada | Porta de entrada obrigatoria antes de restore |
| `PrepareFinanceRestore` | `snapshot` | Ator ativo e owner destino | `FinanceRecordRepository`, `AuditRepository` | Plano sem escrita, owner do contexto, conflitos bloqueantes | Nenhuma escrita financeira | `RESTORE_PREPARED` resumido | plano e resumo por status | Backend futuro deve exibir/aprovar o plano |
| `CommitFinanceRestore` | `restorePlan` preparado | Ator ativo e owner destino | `FinanceRecordRepository`, `IdempotencyRepository`, `AuditRepository` | Cria somente `new`; nao sobrescreve conflito; snapshot pre-restore | `createMany` apenas para financeiros novos | `RESTORE_COMMITTED` ou `RESTORE_FAILED` | ids, snapshot pre-restore, replay idempotente | Restore real deve rodar server-side em etapa futura |
| `PrepareFinanceRollback` | snapshot pre-restore e correlacao restaurada | Ator ativo | `FinanceRecordRepository`, `AuditRepository` | Calcula registros criados pela correlacao do restore | Nenhuma escrita | `RESTORE_ROLLBACK_PREPARED` | plano de rollback | Sem apagar dados externos |
| `CommitFinanceRollback` | plano de rollback | Ator ativo | `FinanceRecordRepository`, `IdempotencyRepository`, `AuditRepository` | Remove criados pelo restore e reusa contrato de restore | `delete` seletivo e `createMany` quando aplicavel | `RESTORE_ROLLBACK_COMMITTED` | ids removidos/criados | Exige correlacao preservada |

## Observacoes

- Handlers em `src/application/gateway/financeCommandHandlers.js` apenas delegam.
- Casos de uso rodam com `InMemoryFinanceRecordRepository` e adapters Firebase Web por injecao.
- `future_integration` e apenas canal tecnico permitido no envelope; nao representa implementacao de WhatsApp.
- Materializacao percentual esta detalhada em `docs/percentage-rule-materialization-policy.md` e preserva ocorrencias pagas, arquivadas, editadas ou divergentes.
- Backup e recuperacao estao detalhados em `docs/backup-restore-policy.md` e nao recalculam regras financeiras.
- Erros de aplicacao devem ser normalizados para `ApplicationError` quando cruzam fronteiras de gateway, UI, repositorio ou backend futuro.
- Use cases nao devem depender de texto de UI, DOM, `window`, `navigator`, Firebase SDK direto ou provider externo para decidir erro/retry.
## Auditoria por caso de uso

Use cases que persistem dados financeiros devem auditar depois da mutacao confirmada. O evento deve carregar `correlation_id`, `source_channel`, `owner_uid`, `entity_type`, `entity_id` ou `entity_ids`, `before`, `after` e `result_status`.

Falha de auditoria nao deve converter sucesso financeiro em rollback aparente. O retorno deve expor warning de auditoria para suporte e regressao. Replays e conflitos de idempotencia devem preservar recibos e nao duplicar auditoria financeira de sucesso.

## Resiliencia por caso de uso

Leituras podem ser executadas por `executeWithResilience` com retry limitado para `NETWORK` e `TIMEOUT`. Mutacoes financeiras so podem receber retry automatico quando a operacao for idempotente e a mesma `idempotencyKey` for reaproveitada. Falhas pos-commit devem ser tratadas como estado a reconciliar, diferenciando operacao nao salva de operacao salva com confirmacao/auditoria falha.

## Reconciliacao pos-commit por caso de uso

| Caso | Cobertura desta etapa | Observacao |
| --- | --- | --- |
| `CreateExpense` | Vitest, Playwright local e Emulator de receipt | Piloto UI web cria attempt estavel e preserva rascunho quando incerto. |
| `CreateIncome` | Vitest | Piloto UI web cria attempt estavel e preserva rascunho quando incerto. |
| `CreateHourEntry` | Vitest | Cobertura no gateway; UI especifica permanece para etapa futura. |
| `CreateInstallmentSeries` | Vitest e Emulator de receipt | Batch inteiro usa uma chave; replay nao duplica parcelas. |
| `CreateRecurrenceSeries` | Vitest | Batch inteiro usa uma chave; replay nao duplica recorrencias. |
| `CommitImportBatch` | Vitest e dry-run | Batch e linhas preservam receipts; replay nao reimporta registros. |
| `UpdateExpense`, `MarkExpenseAsPaid`, `ArchiveExpense`, `DeleteExpense` | Candidato futuro | Exigem testes de consumidores e experiencia visual especifica antes de UI. |
