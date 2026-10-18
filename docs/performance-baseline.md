# Baseline de Performance

Executado em: 23/08/2026

## Antes

- Build Vite: 1883 modulos, 9.38s.
- `app-D2LhTU4Z.js`: 395.85 KiB, gzip 94.25 KiB.
- `services-firebase-BvuUWQ9q.js`: 541.25 KiB, gzip 128.80 KiB.
- `part-03-DAV_pM5M.js`: 336.31 KiB, gzip 60.11 KiB.
- `vendor-chart-CieodS8Z.js`: 207.44 KiB, gzip 71.21 KiB.
- Firebase em bootstrap: sim.
- Scripts classicos: 33.
- Scripts executados por eval no loader legado: 33.

## Depois

- Build Vite: 1886 modulos, 6.04s.
- `app-CjhsfRZw.js`: 426230 bytes, gzip 102.74 KiB.
- `services-firebase-CKXkwsgm.js`: 167138 bytes, gzip 34.15 KiB.
- `services-firestore-BWq7wxDa.js`: 449417 bytes, gzip 111.51 KiB.
- `part-03-DAV_pM5M.js`: 336.31 KiB, gzip 60.11 KiB.
- `vendor-chart-CieodS8Z.js`: 207.44 KiB, gzip 71.21 KiB.
- Firebase em bootstrap: nao.
- Bootstrap final: app, CSS, chart e icons.
- Firestore separado em chunk lazy proprio.
- Scripts classicos: 33.
- Scripts executados por eval no loader legado: 33.

## Benchmarks locais

- Dashboard 100 registros: 0.134ms.
- Dashboard 1.000 registros: 0.296ms.
- Dashboard 5.000 registros: 0.246ms.
- Dashboard 10.000 registros: 0.777ms.
- Importacao 100 linhas: 50.860ms, 100 linhas prontas.
- Importacao 1.000 linhas: 160.696ms, 1.000 linhas prontas.
- Backup 100 registros: 32.187ms.
- Backup 1.000 registros: 50.539ms.
- Backup 5.000 registros: 157.897ms.

Todos os benchmarks usaram massa sintetica local e `wrote=false`.

## Correcao de performance e Firestore

Executado em: 23/08/2026

- Bootstrap localhost: mediana 402.955ms em `npm run bootstrap:benchmark`.
- Dashboard 100 registros: 0.183ms, `firstPageUsedForKpi=false`.
- Dashboard 1.000 registros: 0.377ms, `firstPageUsedForKpi=false`.
- Dashboard 5.000 registros: 1.369ms, `firstPageUsedForKpi=false`.
- Dashboard 10.000 registros: 1.950ms, `firstPageUsedForKpi=false`.
- Importacao 100 linhas: 17.068ms, `wrote=false`.
- Importacao 1.000 linhas: 71.094ms, `wrote=false`.
- Backup 100 registros: 17.637ms, `wrote=false`.
- Backup 1.000 registros: 33.338ms, `wrote=false`.
- Backup 5.000 registros: 124.035ms, `wrote=false`.
- Firestore Emulator: `audit_logs`, `idempotency_receipts` e `users` retornaram 50/50/50 nas paginas 1, 2 e 10, com fonte `firestore` e cursor opaco.

Detalhes comparativos: `docs/performance-before-after.md`.
