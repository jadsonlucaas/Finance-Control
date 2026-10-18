# Politica de reconciliacao pos-commit

Data: 2026-09-01

## Regra principal

Quando a mutacao foi confirmada no storage, mas a resposta da aplicacao foi perdida antes de chegar ao cliente, o sistema deve retornar `uncertain` e exigir reconciliacao por receipt antes de qualquer nova gravacao.

## Estados

| Estado | Significado |
| --- | --- |
| `confirmed_success` | A resposta de sucesso chegou ao chamador. |
| `confirmed_failure` | A operacao falhou antes do commit ou por conflito validado. |
| `uncertain` | O cliente nao pode afirmar se houve commit; nao repetir automaticamente. |
| `reconciled_success` | Receipt/entidade confirmaram que a operacao ja foi concluida. |
| `partial_success` | Commit principal ocorreu, mas uma etapa secundaria observavel falhou. |

## Processo

1. Criar `MutationAttemptContext` antes da mutacao.
2. Reutilizar a mesma `idempotencyKey` enquanto o payload nao mudar.
3. Reservar receipt antes do use case.
4. Persistir registro(s) e auditoria.
5. Completar receipt.
6. Se a resposta se perder depois do receipt completed, retornar `uncertain`.
7. Executar `ReconcileMutationAttempt`.
8. Se o receipt estiver `completed` e as entidades conferirem, retornar `reconciled_success`.
9. Se o receipt estiver `processing`, manter `uncertain` e nao reenviar automaticamente.
10. Se o payload mudar, retornar conflito/falha confirmada e exigir nova tentativa revisada.

## Proibicoes

- Nao criar entidade durante reconciliacao.
- Nao trocar `idempotencyKey` em retry da mesma tentativa.
- Nao fazer retry automatico de mutacao sem `idempotencyKey`.
- Nao guardar payload bruto, segredo, token, telefone, arquivo bruto ou credencial no attempt.
- Nao usar Firebase real, deploy ou integracao externa para testes desta politica.

## Aplicacao no CRUD financeiro web

Em 02/09/2026, `CreateExpenseCommand` e `CreateIncomeCommand` passaram a ser acionados por controllers ES Modules no caminho web autenticado. O mesmo store efemero de tentativa e usado pela bridge `window.financeApp.financialCrud`, preservando somente metadados seguros e fingerprint.

Atualizar, marcar como pago, arquivar e excluir tambem passam pelo gateway quando o comportamento do use case e equivalente ao legado. Estados incertos preservam tentativa; sucesso confirmado limpa tentativa. Fluxos que ainda representam reversao visual, como desmarcar pago e reabrir arquivado, continuam no fallback legado ate existir caso de uso explicito.
