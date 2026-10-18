# Validacao real de staging Firebase - 7.3

Executado em: 19/09/2026

## Decisao

Status staging: STAGING NOT VALIDATED.

Status producao: NOT READY FOR PRODUCTION DEPLOY.

## Resultado

O projeto Firebase real de staging foi criado, esta separado da producao e recebeu Firestore Database, Firestore Rules, Firestore Indexes e Hosting da aplicacao.

A homologacao completa permanece bloqueada porque o Auth de staging ainda nao pode ser inicializado/configurado neste projeto sem billing. A tentativa controlada de inicializacao pelo endpoint `identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED`, e a tentativa de signup com a chave publica staging retornou `CONFIGURATION_NOT_FOUND`.

## Artefatos criados

- Projeto staging: `finance-control-staging-260919`.
- Project number: `945561850688`.
- Web App staging: `1:945561850688:web:8a00895f04d01d5aa860a5`.
- Auth domain staging: `finance-control-staging-260919.firebaseapp.com`.
- Storage bucket staging: `finance-control-staging-260919.firebasestorage.app`.
- Hosting default staging: `https://finance-control-staging-260919.web.app`.

## Guard anti-producao

Criado `scripts/assert-staging-target.mjs` com allowlist explicita de `finance-control-staging-260919` e denylist de `finance-control-cce4f`.

Validado por `tests/architecture/stagingTargetGuard.test.js`.

## Configuracao local segura

- `.firebaserc` manteve `default=finance-control-cce4f`.
- `.firebaserc` adicionou apenas `staging=finance-control-staging-260919`.
- `src/services/firebase.js` passou a aceitar config completa via `VITE_FIREBASE_*`.
- Sem env completa, o fallback existente permanece inalterado.
- `.env.staging.example` documenta placeholders e identificadores publicos de staging sem token, private key ou service account.

## Comandos Firebase reais executados

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase login:list` | autenticado como conta local da CLI |
| `npx.cmd firebase projects:list` | antes da criacao: sem staging; depois da criacao: staging listado |
| `node scripts/assert-staging-target.mjs --project finance-control-staging-260919` | aprovado antes das mutacoes reais |
| `npx.cmd firebase projects:create finance-control-staging-260919 --display-name "Finance Control Staging"` | aprovado; criou projeto staging |
| `npx.cmd firebase apps:create WEB "Finance Control Staging Web" --project finance-control-staging-260919` | aprovado; criou Web App staging |
| `npx.cmd firebase apps:sdkconfig WEB 1:945561850688:web:8a00895f04d01d5aa860a5 --project finance-control-staging-260919` | aprovado; config publica obtida |
| `npx.cmd firebase hosting:sites:list --project finance-control-staging-260919` | aprovado; site default listado |
| `serviceusage firestore.googleapis.com:enable` via Firebase CLI auth | aprovado; API Firestore habilitada somente no staging |
| `npx.cmd firebase firestore:databases:create "(default)" --location nam5 --project finance-control-staging-260919` | aprovado; database `(default)` criado em `nam5` |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules"` | aprovado antes do deploy real de Rules/Indexes |
| `npx.cmd firebase deploy --only firestore:rules,firestore:indexes --project finance-control-staging-260919` | aprovado; ruleset `b5fc5ac6-677d-4df6-af9b-740e7a307c88` publicado |
| `npx.cmd firebase firestore:indexes --project finance-control-staging-260919` | aprovado; 3 indices `users` em estado `READY` |
| `serviceusage identitytoolkit.googleapis.com:enable` via Firebase CLI auth | aprovado; operacao `noop.DONE_OPERATION` |
| `PATCH /admin/v2/projects/finance-control-staging-260919/config` | bloqueado por `CONFIGURATION_NOT_FOUND` |
| `POST /v2/projects/finance-control-staging-260919/identityPlatform:initializeAuth` | bloqueado por `BILLING_NOT_ENABLED` |
| `POST /v1/accounts:signUp` com chave publica staging | bloqueado por `CONFIGURATION_NOT_FOUND`; nenhum usuario criado |
| `npm.cmd run build` com `VITE_FIREBASE_*` de staging | aprovado |
| `npx.cmd firebase deploy --only hosting --project finance-control-staging-260919` | aprovado; Hosting URL `https://finance-control-staging-260919.web.app`; version `5ca5e3cf6dd4cc8d` |
| `npx.cmd playwright test --config=playwright.staging.config.js --reporter=line` | aprovado; 1 teste validou URL real, projectId staging e ausencia de requests para producao |

