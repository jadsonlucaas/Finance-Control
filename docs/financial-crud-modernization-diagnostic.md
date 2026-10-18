# Diagnostico de Modernizacao do CRUD Financeiro

Gerado em: 02/09/2026

Este diagnostico registra o estado do CRUD financeiro principal antes da migracao incremental para ES Modules. Ele nao altera regra financeira, interface, Firebase, canais externos ou comportamento de producao.

## Escopo avaliado

- Formulario principal de entradas e saidas em `src/legacy/inline/part-03.js`.
- Gateway de comandos em `src/application/gateway/ApplicationCommandGateway.js`.
- Registro de handlers em `src/application/gateway/financeCommandHandlers.js`.
- Use cases financeiros em `src/application/useCases/financeRecordUseCases.js`.
- Servico legado de mutacoes em `src/services/financeRecordMutations.js`.
- Politica de tentativa e reconciliacao pos-commit em `src/application/resilience`.

## Estado atual do CRUD

O gateway de aplicacao ja possui comandos para o CRUD financeiro principal:

- `CreateExpenseCommand`
- `UpdateExpenseCommand`
- `MarkExpenseAsPaidCommand`
- `ArchiveExpenseCommand`
- `DeleteExpenseCommand`
- `CreateIncomeCommand`

O formulario legado ja usa parcialmente o gateway para `CreateExpenseCommand` e `CreateIncomeCommand` quando existe contexto de autenticacao web. Em ambiente local sem usuario autenticado, ele preserva fallback para `financeRecordMutations` para manter smoke e testes locais sem escrita em Firebase real.

As demais operacoes principais ainda estao presas ao legado:

- Edicao de saida usa `financeRecordMutations.updateRecord`.
- Edicao de entrada usa `financeRecordMutations.updateRecord`.
- Marcacao de parcela/lancamento como pago usa `financeRecordMutations.buildPaidToggleRecord` e `updateRecord`.
- Arquivar/reabrir lancamento usa `financeRecordMutations.buildArchiveToggleRecord` e `updateRecord`.
- Excluir lancamento usa `financeRecordMutations.deleteRecord`.

## Acoplamentos legados relevantes

`src/legacy/inline/part-03.js` ainda concentra:

- leitura e validacao do formulario principal;
- controle visual de botao em salvamento;
- abertura e fechamento de overlays;
- estado de edicao por `editingRecordId`;
- refresh de detalhes do dashboard apos mutacoes;
- handlers exportados em `window`;
- fallback local para massa de teste sem autenticacao;
- chamadas diretas a `financeRecordMutations`;
- trechos residuais com `window.dataSdk` fora do CRUD principal.

Por isso, remover `part-03.js` da lista de classic scripts nesta etapa nao e seguro. O arquivo permanece como casca de compatibilidade e orquestracao de UI ate que seus consumidores sejam migrados por fatias menores.

## Fronteira segura proposta

A migracao deve inserir uma camada modular pequena entre o handler legado e o gateway:

- controllers ES Modules recebem dependencias por injecao;
- controllers montam envelopes canonicos para o gateway;
- controllers nao acessam `window`, Firebase, `dataSdk` ou globais modernos;
- presenter traduz `ApplicationResult`, `ApplicationError`, `AsyncViewState` e `MutationOutcomeState` em feedback de UI;
- attempt store guarda somente metadados seguros de tentativa, sem payload bruto, token, telefone ou fila offline;
- adapter browser pode ler `window.financeApp` e expor a bridge dentro de `window.financeApp.financialCrud`, sem criar nova global de topo.

## Riscos de regressao

- Duplicidade em `CreateExpenseCommand` e `CreateIncomeCommand` se a tentativa idempotente for descartada em estado incerto.
- Limpeza indevida do formulario quando `mutationOutcome=uncertain`.
- Mudanca de regra em parcelamento e recorrencia se essas rotas forem misturadas ao CRUD simples.
- Perda do refresh do detalhe do dashboard apos editar, pagar, arquivar ou excluir.
- Quebra de smoke local se o fallback sem usuario autenticado for removido.
- Aumento de globais ou classic scripts caso a bridge seja criada fora de `financeApp`.

## Sequencia segura de migracao

1. Criar controllers ES Modules para `CreateExpense`, `UpdateExpense`, `MarkExpenseAsPaid`, `ArchiveExpense`, `DeleteExpense` e `CreateIncome`.
2. Criar presenter e attempt store modulares sem acesso direto a `window`.
3. Instalar adapter browser dentro de `window.financeApp.financialCrud`.
4. Substituir chamadas diretas do CRUD principal em `part-03.js` pela bridge modular, mantendo fallback legado quando nao houver gateway/autenticacao local.
5. Preservar parcelamento, recorrencia e rotas auxiliares no legado nesta etapa.
6. Adicionar testes estruturais para garantir que controllers nao dependem de Firebase, `dataSdk`, `window.financeApp` ou calculos fiscais.
7. Executar inventario, testes, build, smoke, Playwright e scripts de auditoria antes do commit local.

## Cenario sobre remocao de scripts classicos

Cenario adotado nesta etapa: manter `part-03.js` em `src/legacy/classicScripts.js`.

Justificativa: o arquivo ainda contem handlers, renderizacao, estado de UI e bridges globais consumidas por HTML, testes locais e scripts legados. A extracao segura deve acontecer por funcoes isoladas, com testes de regressao especificos e bridge global preservada enquanto houver consumo legado.
