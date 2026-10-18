# Referencia das interfaces de repositorio

Todas as interfaces usam contexto explicito e retornam resultado normalizado por `repositoryResult.js`.

Codigos de erro:

- `REPOSITORY_NOT_FOUND`
- `REPOSITORY_PERMISSION_DENIED`
- `REPOSITORY_CONFLICT`
- `REPOSITORY_VALIDATION_ERROR`
- `REPOSITORY_UNAVAILABLE`
- `REPOSITORY_TIMEOUT`
- `REPOSITORY_UNKNOWN_ERROR`

## FinanceRecordRepository

- `create(record, context)`
- `createMany(records, context)`
- `getById(id, context)`
- `update(id, patch, context)`
- `delete(id, context)`
- `list(query, context)`
- `findByType(type, query, context)`
- `findByCompetence(competence, query, context)`
- `findBySeriesId(seriesId, context)`
- `findBySourceReference(sourceChannel, sourceReferenceId, context)`

## UserProfileRepository

- `getByUid(uid)`
- `ensureProfile(input)`
- `listUsers({ filters, pageSize, cursor, orderBy, direction }, adminContext)`
- `updateStatus(uid, transition, adminContext)`
- `updateRole(uid, role, adminContext)`

`listUsers` retorna `{ items, count, nextCursor, hasMore, pageInfo }`. `filters.status`, `filters.role` e a combinacao de ambos devem ser enviados ao backend/Firestore quando o adapter tiver `db`. `pageSize` usa padrao 50 e maximo 200. Cursor e opaco; UI/application nao recebem `DocumentSnapshot`.

Busca textual por nome/email nao faz parte do contrato server-side nesta fase. Quando existir na UI, deve ser declarada como filtro local sobre a pagina carregada, sem scan completo escondido.

## SharedReferenceRepository

- `listMacros(context)`
- `listCategories(context)`
- `createGlobalReference(input, adminContext)`
- `updateGlobalReference(id, patch, adminContext)`
- `deleteGlobalReference(id, adminContext)`
- `listEffectiveReferences(context)`

## LocalSettingsRepository

- `get(key, context)`
- `set(key, value, context)`
- `remove(key, context)`
- `list(prefix, context)`

`CreateFinanceBackupSnapshot` usa `list` para incluir configuracoes locais proprias no arquivo. `CommitFinanceRestore` nao grava `local_settings` como lancamentos financeiros; restore de configuracoes deve ser caso especifico futuro.

## AuditRepository

- `append(event, context)`
- `list(query, adminContext)`
- `getByCorrelationId(correlationId, context)`

## IdempotencyRepository

- `reserve(input, context)`
- `complete(reservationId, result, context)`
- `fail(reservationId, error, context)`
- `find(input, context)`
- `getById(id, context)`
- `cleanupExpired(context)`

Implementacoes atuais: `InMemoryIdempotencyRepository` para testes e `FirebaseWebIdempotencyRepository` para runtime web local. A reserva Firebase Web usa transacao e o owner vem do contexto autenticado.

## Importacoes

Os casos `PrepareImportBatch` e `CommitImportBatch` reutilizam:

- `FinanceRecordRepository.list` para detectar assinaturas legadas e `source_reference_id`;
- `FinanceRecordRepository.createMany` para persistir candidatos `ready` em lote;
- `IdempotencyRepository.find/reserve/complete/fail` para replays, conflitos e falhas;
- `AuditRepository.append` para `IMPORT_COMMITTED` e `IMPORT_FAILED`.

Nao ha interface de repositorio dedicada a `ImportBatch` nesta etapa.

## Materializacao Percentual

`FinanceRecordRepository` expoe `createIfAbsent(record, context)` para ocorrencias com ID deterministico. A operacao cria somente se o documento ainda nao existe; conflito por ID ou `percentage_occurrence_key` retorna `REPOSITORY_CONFLICT`, sem sobrescrever o registro.

