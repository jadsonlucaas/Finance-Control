# Verificacao de Paginacao Firestore

Executado em: 23/08/2026

Esta verificacao corrige a ressalva da etapa de performance: listagens historicas persistidas nao devem usar `getAll -> slice` quando ha acesso direto ao Firestore. A validacao foi feita apenas em localhost com Firestore Emulator e massa sintetica.

## Resultado por repositorio

| Area | Colecao / origem | Antes | Depois | Evidencia local | Observacao |
| --- | --- | --- | --- | --- | --- |
| Auditoria operacional | `users/{uid}/audit_logs` | Facade `auditSdk.list` podia retornar tudo e paginar em memoria | `FirebaseAuditRepository.list` usa `query`, `where`, `orderBy`, `startAfter` e `limit` quando `db` existe | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` | Fallback legado continua somente para facade sem `db` |
| Recibos de idempotencia | `users/{uid}/idempotency_receipts` | Nao havia listagem paginada Firestore | `FirebaseWebIdempotencyRepository.list` usa `query`, filtros, `orderBy`, `startAfter` e `limit` | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` | Usado para historico operacional, nao para calculo financeiro |
| Administracao de usuarios | `users` | `userAdminSdk.listUsers` podia retornar tudo e paginar em memoria | `FirebaseUserProfileRepository.listUsers` usa `query`, `orderBy`, `startAfter` e `limit` quando `db` existe | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` | A autorizacao continua protegida por contexto e Rules |
| Import batches | Nao persistido como colecao propria nesta arquitetura | Nao aplicavel | Nao aplicavel | `docs/import-batch-contract.md` e `docs/firestore-data-model.md` | Lotes existem como contrato de aplicacao e receipts, nao como `import_batches` persistido |
| Registros financeiros usados por dashboard | `users/{uid}/finance_records` / cache local do owner | Leitura completa do owner para telas agregadas | Mantido completo para KPIs e totais | `tests/application/performance/dashboardDatasetIntegrity.test.js` | Paginar o universo de KPI alteraria totais e percentuais |
| Registros financeiros historicos | `FinanceRecordRepository.list` | Repositorio web ainda depende da facade/cache existente | Sem correcao nesta fase | `docs/firestore-query-index-plan.md` | Exige migracao de facade ou query nativa coberta por Emulator antes de uso produtivo |

## Evidencia de pagina

`npx firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"`:

| Lista | Page 1 | Page 2 | Page 10 | Fonte | Cursor |
| --- | ---: | ---: | ---: | --- | --- |
| `audit_logs` | 50 | 50 | 50 | `firestore` | Opaco |
| `idempotency_receipts` | 50 | 50 | 50 | `firestore` | Opaco |
| `users` | 50 | 50 | 50 | `firestore` | Opaco |

O cursor e serializado em Base64URL com valores minimos de ordenacao. Ele nao expõe `DocumentSnapshot`, paths internos, uid do owner ou ids de documentos.

## Itens nao corrigidos por design

- Dashboard e KPIs: continuam usando dataset completo do periodo/owner para nao distorcer totais, medias, percentuais e graficos.
- Facades legadas sem `db`: mantem fallback local para compatibilidade ate migracao segura.
- `import_batches`: nao existe colecao persistida atual; a rastreabilidade de importacao fica em receipts de idempotencia e auditoria.
