# Referencia de Eventos de Auditoria

Data: 2026-08-22

## Eventos Canonicos

| Evento | Categoria | Origem legada |
| --- | --- | --- |
| `USER_APPROVED` | admin | `admin.user_approve` |
| `USER_DEACTIVATED` | admin | `admin.user_deactivate` |
| `USER_REACTIVATED` | admin | `admin.user_reactivate` |
| `USER_ROLE_CHANGED` | admin | `admin.user_role_change` |
| `EXPENSE_CREATED` | financial | `finance_record.create` |
| `EXPENSE_UPDATED` | financial | `finance_record.update` |
| `EXPENSE_MARKED_PAID` | financial | `finance_record.mark_paid` |
| `EXPENSE_ARCHIVED` | financial | `finance_record.archive` |
| `EXPENSE_DELETED` | financial | `finance_record.delete` |
| `INCOME_CREATED` | financial | `finance_record.create_income` |
| `MONTHLY_INCOME_CONSOLIDATED` | financial | `finance_record.consolidate_income` |
| `INSTALLMENT_SERIES_CREATED` | financial | `finance_record.create_installment_series` |
| `RECURRENCE_SERIES_CREATED` | financial | `finance_record.create_recurrence_series` |
| `HOUR_ENTRY_CREATED` | financial | `finance_record.create_hour_entry` |
| `HOUR_ENTRY_UPDATED` | financial | `finance_record.update_hour_entry` |
| `IMPORT_COMMITTED` | operational | `IMPORT_COMMITTED` |
| `IMPORT_REPLAYED` | operational | `IMPORT_REPLAYED` |
| `IMPORT_FAILED` | operational | `IMPORT_FAILED` |
| `PERCENTAGE_RULE_OCCURRENCE_CREATED` | operational | `PERCENTAGE_RULE_OCCURRENCE_CREATED` |
| `PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS` | operational | `PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS` |
| `PERCENTAGE_RULE_MATERIALIZATION_STARTED` | operational | `PERCENTAGE_RULE_MATERIALIZATION_STARTED` |
| `PERCENTAGE_RULE_MATERIALIZATION_FAILED` | operational | `PERCENTAGE_RULE_MATERIALIZATION_FAILED` |
| `PERCENTAGE_RULE_RECEIPT_RECONCILED` | operational | `PERCENTAGE_RULE_RECEIPT_RECONCILED` |
| `IDEMPOTENCY_REPLAY` | operational | `IDEMPOTENCY_REPLAY` |
| `IDEMPOTENCY_CONFLICT` | operational | `IDEMPOTENCY_CONFLICT` |
| `BACKUP_CREATED` | operational | `BACKUP_CREATED` |
| `BACKUP_VALIDATED` | operational | `BACKUP_VALIDATED` |
| `RESTORE_PREPARED` | operational | `RESTORE_PREPARED` |
| `RESTORE_COMMITTED` | operational | `RESTORE_COMMITTED` |
| `RESTORE_FAILED` | operational | `RESTORE_FAILED` |
| `RESTORE_ROLLBACK_PREPARED` | operational | `RESTORE_ROLLBACK_PREPARED` |
| `RESTORE_ROLLBACK_COMMITTED` | operational | `RESTORE_ROLLBACK_COMMITTED` |

## Consultas Administrativas

O contrato de repositorio expoe consultas append-only:

- `getById(eventId, context)`;
- `listByCorrelationId(correlationId, context, query)`;
- `listByEntity(entityType, entityId, context, query)`;
- `listByOwner(query, context)`;
- `listSecurityEvents(query, adminContext)`.

No adaptador Firebase web, essas consultas dependem de facade futura (`auditSdk.list`) e retornam indisponibilidade quando ela nao existe. No repositorio em memoria, elas cobrem testes locais sem Firebase real.

## Replays e Idempotencia

Replays e conflitos devem ser auditados com `result_status` distinto e `idempotency_key_hash`, nunca com chave bruta. Um replay nao deve executar novamente o handler financeiro nem duplicar auditoria financeira de sucesso.

## Backup e Restore

Eventos de backup e restore devem registrar somente resumo operacional: `backup_id` ou `restore_id`, checksum truncado, contagens agregadas e `correlation_id`. O arquivo de backup completo, valores financeiros detalhados, credenciais, telefone, WhatsApp, payload bruto e bytes de arquivo nao devem entrar na auditoria.
