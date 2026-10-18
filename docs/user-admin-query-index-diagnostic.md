# Diagnostico de queries e indices da Administracao de Usuarios

Executado em: 2026-09-05

## Escopo

Esta etapa valida apenas consultas administrativas da colecao `users` no localhost e Firebase Emulator. Nenhum Firebase real, deploy, provider externo, Admin SDK, WhatsApp, webhook ou telefone foi usado.

## Queries reais

| Query | Filtros | OrderBy | Paginacao | Server-side real | Indice necessario | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Listagem admin padrao | nenhum | `email asc`, `__name__ asc` | `limit + 1`, `startAfter`, `nextCursor` | Sim | indice simples automatico de `email`; tie-break por documentId | Validada no Emulator |
| Listagem por status | `where status == valor` | `email asc`, `__name__ asc` | `limit + 1`, `startAfter`, `nextCursor` | Sim | `users`: `status asc`, `email asc` | Declarado em `firestore.indexes.json` |
| Listagem por role | `where role == valor` | `email asc`, `__name__ asc` | `limit + 1`, `startAfter`, `nextCursor` | Sim | `users`: `role asc`, `email asc` | Declarado em `firestore.indexes.json` |
| Listagem por status + role | `where status == valor`, `where role == valor` | `email asc`, `__name__ asc` | `limit + 1`, `startAfter`, `nextCursor` | Sim | `users`: `status asc`, `role asc`, `email asc` | Declarado em `firestore.indexes.json` |
| Busca por UID | lookup direto `users/{uid}` via `getProfile` | N/A | N/A | Sim, quando consumidor chama lookup direto | Nao exige composto | Existente |
| Busca textual nome/email substring | Nenhum filtro Firestore | Local sobre pagina carregada | Sobre itens carregados | Nao | Provider/backend/indice dedicado futuro | Nao suportada como busca global |

## Classificacao da busca atual

| Campo | Classificacao | Observacao |
| --- | --- | --- |
| `status` | A - filtro server-side exato | Usa `where('status', '==', valor)` |
| `role` | A - filtro server-side exato | Usa `where('role', '==', valor)` |
| `status + role` | A - filtros server-side exatos combinados | Exige indice composto declarado |
| `email` | B - filtro local sobre pagina atual | Nao e full-text; nao usa scan completo |
| `name` | B - filtro local sobre pagina atual | Nao e full-text; nao usa scan completo |
| `uid` | A para lookup exato quando usado por `getProfile` | A UI atual nao inventa busca dedicada por UID |

## Fallbacks

`userAdminSdk.listUsers()` sem argumentos permanece como compatibilidade legada e pode carregar todos os perfis. A UI moderna chama `listUsers({ pageSize, cursor, filters })`, portanto nao usa esse fallback para listagem paginada.

`FirebaseUserProfileRepository.listUsers` tambem usa query Firestore nativa quando `db` esta disponivel. O fallback em memoria/facade continua limitado a testes/compatibilidade e nao deve ser usado para mascarar ausencia de indice em runtime.

## Validacao local

- `npm run user-admin:query-check`: aprovado, `wrote=false`.
- `npx firebase emulators:exec --only firestore "npm run test:user-admin-queries"`: 3 testes aprovados com 1.000 perfis sinteticos.
- Paginas 1, 2 e 10 retornaram 50 itens sem repeticao.
- `pageSize=999` foi limitado para 200.
- Cursor e base64url opaco para consumidores, sem snapshots Firebase crus.

