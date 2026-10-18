# Evidencia de isolamento staging x producao

Executado em: 19/09/2026

## Identificadores

| Item | Producao conhecida | Staging real |
| --- | --- | --- |
| Project ID | `finance-control-cce4f` | `finance-control-staging-260919` |
| Project number | `1050867234579` | `945561850688` |
| Auth domain | `finance-control-cce4f.firebaseapp.com` | `finance-control-staging-260919.firebaseapp.com` |
| Storage bucket | `finance-control-cce4f.firebasestorage.app` | `finance-control-staging-260919.firebasestorage.app` |
| Web app ID | `1:1050867234579:web:616463d41775696dfc4ce6` | `1:945561850688:web:8a00895f04d01d5aa860a5` |
| Hosting URL | nao usada nesta etapa | `https://finance-control-staging-260919.web.app` |

Staging e producao sao projetos diferentes. O guard local `scripts/assert-staging-target.mjs` permite somente `finance-control-staging-260919` e recusa `finance-control-cce4f`, aliases ambiguos e alvo vazio.

## O que foi feito em Firebase real

- Criado/conectado projeto staging `finance-control-staging-260919`.
- Criado Web App staging `Finance Control Staging Web`.
- Consultada config publica do Web App staging.
- Consultado Hosting default staging.
- Habilitada API Cloud Firestore somente no staging.
- Criado Firestore Database `(default)` em `nam5`.
- Deployadas Firestore Rules e Firestore Indexes somente no staging.
- Publicado Hosting staging da aplicacao em `https://finance-control-staging-260919.web.app`.
- Executado teste Playwright nao destrutivo contra a URL real, confirmando runtime projectId `finance-control-staging-260919` e nenhum request para `finance-control-cce4f`.

## O que nao foi feito

- Nenhum deploy em producao.
- Nenhuma leitura ou escrita de dados de producao.
- Nenhuma criacao de dados sinteticos.
- Nenhum Auth user staging criado.
- Nenhum restore real.
- Nenhum push/pull/fetch Git.

## Bloqueio

Firestore nao e mais o bloqueador. A API foi habilitada, o database foi criado e os 3 indices `users` ficaram `READY`.

O bloqueio atual e Firebase Auth: `PATCH /admin/v2/projects/finance-control-staging-260919/config` retornou `CONFIGURATION_NOT_FOUND`, `POST /v2/projects/finance-control-staging-260919/identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED`, e signup com chave publica staging retornou `CONFIGURATION_NOT_FOUND`.

Por isso, smoke autenticado, E2E staging completa, isolamento A -> B, import XLSX, horas, backup/dry-run e admin em staging permanecem pendentes.

## Hashes e evidencias

- `firestore.rules` SHA256: `BDC1F8D8B5D3FFCF399483BF72A6A6531757BD607351EADA1981C2D979BAD5F9`.
- `firestore.indexes.json` SHA256: `229167F1A944093DE01CE65DB86F591BA56B1C6756909D53016EA2E584825DE5`.
- Ruleset staging: `projects/finance-control-staging-260919/rulesets/b5fc5ac6-677d-4df6-af9b-740e7a307c88`.
- Hosting version: `projects/945561850688/sites/finance-control-staging-260919/versions/5ca5e3cf6dd4cc8d`.
- Teste real de rede/config: `npx.cmd playwright test --config=playwright.staging.config.js --reporter=line` aprovado, 1 teste.

## Decisao

STAGING NOT VALIDATED.

PRODUCTION NOT READY FOR PRODUCTION DEPLOY.
# Evidência 7.3I

O artefato staging foi verificado antes dos dois deploys: continha `finance-control-staging-260919` e não continha os identificadores de produção nem local-e2e. A captura de rede do staging-critical 7/7 observou zero requests para `finance-control-cce4f`.
