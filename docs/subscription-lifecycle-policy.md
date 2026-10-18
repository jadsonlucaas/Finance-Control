# Politica de Ciclo de Vida de Subscriptions

Executado em: 23/08/2026

## Regras

- Toda subscription deve retornar uma funcao `unsubscribe`.
- Troca de usuario deve cancelar listeners do owner anterior antes de abrir novos listeners.
- Listeners nao devem entregar dados de outro `ownerUid`.
- Adapters devem manter contagem ou registro de listeners ativos em testes.
- Falha de unsubscribe nao deve bloquear logout, mas deve ser observavel.

## Cobertura atual

- `InMemoryFinanceRecordSubscriptionRepository.activeCount()` permite validar vazamento local.
- `unsubscribeAll(predicate)` encerra listeners por predicado, incluindo owner.
- Testes unitarios cobrem encerramento individual, encerramento por owner e isolamento.

## Firebase

No Firebase Web real, a garantia depende da funcao `unsubscribe` retornada pelo SDK/facade. Testes com emulator devem validar troca de usuario com listeners ativos antes de habilitar refatoracoes maiores.

## Evidencia corretiva - 23/08/2026

`tests/application/performance/subscriptionLifecycleRuntime.test.js` valida a composicao web lazy com adapter Firebase instrumentado:

- owner A abre 1 listener;
- unsubscribe do owner A reduz a contagem para 0;
- owner B abre 1 listener independente;
- unsubscribe final reduz a contagem para 0;
- dados entregues pelo listener seguem o `ownerUid` do contexto ativo.

A prova ainda usa SDK falso local. Ela cobre o contrato runtime do adapter sem tocar Firebase real. Uma etapa futura pode repetir o mesmo fluxo contra Firestore Emulator com `onSnapshot` real antes de migracoes maiores de listener.

## Atualizacao Dashboard/read models - 02/09/2026

`src/ui/dashboard/dashboardController.js` expoe `subscribe()`, `destroy()` e `getSubscriptionCount()` para lifecycle explicito. Testes locais validam que re-render/filtro reutiliza o fluxo de leitura e que `destroy()` executa os unsubscribes registrados. A integracao com listeners reais do Dashboard legado permanece condicionada a etapa futura com Firestore Emulator.

## Atualizacao Configuracoes - 04/09/2026

A UI moderna de Configuracoes nao cria subscription em tempo real nesta etapa. O lazy loader instala a bridge uma vez, preserva os nomes globais existentes e reaproveita o controller entre renderizacoes.

Se Configuracoes passar a usar listeners reais no futuro, a etapa deve adicionar `unsubscribe` por owner e teste com Firestore Emulator antes de remover qualquer fallback legado.
