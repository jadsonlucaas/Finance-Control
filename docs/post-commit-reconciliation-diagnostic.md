# Diagnostico de reconciliacao pos-commit

Data: 2026-09-01

## Escopo

Este diagnostico cobre mutacoes financeiras com risco de "commit concluido, resposta perdida". O objetivo e impedir duplicidade quando o cliente perde a resposta depois de persistir registro, receipt e auditoria.

Nao foram avaliados nem implementados fila offline, provider externo, WhatsApp, telefone, Admin SDK, deploy ou banco Firebase real.

## Pontos criticos mapeados

| Ponto | Estado antes | Risco | Politica aplicada |
| --- | --- | --- | --- |
| `ApplicationCommandGateway.executeCommand` | Completava receipt e retornava resultado imediatamente. | Perda de resposta apos `complete` poderia parecer falha reenviavel. | Fault seam pos-commit retorna estado `uncertain` sem marcar receipt como failed. |
| `CreateExpenseCommand` | Idempotencia opcional via envelope. | Saida duplicada por reenvio manual apos timeout. | Piloto web cria tentativa estavel e preserva rascunho ate confirmar/reconciliar. |
| `CreateIncomeCommand` | Idempotencia opcional via envelope. | Entrada duplicada e impacto em consolidacoes. | Piloto web cria tentativa estavel e preserva rascunho em estado incerto. |
| `CreateHourEntryCommand` | Coberto no gateway e dominio. | Apontamento duplicado altera banco de horas/hora extra. | Coberto por teste unitario de politica pos-commit. |
| `CreateInstallmentSeriesCommand` | Batch com `createMany`. | Parcelas duplicadas em reenvio. | Mesma chave para a serie; replay nao chama handler. |
| `CreateRecurrenceSeriesCommand` | Batch com `createMany`. | Recorrencias duplicadas. | Mesma chave para a serie; replay nao chama handler. |
| `CommitImportBatch` | Use case ja usa receipts de batch e linha. | Reimportar lote apos falha visual. | Teste congela replay do lote inteiro sem duplicidade. |
| `UpdateExpenseCommand` e `MarkExpenseAsPaidCommand` | Mutacoes idempotentes dependem de envelope externo. | Estado final pode ser reaplicado, mas exige analise de consumidores. | Candidatos futuros; nao integrados ao piloto UI nesta etapa. |
| `ArchiveExpenseCommand` e `DeleteExpenseCommand` | Mutacoes destrutivas/idempotentes por entidade. | Repeticao pode mascarar ausencia ou conflito. | Exigem teste especifico antes de UI. |
| Materializacao percentual | Ja possui reconciliacao de entidade deterministica. | Receipt `processing` apos entidade criada. | Mantida politica existente; sem alteracao funcional. |

## Lacunas controladas

- Reconciliacao automatica visual completa ainda exige desenho de experiencia por tela.
- Atualizacao, pagamento, arquivamento e exclusao devem receber testes especificos antes de expor reconciliacao na UI.
- Teste Emulator desta etapa usa Firestore para receipts idempotentes e repositorios em memoria para registros/auditoria, evitando Firebase real e evitando limite de avaliacao das regras em um cenario composto.

