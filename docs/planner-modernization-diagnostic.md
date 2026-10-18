# Diagnostico de modernizacao do Planner

Data: 03/09/2026

## Escopo analisado

Este diagnostico registra o estado atual do Planner antes de qualquer alteracao de codigo da modernizacao incremental. A analise cobriu os scripts legados, bridges globais, eventos de UI, caches locais, contratos de parcelamentos/recorrencias e politicas ja documentadas do projeto.

Arquivos principais:

- `src/legacy/inline/part-26.js`
- `src/legacy/inline/part-27.js`
- `src/ui/legacy-events.js`
- `src/ui/templates/views/viewDashboardTemplate.js`
- `src/ui/dashboard/dashboardData.js`
- `src/application/useCases/financeRecordUseCases.js`
- `src/application/gateway/financeCommandHandlers.js`
- `docs/installment-policy.md`
- `docs/recurrence-policy.md`
- `docs/global-api-inventory.md`
- `docs/legacy-module-migration-roadmap.md`

## Funcionamento atual

O Planner atual e implementado majoritariamente em `src/legacy/inline/part-26.js`. Ele cria e renderiza o modal `#planner-modal`, monta o calendario mensal, permite cadastrar eventos locais de feriado ou compromisso, seleciona dias, navega entre meses e exclui eventos cadastrados no proprio Planner.

Os eventos manuais legados eram persistidos em `localStorage` pela chave global `finance-control-planner-events-v1`. O mesmo salvamento derivava feriados personalizados para `finance-control-custom-holidays-v1`, mantendo compatibilidade com o fluxo de DSR. Essas chaves nao carregam owner e foram classificadas como legado nao atribuido.

A fronteira moderna passa a usar chaves V2 por owner: `finance-control-planner-events-v2:{ownerHash}` e `finance-control-custom-holidays-v2:{ownerHash}`. O legado de `part-26.js` consulta `window.financeApp.plannerStorage` quando disponivel, preservando as bridges antigas sem escrever automaticamente em V1 no fluxo autenticado.

O Planner tambem exibe eventos derivados de registros de controle de horas presentes em `allRecords`, usando `type === "controle_horas"` e `occurred_date` dentro do mes selecionado. Esses eventos derivados nao sao gravados novamente pelo Planner e nao podem ser excluidos pelo botao de exclusao do modal.

## Fontes de dados

Fontes lidas atualmente:

- `localStorage["finance-control-planner-events-v2:{ownerHash}"]`: eventos manuais do Planner por owner.
- `localStorage["finance-control-custom-holidays-v2:{ownerHash}"]`: feriados customizados por owner, usados pelo DSR.
- `localStorage["finance-control-planner-events-v1"]`: legado nao atribuido, somente diagnostico/fallback.
- `localStorage["finance-control-custom-holidays-v1"]`: legado nao atribuido, somente diagnostico/fallback.
- `allRecords`: usado para derivar eventos de controle de horas.
- Campos de formulario do modal: `#planner-month`, `#planner-date`, `#planner-type`, `#planner-title`, `#planner-note`.

Fontes que nao sao lidas diretamente pelo Planner atual:

- Firebase/Firestore.
- `dataSdk`.
- repositorios modernos.
- casos de uso de parcelamento.
- casos de uso de recorrencia.
- gateway de comandos moderno.

## Persistencia e mutacoes

Mutacoes atuais do Planner:

- `savePlannerEvent()` grava eventos manuais no `localStorage` V2 escopado por owner.
- `deletePlannerEvent(id)` remove eventos manuais do owner atual.
- `savePlannerEvents(events)` atualiza tambem a lista V2 de feriados personalizados do mesmo owner.

Nao ha escrita em Firebase, Firestore, `dataSdk` ou repositorios modernos no fluxo atual do Planner.

O render (`renderPlannerModal`) apenas le dados e atualiza DOM. Ele nao persiste dados.

## Identificacao de registros

Eventos manuais recebem ids no formato `planner-${Date.now()}-${random}`.

Eventos derivados de controle de horas recebem ids no formato `planner-hour-${record.id || person-date}` e guardam `source_record_id` quando ha id no registro original.

A selecao visual atual e baseada na data selecionada. A exclusao usa o id real do evento local. Nao ha edicao por combinacao de descricao, data e valor.

