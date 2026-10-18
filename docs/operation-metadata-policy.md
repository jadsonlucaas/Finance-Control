# Politica de Metadata Operacional

## Contrato

Campos padronizados:

- `schema_version`
- `source_channel`
- `source_reference_id`
- `created_by_type`
- `created_by_id`
- `correlation_id`
- `idempotency_key`
- `received_at`
- `processed_at`

`source_channel`: `web`, `bank_import`, `spreadsheet_import`, `system`, `migration`, `future_integration`.

`created_by_type`: `user`, `admin`, `system`, `integration`.

`source_channel` representa o canal/origem, nao o nome do processo interno. A materializacao automatica de regras percentuais usa `source_channel=system`; a operacao continua identificada por `command_name=MaterializePercentageRulesForCompetence`, auditoria `percentage_rule_materialization`/`PERCENTAGE_RULE_*` e `source_reference_id` com a occurrence key.

## Regras

- Metadata operacional e opcional para registros legados.
- Novos casos de uso devem normalizar metadata por `normalizeOperationMetadata`.
- `source_reference_id`, `idempotency_key`, `correlation_id` e `created_by_id` nao podem ser vazios quando presentes.
- `created_by_id` nao e `owner_uid`; owner continua vindo do contexto autenticado.
- `source_channel` nunca concede autorizacao e nunca altera calculos.
- Telefone, campo de provedor, webhook, mensagem bruta, token, senha ou credencial nao fazem parte do contrato.

## Reuso Futuro

Um backend futuro pode usar `future_integration` e preencher `source_reference_id`/`idempotency_key` com um identificador externo ja resolvido para um usuario autorizado. Nenhuma integracao externa foi implementada nesta etapa.

## Importacoes financeiras

Importacoes usam:

- `source_channel=bank_import` para extratos bancarios;
- `source_channel=spreadsheet_import` para planilhas;
- `source_reference_id` como identificador externo quando o arquivo fornece uma transacao estavel;
- `idempotency_key` como chave tecnica do batch ou da linha;
- `correlation_id` propagado para registros, receipts e auditoria.

Esses metadados nao entram em calculos financeiros e nao concedem permissao.
## Correlacao com auditoria

Toda operacao auditavel deve propagar `correlationId` desde o comando ate o `AuditEvent`. `sourceChannel` continua representando canal de origem, enquanto `operation`/`command_name` representam processo executado. Canais futuros, como integracoes backend, devem usar `future_integration` ate existir contrato proprio validado por testes e Rules.

Chaves de idempotencia nao devem ser gravadas em auditoria em texto puro; usar `idempotency_key_hash`.
