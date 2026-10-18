# Diagnostico da camada de casos de uso

Gerado em: 22/08/2026

Esta etapa mapeia onde a regra financeira estava antes da centralizacao em `src/application/useCases`. Nenhuma regra tributaria, Firestore Rules, autenticacao, parcelamento, recorrencia, motor de horas, importacao ou relatorio foi alterado funcionalmente.

## Mapa por operacao

| Operacao | Localizacao anterior da regra | Duplicacoes e side effects | Repositorio usado | Caso de uso proposto | Risco | Compatibilidade | Sequencia de migracao |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CreateExpense | `financeCommandHandlers.js`, `recordPayloads.js`, `handleSubmit` legado | UI lia formulario e handler normalizava/persistia/auditava | `FinanceRecordRepository` via adapter | `CreateExpense` | Alto: owner e persistencia | Mantem `CreateExpenseCommand` e toast legado | Handler delega ao use case |
| UpdateExpense | `financeCommandHandlers.js`, bridges de `financeRecordMutations` | Regra de owner/type ficava implicita no repo/handler | `FinanceRecordRepository` | `UpdateExpense` | Alto: parcelas/series | Nao altera parcela irma nem serie | Buscar atual, validar imutaveis, auditar before/after |
| MarkExpenseAsPaid | `financeCommandHandlers.js`, `togglePago` legado | Toggle visual misturava estado e feedback | `FinanceRecordRepository` | `MarkExpenseAsPaid` | Medio: idempotencia | Toggle legado preservado fora da API canonica | Caso explicito para pagar; reversao fica fora deste escopo |
| ArchiveExpense | `archiveRecord.js`/toggle legado | Toggle ambiguidade entre arquivar/desarquivar | `FinanceRecordRepository` | `ArchiveExpense` | Medio | Bridge legada continua existindo | Caso canonico arquiva idempotente |
| DeleteExpense | `deleteRecord.js`/`confirmDelete` legado | UI controla modal e exclusao | `FinanceRecordRepository` | `DeleteExpense` | Alto: series | Nao apaga parent_id inteiro implicitamente | Delete por id unico, auditar snapshot |
| CreateIncome | `financeCommandHandlers.js`, `recordPayloads.js`, formularios de entrada | Normalizacao duplicada entre UI e handler | `FinanceRecordRepository` | `CreateIncome` | Medio | Mantem payload de formulario e record pronto | Handler delega |
| ConsolidateMonthlyIncome | `consolidatePersonMonthlyEntry`, `consolidarEntradaMensal` global | Global era consumidor canonico em varias telas | `FinanceRecordRepository` para leitura | `ConsolidateMonthlyIncome` | Alto: impostos/base | Reutiliza motor tributario versionado | Use case chama consolidacao pura com competencia explicita |
| CreateInstallmentSeries | `recordPayloads.js`, dominio `installmentSeries`, UI chama `createManyRecords` | UI ainda monta preview; regra de centavos ja pura | `FinanceRecordRepository.createMany` | `CreateInstallmentSeries` | Alto: escrita parcial | Nao recalcula centavos; usa dominio existente | Use case encapsula validacao, metadata, createMany e audit |
| CreateRecurrenceSeries | `recordPayloads.js`, dominio `recurrenceSeries`, UI chama `createManyRecords` | UI ainda monta preview; regra temporal ja pura | `FinanceRecordRepository.createMany` | `CreateRecurrenceSeries` | Alto: datas/series | Nao reimplementa datas | Use case encapsula metadata, createMany e audit |
| CreateHourEntry | `financeCommandHandlers.js`, `CalculateWorkSession`, formularios legados | Motor puro ja existe; montagem do record ficava no handler | `FinanceRecordRepository` | `CreateHourEntry` | Medio | Reutiliza `CalculateWorkSession` | Use case calcula e persiste record `controle_horas` |
| UpdateHourEntry | `financeCommandHandlers.js`, `CalculateWorkSession` | Recalculo de um registro ficava no handler | `FinanceRecordRepository` | `UpdateHourEntry` | Medio | Nao reprocessa mes | Buscar atual, recalcular apenas registro, auditar |

## Achados

- Regra ainda dentro de handler: criacao/edicao de saida, pagamento, entrada, series e horas estavam concentradas em `financeCommandHandlers.js`.
- Regra ainda dentro de UI/legacy: formularios continuam lendo campos, exibindo toast e mantendo bridges; preview de parcelamento/recorrencia permanece visual.
- Regra duplicada: normalizacao de payload de saida/entrada aparecia no handler e em builders globais; agora o caso de uso usa os builders canonicos.
- Persistencia misturada com dominio: handlers chamavam diretamente repositorios; agora use cases recebem repositorios por dependencia.
- Auditoria disparada por UI: nao foi removida das bridges legadas, mas os casos de uso padronizam auditoria para os comandos novos.
- Validacao/normalizacao duplicada: casos de uso centralizam `normalizeFinanceRecord` e `validateFinanceRecord` antes da persistencia.
- Owner: `owner_uid` passa a vir do contexto do use case, preservando a regra do gateway.
- Status: pagamento vira caso explicito `MarkExpenseAsPaid`; toggle ambiguo fica apenas como compatibilidade legada.
- Archive/delete: casos canonicos nao operam serie inteira por `parent_id`.
- Consolidacao: usa competencia explicita e motor tributario existente; nao escreve historico.
- HE: usa `CalculateWorkSession` e `ResolveEffectiveSalary`; nao duplica motor de jornada.
- APIs globais: continuam consumidores legados, nao fonte canonica nova.

## Sequencia segura

1. Criar casos de uso independentes de DOM/window/Firebase.
2. Delegar command handlers para casos de uso.
3. Preservar bridges globais e UI atual.
4. Cobrir in-memory e gateway com regressao.
5. Validar smoke/Playwright para o piloto web.
6. Manter futuras integracoes chamando o mesmo gateway/use case com contexto confiavel.