## Agrupamentos e filtros

Agrupamento atual:

- calendario mensal;
- eventos agrupados por dia;
- detalhes do dia selecionado;
- resumo do mes quando nenhum dia esta selecionado.

Filtros atuais:

- mes por `YYYY-MM`;
- data selecionada por `YYYY-MM-DD`;
- controle de horas arquivado e ignorado quando `archived` e verdadeiro.

Nao existem filtros ativos por pessoa, tipo financeiro, status, macro, categoria ou visualizacao semanal no Planner atual.

## Parcelamentos e recorrencias

O Planner atual nao recalcula parcelamentos nem recorrencias.

As regras versionadas de parcelamentos permanecem sob responsabilidade dos casos de uso documentados em `docs/installment-policy.md`, especialmente `CreateInstallmentSeries`.

As regras versionadas de recorrencias permanecem sob responsabilidade dos casos de uso documentados em `docs/recurrence-policy.md`, especialmente `CreateRecurrenceSeries`.

Qualquer modernizacao do Planner deve apenas ler registros ja persistidos, sem gerar novas parcelas, sem recalcular residuos e sem duplicar formulas de recorrencia.

## APIs globais e consumidores

Funcoes globais/classicas usadas pelo Planner:

- `openPlannerModal`
- `closePlannerModal`
- `renderPlannerModal`
- `savePlannerEvent`
- `deletePlannerEvent`
- `shiftPlannerMonth`
- `selectPlannerDate`

Consumidores conhecidos:

- `src/ui/templates/views/viewDashboardTemplate.js`: botao `#btn-planner`.
- `src/ui/legacy-events.js`: handlers delegados para abrir modal, trocar mes, selecionar dia e excluir evento.
- `src/legacy/inline/part-19.js` e `src/legacy/inline/part-20.js`: chamam `renderPlannerModal()` se o modal existir.
- `src/legacy/inline/part-27.js`: usa eventos do Planner como parte da composicao de feriados.

As funcoes do Planner nao aparecem como itens separados no inventario atual de APIs globais, mas continuam acessiveis por declaracoes classicas carregadas pelo legacy loader. A modernizacao deve preservar esses nomes ate todos os consumidores legados serem migrados.

## Riscos de regressao

- Perder compatibilidade com o modal existente e seus handlers delegados.
- Quebrar a integracao entre eventos de feriado do Planner e calculo de DSR.
- Reatribuir dados V1 globais para um owner errado.
- Vazar eventos locais ou feriados customizados entre usuarios no mesmo navegador.
- Misturar eventos manuais locais com registros financeiros persistidos sem identificacao clara.
- Introduzir escrita em Firebase/Firestore a partir do Planner.
- Recalcular parcelamentos ou recorrencias fora dos casos de uso autorizados.
- Aumentar o bundle inicial acima do orcamento vigente.
- Criar novas APIs globais sem bridge e sem inventario.
- Excluir `part-26.js` ou `part-27.js` antes de migrar todos os consumidores.
- Tratar itens sem id persistido como registros editaveis.
- Usar combinacao de descricao/data/valor para localizar detalhes em vez de ids reais.

## Sequencia segura

1. Criar seletores e read model puros para transformar eventos do Planner, registros financeiros persistidos e controle de horas em um modelo unico de leitura.
2. Criar controller/presenter modernos consumindo o read model, mantendo os nomes globais existentes como bridge.
3. Carregar a UI moderna do Planner de forma lazy para proteger o bundle inicial.
4. Delegar qualquer mutacao financeira para a interface injetada pela composicao da aplicacao.
5. Manter gravacao local apenas para eventos manuais do Planner enquanto nao houver um caso de uso dedicado, sempre por owner.
6. Preservar `part-26.js` e `part-27.js` ate que DSR, feriados e consumidores legados estejam cobertos por testes especificos.
7. Validar com testes unitarios, Playwright local, smoke, inventario de globais e auditorias de bundle.

## Decisao de fronteira

O Planner modernizado deve ser um read model de interface, nao um novo motor financeiro. Ele pode organizar e apresentar registros persistidos por periodo, pessoa, status, tipo, macro e categoria, mas nao deve criar regras financeiras paralelas nem recalcular parcelas, recorrencias, impostos, controle de horas ou percentuais.
