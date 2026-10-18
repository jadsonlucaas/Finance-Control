# Politica de Retry

Data: 2026-08-30

## Contrato

`RetryPolicy` recebe:

- `error`;
- `operationType`;
- `idempotent`;
- `hasIdempotencyKey`;
- `attempt`;
- `context`.

Retorna:

- `shouldRetry`;
- `delayMs`;
- `maxAttempts`;
- `reason`.

## Leituras

| Categoria | Politica |
| --- | --- |
| `NETWORK` | Retry limitado. |
| `TIMEOUT` | Retry limitado. |
| `OFFLINE` | Nao repetir imediatamente; aguardar reconexao/acao do usuario. |
| `AUTHORIZATION` | Sem retry automatico. |
| `AUTHENTICATION` | Sem retry automatico. |
| `VALIDATION` | Sem retry automatico. |
| `NOT_FOUND` | Sem retry automatico por padrao. |
| `UNKNOWN` | Sem retry automatico. |

## Mutacoes

| Condicao | Politica |
| --- | --- |
| Sem `idempotencyKey` | Sem retry automatico. |
| Com `idempotencyKey` e erro `NETWORK`/`TIMEOUT` | Retry limitado reutilizando a mesma chave. |
| `VALIDATION`, `BUSINESS_RULE`, `AUTHORIZATION`, `CONFLICT`, `UNKNOWN` | Sem retry automatico. |
| Falha pos-commit | Reconciliar estado/receipt antes de nova gravacao. |
| Resultado `uncertain` por `POST_COMMIT_RESPONSE_LOST` | Sem retry automatico; executar `ReconcileMutationAttempt`. |
| Payload diferente do attempt original | Sem retry; retornar conflito/falha confirmada e exigir revisao do usuario. |

## Lazy load

Falhas `LAZY_LOAD` aceitam retry manual limitado. Nao ha reload automatico infinito.

## Garantias

- `maxAttempts` impede loop infinito.
- Delay e clock podem ser injetados para testes deterministicos.
- Retry nao altera regra financeira.
- Retry nao cria nova idempotencyKey.
- Retry nao cria fila offline.
