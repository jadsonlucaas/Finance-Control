# Politica de Modernizacao do CRUD Financeiro

Data: 02/09/2026

## Regra principal

O CRUD financeiro principal deve chamar use cases por `ApplicationCommandGateway` sempre que houver contexto web autenticado. A UI legada pode manter fallback local apenas para smoke/testes sem usuario autenticado e enquanto `part-03.js` ainda for a casca de compatibilidade.

## Comandos cobertos

- `CreateExpenseCommand`
- `UpdateExpenseCommand`
- `MarkExpenseAsPaidCommand`
- `ArchiveExpenseCommand`
- `DeleteExpenseCommand`
- `CreateIncomeCommand`

## Fronteiras

- Controllers em `src/ui/records/*FormController.js` recebem gateway, auth context, presenter, attempt store e relogio por injecao.
- Controllers nao acessam `window`, Firebase, `dataSdk`, Admin SDK, telefone, WhatsApp ou provider externo.
- Controllers nao executam calculos de INSS, IRRF, liquido, hora extra, DSR, parcelamento ou recorrencia.
- O adapter browser instala a bridge em `window.financeApp.financialCrud`, sem criar nova API global de topo.
- `MutationAttemptStore` guarda somente metadados seguros de tentativa e fingerprint, nunca payload bruto.

## Estados de UI

- Sucesso confirmado limpa tentativa e permite limpar formulario.
- Resultado `uncertain` preserva tentativa e rascunho visual para reconciliacao/revisao antes de reenviar.
- Falha confirmada nao deve simular sucesso e nao deve tocar producao em teste local.

## Compatibilidade legada

`src/legacy/inline/part-03.js` permanece carregado via classic script nesta etapa. Ele ainda concentra handlers, renderizacao e refresh de detalhe do dashboard. A migracao deve continuar por fatias, com bridges preservadas enquanto houver consumo legado.

## Proibicoes

- Nao adicionar novo global de topo para CRUD financeiro.
- Nao mover regras fiscais, jornada, parcelamento ou recorrencia para controllers de formulario.
- Nao remover fallback local sem ajustar smoke e testes Playwright.
- Nao usar Firebase real, deploy, push, WhatsApp, telefone, provider externo ou Admin SDK nesta etapa.