## Hashes e versoes

- `firestore.rules` SHA256: `BDC1F8D8B5D3FFCF399483BF72A6A6531757BD607351EADA1981C2D979BAD5F9`.
- `firestore.indexes.json` SHA256: `229167F1A944093DE01CE65DB86F591BA56B1C6756909D53016EA2E584825DE5`.
- `dist/index.html` SHA256 do build staging publicado: `2E74235955A3C20CAB7B0F183D996BA1E0E95B376E391BD187A095EE64EEE3D0`.
- Hosting version: `projects/945561850688/sites/finance-control-staging-260919/versions/5ca5e3cf6dd4cc8d`.

## Smoke real executado

- Carregamento da URL real de staging: aprovado.
- Firebase runtime projectId: `finance-control-staging-260919`.
- Requests para `finance-control-cce4f`: nao detectados no teste Playwright de staging.
- Tela de Auth exibida: aprovado.
- Login/signup real: bloqueado por Auth nao inicializado (`CONFIGURATION_NOT_FOUND`).

## Smoke real nao executado por bloqueio de Auth

As jornadas autenticadas abaixo nao foram executadas porque nao foi possivel criar usuarios sinteticos no Auth staging:

- login A;
- isolamento A -> B;
- criacao/edicao de saida;
- parcelamento e pagamento de parcela;
- recorrencia;
- import XLSX;
- controle de horas;
- backup/restore dry-run;
- administracao positiva de admin.

## Pendencias

- Inicializar/configurar Firebase Auth Email/Password no staging. O caminho CLI/API testado retornou `BILLING_NOT_ENABLED` para `identityPlatform:initializeAuth`.
- Criar somente usuarios/dados sinteticos.
- Executar smoke real autenticado, E2E critica, isolamento A -> B, import XLSX, horas, backup/dry-run e admin negativo/positivo quando Auth estiver disponivel.
- Ensaiar rollback de frontend quando houver uma versao anterior segura ou janela operacional definida.

## Confirmacoes negativas

- Deploy em producao: nao.
- Leitura/escrita em producao: nao.
- Dados reais usados: nao.
- Segredos versionados: nao.
- Push/pull/fetch Git: nao.
- WhatsApp/provider externo: nao.
- Restore real: nao.
- STAGING VALIDATED declarado: nao.
# Resultado adicional da etapa 7.3F

- Harness de sessão estabilizado: três rodadas consecutivas com 5/5 testes focados verdes.
- `active`, `pending` e `inactive`: UID, profile, status, tela final, reload e logout canônico confirmados.
- Parcelamento/pagamento e recorrência pela UI: aprovados no staging real.
- Horas pela UI: criação aprovada no staging real.
- Backup: bloqueado. O backup gerado pela UI tem checksum/versão/owner válidos, mas a validação do próprio arquivo retorna `ORPHAN_REFERENCE` para `parent_id` de parcelas sem registro-pai no snapshot.
- Restore dry-run: não executado porque a validação anterior falhou.
- Restore real: não executado e permanece bloqueado.
- Produção: zero requests para `finance-control-cce4f` nos cenários monitorados.

Estado: **STAGING NOT VALIDATED**.
# Atualização 7.3H — 17/10/2026

O isolamento do ambiente local foi validado, conforme `environment-isolation-diagnostic.md`. Nenhum teste cloud de staging foi retomado nesta execução. Staging permanece **NOT VALIDATED**.
# Retomada 7.3I — 17/10/2026

Hosting staging foi publicado em `https://finance-control-staging-260919.web.app`, versão final `c62110cc749afe88`. O browser confirmou `finance-control-staging-260919` e a suíte crítica terminou 7/7, sem request para produção. Foram validados login A/B, A→B→A, active/pending/inactive com reload, CRUD e isolamento, parcelamento/pagamento, recorrência, horas, mobile básico e backup `1.0.0` com checksum, upload, preview e dry-run `wrote=false`; `ORPHAN_REFERENCE` não ocorreu e restore real continuou bloqueado.

Decisão: **STAGING NOT VALIDATED**. Permanecem sem revalidação real nesta execução: XLSX/reimportação/arquivo renomeado, auditoria `HOUR_ENTRY_CREATED/UPDATED`, settings/references A/B, mobile dos fluxos XLSX/backup/horas e ensaio de rollback frontend.