`MaterializePercentageRulesForCompetence` usa `FinanceRecordRepository.list`, `FinanceRecordRepository.createIfAbsent`, `IdempotencyRepository.reserve/complete/fail` e `AuditRepository.append`. O adapter Firebase Web usa transacao client-side; um backend futuro pode fornecer adapter server-side equivalente sem alterar o caso de uso.

## Subscription

Leitura pontual e assinatura sao contratos separados. A assinatura usa:

- `subscribe(query, listener, context)`

O retorno e uma funcao `unsubscribe`. Listeners recebem objetos normalizados, nao snapshots Firebase crus. Troca de usuario deve cancelar subscriptions existentes.

`InMemoryFinanceRecordSubscriptionRepository` tambem expoe utilitarios locais de teste:

- `activeCount()`
- `unsubscribeAll(predicate)`

Esses utilitarios nao substituem o contrato publico de runtime; servem para detectar vazamento de listener e validar encerramento por owner.

## Paginacao

Repositorios que retornam listas podem devolver metadados de pagina:

- `items`
- `count`
- `nextCursor`
- `hasMore`
- `totalKnown`
- `pageInfo`

`limit` tem padrao 50 e maximo 200. `cursor` deve ser tratado como opaco por consumidores. Em memoria a paginacao e local; no Firebase Web atual, adapters aplicam a pagina quando a facade nao expoe query nativa. A evolucao para `orderBy`/`limit`/`startAfter` nativos esta documentada em `docs/firestore-query-index-plan.md`.

## Backend futuro

Um backend futuro podera fornecer outra implementacao das mesmas interfaces, inclusive usando Firebase Admin/API adapter server-side. Isso nao esta implementado agora. Nenhum telefone e necessario para executar comandos financeiros; a identidade externa futura deve ser resolvida para um `userUid` autorizado antes do gateway.
## Auditoria e rastreabilidade

`AuditRepository` e append-only. A interface minima agora cobre `append`, `list`, `getById`, `getByCorrelationId`, `listByCorrelationId`, `listByEntity`, `listByOwner` e `listSecurityEvents`. Implementacoes nao devem expor `update` ou `delete` para eventos de auditoria.

O adaptador em memoria aplica isolamento por `ownerUid` para usuarios comuns e libera consultas agregadas somente para contexto `role=admin`. O adaptador Firebase web preserva o contrato, mas consultas dependem de facade futura de leitura administrativa; quando ausente, retorna `UNAVAILABLE` em vez de consultar dados reais por atalho.

Ver tambem: `docs/audit-traceability-policy.md` e `docs/audit-event-reference.md`.

## Backup e Restore

Os use cases de backup/restore reutilizam interfaces existentes:

- `FinanceRecordRepository.list` para snapshot e comparacao do destino.
- `FinanceRecordRepository.createMany` para criar somente registros financeiros classificados como `new`.
- `FinanceRecordRepository.delete` apenas no rollback e somente para registros criados pela correlacao restaurada.
- `LocalSettingsRepository.list` para exportacao diagnostica de configuracoes locais.
- `IdempotencyRepository.reserve/complete/fail` para commit de restore idempotente.
- `AuditRepository.append` para eventos resumidos de backup, restore e rollback.

Nao existe repositorio `BackupRepository` nesta etapa e nenhum snapshot e persistido automaticamente em Firebase real.

## Erros e retry

Repositorios devem retornar ou lancar erros que possam ser normalizados por `normalizeRepositoryError`.

- `REPOSITORY_VALIDATION` mapeia para `VALIDATION_FAILED`.
- `REPOSITORY_FORBIDDEN` mapeia para `AUTHORIZATION_DENIED`.
- `REPOSITORY_NOT_FOUND` mapeia para `RESOURCE_NOT_FOUND`.
- `REPOSITORY_CONFLICT` mapeia para `CONFLICT_DETECTED`.
- `REPOSITORY_UNAVAILABLE` mapeia para `NETWORK_UNAVAILABLE`.
- `REPOSITORY_ERROR` mapeia para `PERSISTENCE_FAILED`.

Adapters Firebase devem deixar codigos originais apenas como `causeCode` sanitizado. UI e use cases nao devem depender de `FirebaseError` cru.
