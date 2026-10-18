# Referencia de ApplicationError

Data: 2026-08-30

## Schema

`ApplicationError` usa `schemaVersion=1` e deve ser serializavel.

Campos:

- `code`: codigo estavel.
- `category`: classe funcional do erro.
- `severity`: `info`, `warning`, `error` ou `critical`.
- `message`: mensagem tecnica interna.
- `userMessage`: mensagem segura para interface.
- `retryable`: indica se a falha pode ser avaliada por `RetryPolicy`.
- `operation`: operacao associada.
- `correlationId`: correlacao da operacao.
- `causeCode`: codigo original saneado.
- `details`: detalhes sanitizados.
- `occurredAt`: timestamp ISO.
- `schemaVersion`: versao do contrato.

## Categorias

| Categoria | Uso |
| --- | --- |
| `VALIDATION` | Entrada invalida ou contrato incompleto. |
| `BUSINESS_RULE` | Regra de negocio bloqueou a operacao. |
| `AUTHENTICATION` | Usuario nao autenticado. |
| `AUTHORIZATION` | Usuario autenticado sem permissao. |
| `NOT_FOUND` | Recurso ausente. |
| `CONFLICT` | Estado concorrente ou payload divergente. |
| `IDEMPOTENCY` | Replay, conflito ou falha de recibo idempotente. |
| `NETWORK` | Falha transitoria de rede. |
| `TIMEOUT` | Prazo excedido. |
| `OFFLINE` | Cliente sem conectividade. |
| `PERSISTENCE` | Falha de persistencia nao classificada melhor. |
| `CONFIGURATION` | Configuracao ausente ou invalida. |
| `LAZY_LOAD` | Falha de modulo lazy/chunk. |
| `UNKNOWN` | Falha nao classificada. |

## Codigos atuais

| Codigo | Categoria |
| --- | --- |
| `VALIDATION_FAILED` | `VALIDATION` |
| `BUSINESS_RULE_BLOCKED` | `BUSINESS_RULE` |
| `AUTHENTICATION_REQUIRED` | `AUTHENTICATION` |
| `AUTHORIZATION_DENIED` | `AUTHORIZATION` |
| `RESOURCE_NOT_FOUND` | `NOT_FOUND` |
| `CONFLICT_DETECTED` | `CONFLICT` |
| `IDEMPOTENCY_CONFLICT` | `IDEMPOTENCY` |
| `NETWORK_UNAVAILABLE` | `NETWORK` |
| `OPERATION_TIMEOUT` | `TIMEOUT` |
| `CLIENT_OFFLINE` | `OFFLINE` |
| `PERSISTENCE_FAILED` | `PERSISTENCE` |
| `CONFIGURATION_INVALID` | `CONFIGURATION` |
| `LAZY_LOAD_FAILED` | `LAZY_LOAD` |
| `UNKNOWN_ERROR` | `UNKNOWN` |
| `POST_COMMIT_AUDIT_FAILED` | `PERSISTENCE` |
| `POST_COMMIT_CONFIRMATION_LOST` | `TIMEOUT` |

## Compatibilidade

O campo `applicationError` foi adicionado ao resultado de aplicacao sem remover `success`, `code`, `message`, `warnings`, `correlationId` ou demais campos legados.

