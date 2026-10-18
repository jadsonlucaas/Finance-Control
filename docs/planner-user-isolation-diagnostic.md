# Diagnostico de isolamento de usuario do Planner

Data: 04/09/2026

## Escopo analisado

Arquivos analisados antes de qualquer alteracao de codigo nesta etapa:

- `src/legacy/inline/part-26.js`
- `src/legacy/inline/part-27.js`
- `src/legacy/inline/part-20.js`
- `src/legacy/inline/part-28.js`
- `src/ui/planner/plannerController.js`
- `src/ui/planner/plannerActiveUi.js`
- `src/legacy/storageSync.js`
- `src/application/dependencies/createApplicationDependencies.js`
- `docs/planner-modernization-diagnostic.md`
- `docs/planner-modernization-policy.md`
- `docs/cache-invalidation-policy.md`
- `docs/data-contract-policy.md`
- `docs/security-authorization-matrix.md`

## Estado atual V1

As chaves legadas atuais sao globais por navegador:

- `finance-control-planner-events-v1`
- `finance-control-custom-holidays-v1`

Elas nao incluem `owner_uid` na chave e os payloads existentes nao possuem dono obrigatorio.

## Quem grava eventos do Planner V1

- `src/legacy/inline/part-26.js`: `savePlannerEvents(events)` grava `finance-control-planner-events-v1`.
- `src/ui/planner/plannerController.js`: `writePlannerEvents(storage, events)` grava `finance-control-planner-events-v1`.

## Quem le eventos do Planner V1

- `src/legacy/inline/part-26.js`: `loadPlannerEvents()`.
- `src/legacy/inline/part-27.js`: `getHolidayDatesForCompetence()` le eventos do Planner para compor feriados de DSR.
- `src/ui/planner/plannerController.js`: `safeParseEvents(storage, PLANNER_EVENTS_STORAGE_KEY)`.
- `src/ui/dashboard/dashboardData.js`: inclui a chave na assinatura de cache do dashboard.

## Quem grava feriados customizados V1

- `src/legacy/inline/part-26.js`: `savePlannerEvents(events)` deriva feriados a partir de eventos do Planner.
- `src/ui/planner/plannerController.js`: `writePlannerEvents(storage, events)` deriva feriados a partir de eventos do Planner.

## Quem le feriados customizados V1

- `src/legacy/inline/part-20.js`: `getCustomHolidayDates()`.
- `src/legacy/inline/part-27.js`: via `getCustomHolidayDates()` e leitura direta de eventos do Planner.
- `src/ui/dashboard/dashboardData.js`: inclui a chave na assinatura de cache do dashboard.

## Owner e payload

Eventos V1 existentes nao exigem `owner_uid`. A UI moderna anterior tambem nao adicionava owner aos eventos salvos.

Como consequencia, nao existe criterio confiavel para atribuir dados V1 a um usuario autenticado especifico. Uma migracao automatica de V1 para qualquer owner criaria risco de apropriar dados do usuario errado no mesmo navegador.

## Troca de usuario e logout

O fluxo de autenticacao em `part-28.js` chama `clearFinancialUiState()` quando nao ha usuario ou quando o usuario nao tem acesso financeiro. Isso limpa estado financeiro geral, mas nao existia uma invalidacao explicita do estado interno do Planner moderno.

Como o Planner moderno mantinha `selectedDate` e `model` em memoria dentro do controller, uma troca de usuario com modal aberto poderia manter estado visual anterior ate uma nova carga/renderizacao.

## Risco no DSR

`part-27.js` compoe feriados usados no DSR lendo:

- feriados fixos nacionais;
- `getCustomHolidayDates()`;
- eventos V1 do Planner do tipo `holiday`.

Como V1 e global, um feriado cadastrado por user A poderia ser considerado na consulta/calculo de user B no mesmo navegador, caso ambos compartilhassem a mesma origem local.

Este diagnostico nao encontrou regra documentada definindo feriados customizados do Planner como referencia global compartilhada. Como eles sao derivados de eventos manuais do Planner, a politica segura e trata-los como dados pessoais por owner.

## Wrapper canonico existente

Existe infraestrutura de `local_storage` no Firestore e `localSettingsRepository`, mas o Planner atual usa `localStorage` diretamente. Nesta etapa, a correcao deve introduzir uma store local testavel e owner-scoped sem alterar Firebase Rules nem migrar dados reais.

## Compatibilidade com V1

Mudar a chave diretamente para V2 sem adaptador quebraria:

- DSR legado que ainda consulta V1;
- cache signature que observa as chaves antigas;
- eventos antigos sem owner.

A estrategia segura e:

- novos writes usam V2 owner-scoped;
- V1 nao e atribuido automaticamente a nenhum usuario;
- V1 permanece intocado;
- consumidores legados recebem bridges/adapters para consultar V2 com owner atual quando disponivel;
- migracao real fica para uma acao explicita futura.

## Conclusao

Foi encontrado risco real de vazamento local entre usuarios no mesmo navegador por causa de chaves V1 globais e ausencia de owner nos payloads. A correcao deve escopar eventos manuais e feriados customizados por owner, invalidar o estado visual do Planner na troca/logout e remover a dependencia direta do Planner moderno em `window.financeApp.financialCrud`.
