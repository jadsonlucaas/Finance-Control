# Contratos de consultas de aplicacao

Todas as consultas usam envelope padrao:

```json
{
  "queryName": "GetMonthlySummaryQuery",
  "schemaVersion": 1,
  "actor": { "type": "user", "id": "user-1", "role": "user" },
  "source": { "channel": "web", "referenceId": "dashboard" },
  "correlationId": "corr-1",
  "requestedAt": "2026-07-18T12:00:00.000Z",
  "payload": {}
}
```

Consultas nao usam `idempotencyKey`.

## Consultas

| Consulta | Payload | Retorno |
| --- | --- | --- |
| `GetMonthlySummaryQuery` | `competence`/`competencia`, `person` opcionais | Totais de entradas, saidas, horas, saldo e quantidade de registros |
| `GetOpenExpensesQuery` | Filtros opcionais de competencia e pessoa | Saidas nao pagas |
| `GetExpenseByIdQuery` | `id` | Saida por id |
| `GetIncomeByIdQuery` | `id` | Entrada por id |
| `GetInstallmentSeriesQuery` | `parentId` ou `seriesId` | Parcelas da serie |
| `GetRecurrenceSeriesQuery` | `seriesId` | Ocorrencias recorrentes |
| `GetHourSummaryQuery` | `start`, `end`, `person` opcional | Resumo de hora extra e banco de horas |
| `GetEffectiveCategoriesQuery` | Sem payload obrigatorio | Categorias pessoais do usuario e globais |
| `GetEffectiveMacrosQuery` | Sem payload obrigatorio | Macros pessoais do usuario e globais |

## Garantias

- Queries compartilham o mesmo contrato de resultado dos comandos.
- Queries usam `FinanceRecordRepository` por dependencia e nao devem cair em snapshots Firebase crus.
- Queries nao elevam privilegio por canal de origem.
- Queries nao recalculam regras fora dos seletores e dominios existentes.
- A centralizacao em `src/application/useCases` desta etapa cobre comandos mutaveis; contratos de query foram preservados.
- Consumidor server-side futuro deve passar por `ApplicationCommandGateway`, com contexto autenticado confiavel.
