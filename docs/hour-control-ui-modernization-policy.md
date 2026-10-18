# Politica de Modernizacao da UI de Controle de Horas

Executado em: 02/09/2026

## Fronteira criada

A nova camada de leitura do Controle de Horas fica em `src/application/readModels/hourControlReadModel.js` e `src/application/selectors/hourControlFilters.js`. Esses modulos recebem dados ja autorizados/escopados pelo chamador e devolvem entradas normalizadas, resumo, banco de horas, totais mensais, salario vigente e metadados sem acessar DOM, `window`, `dataSdk`, Firebase ou canais externos.

`src/ui/hours/hourControlController.js` e `src/ui/hours/hourControlPresenter.js` formam uma pista moderna de UI com dependencias injetadas. O controller carrega dados por `readSource`, usa `AsyncViewState`, gerencia subscriptions e delega criacao/edicao para `ApplicationCommandGateway` por `CreateHourEntryCommand` e `UpdateHourEntryCommand`.

## Regras preservadas

- Calculo de jornada, hora extra e banco de horas permanece em `CalculateWorkSession` e use cases canonicos.
- Resolucao de salario vigente permanece em `ResolveEffectiveSalary`.
- Resumo agregado permanece em `buildHourPeriodSummary`.
- A UI moderna nao calcula DSR nem recria formulas tributarias ou financeiras.
- `source_channel` nao participa de calculo, filtro financeiro ou autorizacao visual.

## Legado mantido

O script `src/legacy/inline/part-06.js` continua carregado porque ainda contem formulario real, handlers globais, persistencia classica e criacao de entrada derivada de hora extra. Nenhuma bridge global foi removida nesta etapa.

## Interface ativa

`src/ui/hours/hourControlActiveUi.js` e carregado sob demanda por `bootstrapApp()` quando o usuario navega para Controle de Horas. O bootstrap instala apenas o lazy loader leve; o chunk ativo substitui as bridges existentes `renderControleHoras`, `openHourControlModal`, `closeHourControlModal`, `openEditHourControlRecord`, `handleHourControlTypeChange`, `updateHourControlCalculatedFields` e `saveHourControlRecord` por adapters modernos, sem adicionar nova API global de topo.

A renderizacao ativa usa `hourControlController.load()`, `hourControlReadModel` e `hourControlPresenter`. Criacao e edicao usam `CreateHourEntryCommand` e `UpdateHourEntryCommand` pelo `ApplicationCommandGateway`. A UI ativa nao chama Firebase direto nem `window.dataSdk.create/update`; nos testes locais, idempotencia e dados sao mocks em memoria.

Os scripts `part-06.js`, `part-17.js`, `part-18.js`, `part-19.js`, `part-20.js` e `part-29.js` continuam no loader porque ainda existem consumidores legados e comportamentos de compatibilidade nao migrados nesta fatia. Remover qualquer um deles exige teste especifico de consumidores, detalhe/exclusao, entrada financeira derivada, cache global e smoke completo.

O lazy load e idempotente: navegar varias vezes para a aba reutiliza a mesma promise/instalacao, nao duplica handlers e normaliza falha como `LAZY_LOAD_FAILED` pela infraestrutura de resiliencia. Em falha de chunk, a shell continua utilizavel e uma nova navegacao tenta carregar novamente.

## Guardrails

`npm run hour-control-modernization:check` valida que os modulos modernos nao acessam Firebase direto, `dataSdk`, DOM, globais ou formulas de calculo na UI. Os limites permanecem:

- APIs globais inventariadas: ate 50.
- scripts classicos/eval: ate 33.
- novas APIs globais de topo: 0.

## Proximos passos seguros

Qualquer remocao de script classico ou consolidacao final deve vir depois de testes especificos cobrindo entrada financeira derivada de hora extra, preview de DSR, fechamento de modal, detalhe/exclusao, cache global e consumidores das bridges `renderControleHoras`, `openHourControlModal`, `closeHourControlModal` e `saveHourControlRecord`.
