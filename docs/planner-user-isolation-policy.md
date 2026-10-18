# Politica de isolamento de usuario do Planner

Data: 04/09/2026

## Eventos manuais do Planner

Eventos manuais do Planner sao pessoais por owner.

Novos eventos devem ser gravados somente em storage V2 escopado por owner. Leitura, escrita, remocao, substituicao e limpeza exigem `ownerUid` valido.

## Feriados personalizados

Feriados personalizados derivados de eventos manuais do Planner tambem sao pessoais por owner.

Nao ha regra documentada tornando esses feriados referencia global compartilhada. Como o comportamento atual deriva feriados dos eventos pessoais do Planner, a politica correta e escopo pessoal.

Feriados nacionais fixos continuam globais por calendario, pois nao sao dados do usuario.

## Chaves V2

Formato fisico:

- `finance-control-planner-events-v2:{ownerUidHash}`
- `finance-control-custom-holidays-v2:{ownerUidHash}`

O hash do owner deve ser deterministico, estavel e nao deve expor email, telefone ou owner UID cru na chave.

## Chaves V1

Chaves V1 sao legado global nao atribuido:

- `finance-control-planner-events-v1`
- `finance-control-custom-holidays-v1`

Regras:

- nao migrar automaticamente;
- nao atribuir V1 ao usuario atual;
- nao excluir V1 automaticamente;
- novos writes nao usam V1;
- uma importacao futura deve ser explicita, auditavel e reversivel.

## Troca de usuario

Ao trocar owner autenticado:

- o Planner deve descartar modelo e data selecionada em memoria;
- a proxima abertura/renderizacao deve ler apenas V2 do owner atual;
- nenhum item do owner anterior pode permanecer visivel;
- logout deve fechar/limpar o estado visual do Planner.

## DSR

A regra de DSR nao muda.

A fonte de feriados customizados muda apenas de storage global V1 para storage V2 escopado por owner quando houver owner atual. O motor/caminho de calculo de DSR nao deve ser reimplementado no Planner.

## Dependencias do Planner moderno

O Planner moderno deve receber dependencias por composition root/injecao:

- store de eventos locais;
- store de feriados customizados;
- provider de owner atual;
- acoes financeiras explicitas.

O controller moderno nao deve depender diretamente de `window.financeApp.financialCrud`, `window.dataSdk` ou Firebase.

## Bridges

As bridges globais legadas do Planner podem permanecer:

- `openPlannerModal`
- `closePlannerModal`
- `renderPlannerModal`
- `savePlannerEvent`
- `deletePlannerEvent`
- `shiftPlannerMonth`
- `selectPlannerDate`

Elas devem apenas delegar para a implementacao moderna e nao podem bypassar o store owner-scoped.
