# Plano de Consultas e Indices Firestore

Executado em: 23/08/2026

Esta etapa adicionou contrato de paginacao em repositorios, mas nao criou indice, regra, migracao ou consulta real em Firebase de producao.

## Contrato local

- `limit`: padrao 50, maximo 200.
- `cursor`: token opaco gerado pelo repositorio.
- `hasMore`: indica proxima pagina.
- `nextCursor`: cursor da pagina seguinte.
- `totalKnown`: total conhecido quando o adapter consegue calcular localmente.

## Indices futuros sugeridos

- `users/{uid}/finance_records`: `type`, `competence`, `created_at desc`.
- `users/{uid}/finance_records`: `competence`, `person`, `created_at desc`.
- `users/{uid}/finance_records`: `source_channel`, `source_reference_id`, `created_at desc`.
- `users/{uid}/audit_logs`: `correlation_id`, `created_at desc`.
- `users/{uid}/audit_logs`: `entity_type`, `entity_id`, `created_at desc`.
- `users/{uid}/audit_logs`: `source_channel`, `created_at desc`.
- `users/{uid}/security_events`: `created_at desc`.
- `users`: `status`, `created_at desc`.

## Lacuna consciente

O adapter Firebase Web ainda pagina sobre resultado retornado pela facade disponivel quando nao ha query nativa exposta. A evolucao segura e adicionar suporte nativo a `query`, `orderBy`, `limit` e `startAfter` na facade Firebase ou em backend futuro, coberto por emulator antes de producao.

## Correcao de verificacao - 23/08/2026

A ressalva acima foi reduzida para os repositorios historicos com acesso direto a `db`:

- `users/{uid}/audit_logs`: `FirebaseAuditRepository.list` usa `where`, `orderBy`, `startAfter` e `limit` no Firestore.
- `users/{uid}/idempotency_receipts`: `FirebaseWebIdempotencyRepository.list` usa `where`, `orderBy`, `startAfter` e `limit` no Firestore.
- `users`: `FirebaseUserProfileRepository.listUsers` usa `orderBy`, `startAfter` e `limit` no Firestore.

O fallback por facade continua documentado somente para compatibilidade quando `db` nao esta disponivel. A tabela completa de decisoes e lacunas esta em `docs/firestore-pagination-verification.md`.

`import_batches` nao foi incluido porque nao existe como colecao persistida nesta arquitetura; importacoes persistem registros financeiros, receipts de idempotencia e auditoria.

## Queries validadas no Emulator

| Colecao | Query validada | Comando |
| --- | --- | --- |
| `users/{uid}/audit_logs` | filtros opcionais + `orderBy(created_at)` + `orderBy(documentId())` + `startAfter` + `limit(50)` | `npx firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"` |
| `users/{uid}/idempotency_receipts` | filtros opcionais + `orderBy(created_at)` + `orderBy(documentId())` + `startAfter` + `limit(50)` | `npx firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"` |
| `users` | `orderBy(created_at)` + `orderBy(documentId())` + `startAfter` + `limit(50)` | `npx firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"` |

## Administracao de Usuarios - 05/09/2026

Queries administrativas atuais da colecao `users` usam `email asc` como ordenacao canonica e `documentId()` como tie-breaker estavel. A UI moderna chama `listUsers({ pageSize, cursor, filters })`; `listUsers()` sem argumentos permanece apenas como compatibilidade legada.

| Colecao | Fields do indice | Consumer | Motivo | Status local |
| --- | --- | --- | --- | --- |
| `users` | `status ASC`, `email ASC` | Painel admin moderno | Filtro server-side por status com ordenacao por email | Declarado em `firestore.indexes.json`; validado por Emulator |
| `users` | `role ASC`, `email ASC` | Painel admin moderno | Filtro server-side por role com ordenacao por email | Declarado em `firestore.indexes.json`; validado por Emulator |
| `users` | `status ASC`, `role ASC`, `email ASC` | Painel admin moderno | Filtro combinado status + role com ordenacao por email | Declarado em `firestore.indexes.json`; validado por Emulator |

Busca textual por nome/email nao tem indice Firestore nesta fase e nao e tratada como busca global. O campo visual filtra somente a pagina carregada.
