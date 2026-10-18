# Politica de Cache e Invalidacao

Executado em: 23/08/2026

## Escopo

O cache legado de registros permanece compatibilizado por `allRecords`, `__financeDataVersion` e caches de dashboard. Esta etapa nao mudou regras financeiras nem formato persistido.

## Regras

- Cache em memoria deve ser sempre escopado por `ownerUid`.
- Troca de usuario invalida dados, filtros dependentes de owner e listeners ativos.
- Escritas locais devem atualizar ou invalidar agregacoes derivadas antes de nova renderizacao.
- Importacao, backup, restore e materializacao percentual devem operar por repositorios e contexto, nao por cache global como fonte autoritativa.
- Dados restaurados/importados devem carregar `correlation_id` para invalidacao e auditoria.

## Risco legado

Enquanto `allRecords` continuar global, qualquer migracao de tela deve preservar limpeza na troca de usuario e cobrir regressao local contra vazamento entre owners.

## Atualizacao Planner local - 04/09/2026

Eventos manuais do Planner e feriados customizados deixam de usar as chaves V1 globais no fluxo autenticado. As novas chaves V2 sao derivadas de `ownerUid` e a troca/logout de usuario deve resetar a visualizacao do Planner antes de nova leitura. As chaves V1 permanecem apenas como legado nao atribuido e nao podem ser assumidas como pertencentes ao usuario atual.

## Atualizacao Dashboard/read models - 02/09/2026

O read model puro nao mantem cache interno. O adapter legado `src/ui/dashboard/dashboardData.js` preserva cache por assinatura com `__financeDataVersion`, filtros, meses, regras percentuais e configuracoes locais. A troca de owner continua dependendo da invalidacao existente de `allRecords`/`__financeDataVersion`; os read models de Saidas e Entradas assumem dataset ja escopado pelo chamador e os testes cobrem isolamento quando a fonte fornece registros por owner.

## Atualizacao Configuracoes - 04/09/2026

`settingsReadModel` nao mantem cache interno. A UI ativa de Configuracoes sempre le a fonte injetada quando `renderConfiguracoes` e chamado e filtra referencias pessoais por owner no read model.

Enquanto `allRecords` permanecer como cache global legado, a composicao web deve continuar atualizando `__financeDataVersion` e limpando dados na troca/logout de usuario. Testes Playwright locais cobrem a troca de owner no mesmo navegador para impedir vazamento de referencias pessoais entre usuarios.
