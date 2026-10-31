# Release readiness local

Executado em: 19/09/2026

## Decisao

Status local: READY FOR STAGING, condicionado a criar um ambiente de staging isolado antes de qualquer publicacao.

Status de producao: NOT READY FOR PRODUCTION DEPLOY.

Este checkpoint foi feito somente no ambiente local, com Vite, Auth Emulator e Firestore Emulator quando houve persistencia de teste. Nenhum deploy, push, pull, fetch, Firebase real, Admin SDK, custom claim real, restore real, WhatsApp ou ambiente de producao foi executado.

## Estado do repositorio

- Branch esperada: `melhoria-arquitetura`.
- HEAD esperado no inicio: `71218ba test: homologa limites da administracao de usuarios`.
- Remote Git: vazio.
- Deploy/publicacao: nao executado.

## Ambiente local validado

- Windows: Microsoft Windows NT 10.0.26200.0.
- Node: v24.14.1.
- npm: 11.11.0 via `npm.cmd`.
- Java: OpenJDK 21.0.10 LTS Temurin.
- Vite: 6.4.2.
- Firebase CLI: 15.24.0.
- Playwright: 1.59.1.
- URL local usada nos E2E: `http://127.0.0.1:5178`.

Observacao: `npm --version` direto no PowerShell foi bloqueado por politica de execucao local; os comandos foram executados com `npm.cmd`, preservando o mesmo npm instalado.

## Escopo validado

- Login de usuario ativo em emulator.
- Smoke de release com criacao de saida, parcelamento, pagamento de parcela, importacao XLSX, controle de horas, backup e restore dry-run.
- Regressao local existente para financeiro, parcelamentos, recorrencias, importacao XLSX, controle de horas, backup/restore, configuracoes e administracao de usuarios.
- Regras Firestore e ciclo Auth via emuladores.
- Checks de bundle, bootstrap, loaders, modernizacao, resiliencia, auditoria, importacao, backup e administracao.

## Configuracao e riscos de ambiente

| Item | Uso esperado | Risco antes de staging/producao |
| --- | --- | --- |
| `.firebaserc` | Aponta para `finance-control-cce4f` como projeto default | Risco de deploy acidental se alguem executar comando de deploy fora do fluxo. Para staging, usar projeto Firebase separado e comando explicito com `--project`. |
| `firebase.json` | Define rules, indexes e emulators Auth/Firestore | Seguro localmente; qualquer deploy de rules/indexes deve passar por revisao manual e projeto isolado. |
| `VITE_FINANCE_USE_FIREBASE_EMULATORS` | Ativa emuladores no E2E local | Deve estar ausente/falso em producao. |
| `VITE_FIREBASE_PROJECT_ID` | Define projeto demo nos E2E | Em staging deve apontar para projeto staging, nunca para producao. |
| Firebase web config | Config client-side publica | Nao e segredo, mas precisa ser conferida por ambiente. |
| CDNs/lazy loaders | XLSX/PDF e bibliotecas carregadas sob demanda | Exigem avaliacao de CSP, disponibilidade e fallback operacional em staging. |

## Auditoria de segredos e dados

Nao foram encontrados arquivos locais com padrao de service account, chave privada, `.env` ou credenciais reais pelo scan de nomes sensiveis. Os achados de `password`, `token` e `secret` aparecem em testes/fixtures/sanitizacao e documentacao. A configuracao web do Firebase e publica por natureza, mas o projeto default em `.firebaserc` deve ser tratado como risco operacional de deploy.

Firebase real nao foi usado para criar, editar, excluir ou restaurar dados.

## Dados e migracao

Colecoes conhecidas:

- `users/{uid}`
- `users/{uid}/finance_records`
- `users/{uid}/local_storage`
- `users/{uid}/audit_logs`
- `users/{uid}/idempotency_receipts`
- `shared_macros`
- `shared_categories`
- `tax_parameters`

Nao ha migracao real executada neste checkpoint. Compatibilidade com dados legados depende de normalizadores, bridges e defaults documentados. Antes de producao, dados historicos devem passar por inventario de `owner_uid`, `owner_email`, `type`, `schema_version`, referencias pessoais/globais, parcelamentos, recorrencias, importacoes e entradas consolidadas.

## UX, mobile e acessibilidade

O smoke de release verificou ausencia de overflow horizontal no dashboard em desktop local e preservacao de navegacao apos reload. Tambem contou botoes sem nome acessivel aparente na tela corrente: ate 18 botoes icon-only/sem texto acessivel foram observados durante o smoke. Isso nao bloqueia staging tecnico, mas deve entrar como item de correcao antes de producao.

## Bloqueadores

### Para staging

- Criar e configurar projeto Firebase de staging separado.
- Garantir que `.firebaserc`/comandos de staging usem `--project` explicito.
- Definir variaveis Vite/Firebase de staging e confirmar que emuladores nao ficam ativos.
- Validar manualmente indexes e rules no projeto de staging antes de qualquer uso por usuario real.

### Para producao

- Homologacao completa em staging ainda nao executada.
- Restore real continua indisponivel por decisao de seguranca; rollback operacional real ainda precisa de runbook, owner e janela de execucao.
- Emissao de custom claims/Admin SDK/backend confiavel permanece fora do app client-side.
- Revisao manual de UX/acessibilidade/mobile ainda pendente.
- Monitoramento, responsavel de release, plano de comunicacao e congelamento de deploy ainda nao definidos.
- Auditoria de dados reais/historicos nao executada.

## Resultados dos comandos

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | aprovado, exit 0; inventario regenerado com 50 globais/APIs |
| `npm.cmd test` | aprovado, exit 0; 112 arquivos de teste e 661 testes passaram |
| `npm.cmd run build` | aprovado, exit 0; Vite build concluiu em 6.01s |
| `npm.cmd run smoke` | aprovado, exit 0; status `ok`, 26 checks passaram em `http://127.0.0.1:5175/` |
| `npm.cmd run perf:audit` | aprovado, exit 0; 2 testes passaram |
| `npm.cmd run bundle:budget` | aprovado, exit 0; `ok: true`, entry 375264 bytes, limite 430080, globais 50 |
| `npm.cmd run bootstrap:check` | aprovado, exit 0; `ok: true`, 22 scripts classicos, 22 eval executados, 50 globais |
| `npm.cmd run bootstrap:benchmark` | aprovado, exit 0; `ok: true`, `wrote: false` |
| `npm.cmd run library-loader:check` | aprovado, exit 0 |
| `npm.cmd run legacy-loader:check` | aprovado, exit 0 |
| `npm.cmd run finance-ui-consumers:check` | aprovado, exit 0 |
| `npm.cmd run settings-modernization:check` | aprovado, exit 0 |
| `npm.cmd run user-admin-modernization:check` | aprovado, exit 0 |
| `npm.cmd run user-admin:benchmark` | aprovado, exit 0 |
| `npm.cmd run user-admin:query-check` | aprovado, exit 0 |
| `npm.cmd run resilience:dry-run` | aprovado, exit 0 |
| `npm.cmd run post-commit:dry-run` | aprovado, exit 0 |
| `npm.cmd run audit:dry-run` | aprovado, exit 0 |
| `node scripts/analyze-legacy-loader.mjs` | aprovado, exit 0; `ok: true`, 22 scripts classicos, 22 eval executados, 50 globais |
| `npm.cmd run import:dry-run` | aprovado, exit 0; `wrote: false`, `production_touched: false`, `firebase_touched: false` |
| `npm.cmd run import:xlsx-dry-run` | aprovado, exit 0; `ok: true`, `wrote: false`, 5 registros simulados |
| `npm.cmd run import:benchmark` | aprovado, exit 0; `ok: true`, `wrote: false` |
| `npm.cmd run import-ui-modernization:check` | aprovado, exit 0; `ok: true`, sem violacoes |
| `npm.cmd run backup:dry-run` | aprovado, exit 0; `ok: true`, `wrote: false`, `firebase_touched: false`, `production_touched: false` |
| `npm.cmd run backup:benchmark` | aprovado, exit 0; `ok: true`, `wrote: false` |
| `npm.cmd run backup-ui-modernization:check` | aprovado, exit 0; `ok: true`, sem violacoes |
| `npm.cmd run hour-control-modernization:check` | aprovado, exit 0; `ok: true`, sem violacoes |
| `npm.cmd run hour-control:benchmark` | aprovado, exit 0; `ok: true`, `wrote: false` |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules"` | aprovado, exit 0 |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow"` | aprovado, exit 0 |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line"` | aprovado, exit 0 |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | aprovado, exit 0 |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/release-readiness-smoke.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | aprovado: 1 teste passou |

## Avisos observados

- O Firestore Emulator registrou `PERMISSION_DENIED` durante testes negativos de Rules/Auth; comportamento esperado dos cenarios que comprovam bloqueios.
- O Firestore Emulator registrou aviso `ArrayIndexOutOfBoundsException` em permission traces; classificado como aviso conhecido do Emulator/WebChannel nesta base, sem falha de teste.
- O Node exibiu `DEP0169` relacionado a `url.parse()` em dependencia transitiva da Firebase CLI; nao houve falha de comando.
- `npm.cmd test` exibiu stderr de `FINANCE_RECORD_CONTRACT_INVALID` em teste negativo de contrato; a suite passou com 661 testes.

## Confirmacoes negativas

- Regras financeiras alteradas: nao.
- Interface funcional alterada: nao.
- Firestore Rules alteradas: nao.
- Auth/custom claims alterados: nao.
- Firebase real acessado: nao.
- Deploy executado: nao.
- Push/pull/fetch/remote alterado: nao.

## Adendo 7.1 - pacote local de staging

Executado em: 19/09/2026

Status local: READY TO PROVISION STAGING.

Status de producao: NOT READY FOR PRODUCTION DEPLOY.

Esta etapa preparou um pacote documental e automatizado para staging isolado, sem criar projeto real, sem login cloud, sem Firebase real, sem deploy, sem push/pull/fetch, sem Admin SDK, sem custom claim real, sem restore real e sem WhatsApp/provider.

### Artefatos 7.1

- `docs/staging-environment-contract.md`
- `docs/staging-provisioning-plan.md`
- `docs/staging-synthetic-data-plan.md`
- `docs/staging-post-deploy-smoke.md`
- `docs/staging-rollback-rehearsal.md`
- `docs/staging-go-no-go.md`
- `docs/release-candidate-artifacts.md`
- `docs/release-candidate-manifest.json`
- `scripts/generate-release-manifest.mjs`
- `scripts/staging-rehearsal.mjs`
- `tests/architecture/releaseManifest.test.js`

### Release candidate local

- Commit-base da aplicacao: `567a4ef`.
- Branch: `melhoria-arquitetura`.
- Manifest: `docs/release-candidate-manifest.json`.
- Hash do diretorio `dist/`: `0d9365795d92f10f6730989f171583042b299e9fbee622646381bc4dea336f16`.
- Entry chunk: `dist/assets/app-qAd56Hqh.js`, 375264 bytes.
- Maior chunk: `dist/assets/services-firestore-BXeVvSYt.js`, 449417 bytes.
- Firestore Rules SHA-256: `bdc1f8d8b5d3ffcf399483bf72a6a6531757bd607351eada1981c2d979bad5f9`.
- Firestore indexes SHA-256: `229167f1a944093de01ce65db86f591ba56b1c6756909d53016ea2e584825de5`.
- `package-lock.json` SHA-256: `7c7b0f32419ec69243ccc1679b427560d3d7f84bbb5a16f4305c15e7716031a0`.
- APIs globais inventariadas: 50.
- Scripts classicos/eval executados: 22/22.
- Restore real habilitado: nao.
- Admin SDK no cliente: nao.

### Staging real

Staging real ainda nao foi criado, conectado ou publicado. O pacote 7.1 autoriza somente a proxima atividade operacional de provisionar um ambiente Firebase isolado de staging, seguindo o contrato e sempre com `--project <staging-project-id>` explicito.

### Resultados 7.1

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | aprovado, exit 0; inventario regenerado com 50 globais/APIs |
| `npm.cmd test` | aprovado, exit 0; 113 arquivos de teste e 663 testes passaram |
| `npm.cmd run build` | aprovado, exit 0; Vite build concluiu, entry `dist/assets/app-qAd56Hqh.js` com 375264 bytes |
| `npm.cmd run smoke` | aprovado, exit 0; status `ok`, 26 checks em `http://127.0.0.1:5175/` |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | aprovado, exit 0; 47 testes passaram |
| `npm.cmd run perf:audit` | aprovado, exit 0; 2 testes passaram |
| `npm.cmd run bundle:budget` | aprovado, exit 0; `ok: true`, globais 50, entry 375264 bytes, limite 430080 |
| `npm.cmd run bootstrap:check` | aprovado, exit 0; `ok: true`, 22 scripts classicos, 22 eval executados, 50 globais |
| `npm.cmd run bootstrap:benchmark` | aprovado, exit 0; `ok: true`, sem warnings/violacoes de regressao |
| `npm.cmd run library-loader:check` | aprovado, exit 0; `ok: true`, lazy libraries `xlsx`, `pdf`, `firebase` |
| `npm.cmd run legacy-loader:check` | aprovado, exit 0; `ok: true`, 22 scripts classicos, 22 eval executados |
| `npm.cmd run finance-ui-consumers:check` | aprovado, exit 0; `ok: true`, sem novas exposicoes globais |
| `npm.cmd run settings-modernization:check` | aprovado, exit 0; `ok: true` |
| `npm.cmd run user-admin-modernization:check` | aprovado, exit 0; `ok: true` |
| `npm.cmd run user-admin:benchmark` | aprovado, exit 0; `ok: true`, cenarios 100/1000/5000 usuarios |
| `npm.cmd run user-admin:query-check` | aprovado, exit 0; `ok: true` |
| `npm.cmd run resilience:dry-run` | aprovado, exit 0; `ok: true`, `wrote=false`, `firebase_touched=false` |
| `npm.cmd run post-commit:dry-run` | aprovado, exit 0; `ok: true`, `wrote=false`, `firebase_touched=false` |
| `npm.cmd run audit:dry-run` | aprovado, exit 0; `ok: true`, 8 fixtures validas, 2 invalidas esperadas |
| `node scripts/analyze-legacy-loader.mjs` | aprovado, exit 0; `ok: true`, 22 scripts classicos, 22 eval executados |
| `npm.cmd run import:dry-run` | aprovado, exit 0; `wrote=false`, `production_touched=false`, `firebase_touched=false` |
| `npm.cmd run import:xlsx-dry-run` | aprovado, exit 0; `ok: true`, 5 registros simulados persistidos em memoria |
| `npm.cmd run import:benchmark` | aprovado, exit 0; `ok: true`, `wrote=false` |
| `npm.cmd run import-ui-modernization:check` | aprovado, exit 0; `ok: true`, sem violacoes |
| `npm.cmd run backup:dry-run` | aprovado, exit 0; `ok: true`, `wrote=false`, `firebase_touched=false`, `production_touched=false` |
| `npm.cmd run backup:benchmark` | aprovado, exit 0; `ok: true`, `wrote=false` |
| `npm.cmd run backup-ui-modernization:check` | aprovado, exit 0; `ok: true`, sem violacoes |
| `npm.cmd run hour-control-modernization:check` | aprovado, exit 0; `ok: true`, sem violacoes |
| `npm.cmd run hour-control:benchmark` | aprovado, exit 0; `ok: true`, `wrote=false` |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules"` | aprovado, exit 0 |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow"` | aprovado, exit 0; 1 arquivo e 20 testes passaram |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | aprovado, exit 0; 15 testes passaram |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/release-readiness-smoke.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | aprovado, exit 0; 1 teste passou |
| `node scripts/staging-rehearsal.mjs` | aprovado, exit 0; build, manifest, smoke local e release smoke em Emulator; `deployExecuted=false`, `firebaseRealTouched=false` |

### Avisos 7.1

- O primeiro `npm.cmd test` falhou porque o novo teste de manifest coletava versoes externas e excedia o timeout da suite completa. O teste foi corrigido para validar o manifest gerado sem executar comandos pesados; a suite completa passou em seguida.
- As primeiras execucoes de `node scripts/staging-rehearsal.mjs` falharam por quoting de `npm.cmd`/`node.exe`/comando interno do Firebase Emulator no Windows. O script foi corrigido e aprovado.
- Logs `PERMISSION_DENIED`, limite de avaliacao de Rules, `ArrayIndexOutOfBoundsException` no Firestore Emulator e `DEP0169` da Firebase CLI permanecem como avisos conhecidos de cenarios negativos/emulador; nenhum deles quebrou os gates.

### Confirmacoes 7.1

- Regras financeiras alteradas: nao.
- Interface funcional alterada: nao.
- Firestore Rules alteradas: nao.
- Auth/custom claims alterados: nao.
- Firebase real acessado: nao.
- Deploy executado: nao.
- Projeto Firebase real criado/conectado: nao.
- Push/pull/fetch/remote alterado: nao.

## Adendo 7.2 - UX, mobile e acessibilidade local

Executado em: 19/09/2026

Status UX local: READY FOR STAGING.

Status geral para staging: READY TO PROVISION STAGING, condicionado a criar e usar ambiente Firebase de staging isolado antes de qualquer publicacao.

Status de producao: NOT READY FOR PRODUCTION DEPLOY.

Esta etapa adicionou `tests/playwright/release-ux-accessibility.spec.js` e `docs/release-ux-accessibility-readiness.md`. A homologacao cobriu telas criticas em desktop, mobile, navegacao por teclado e nomes acessiveis minimos, usando Vite local e massa sintetica em memoria. Nenhum deploy, Firebase real, push, pull, fetch, Firestore Rules, Auth/custom claims ou regra financeira foi alterado.

Correcoes pequenas aplicadas: nomes acessiveis em botoes icon-only de menu e acoes financeiras, input de vencimento, inputs de importacao XLSX, competencia de arquivamento, excluir pessoa e arquivo JSON de restore dry-run.

Resultado local novo: `npx.cmd playwright test tests/playwright/release-ux-accessibility.spec.js --reporter=line` aprovado, 3 testes passaram.

## Adendo 7.3 - provisionamento real de staging

Executado em: 19/09/2026

Status staging: STAGING NOT VALIDATED.

Status producao: NOT READY FOR PRODUCTION DEPLOY.

O projeto Firebase real `finance-control-staging-260919` foi criado com project number `945561850688`, Web App `1:945561850688:web:8a00895f04d01d5aa860a5` e Hosting default `https://finance-control-staging-260919.web.app`. O projeto e comprovadamente diferente da producao conhecida `finance-control-cce4f`.

Firestore foi resolvido no staging: API habilitada, database `(default)` criado em `nam5`, Rules/Indexes deployados e indices `users` em `READY`. Hosting tambem foi publicado na URL real com build apontando para `finance-control-staging-260919`.

A homologacao completa permanece bloqueada por Firebase Auth: `identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED`, enquanto configuracao/signup retornaram `CONFIGURATION_NOT_FOUND`. Sem Auth, nao foram criados usuarios/dados sinteticos e as jornadas autenticadas permanecem pendentes.

Artefatos adicionados/atualizados: `docs/firebase-environment-safety-map.md`, `docs/staging-production-isolation-evidence.md`, `docs/staging-real-validation.md`, `scripts/assert-staging-target.mjs`, `tests/architecture/stagingTargetGuard.test.js`, `tests/services/firebaseConfig.test.js`, `playwright.staging.config.js`, `tests/playwright/staging-critical.spec.js`, `firebase.json` e `.env.staging.example`.

Confirmacoes: nenhum deploy em producao, nenhuma leitura/escrita em producao, nenhum dado real, nenhum segredo versionado, nenhum push/pull/fetch, nenhum WhatsApp/provider e nenhum restore real.
# Checkpoint 7.3H — isolamento Firebase

Local E2E está isolado no projeto demo, com Auth/Firestore Emulator e bloqueio de endpoints cloud. Gates locais estão verdes. Staging permanece **NOT VALIDATED** e produção **NOT READY**.
# Checkpoint 7.3I

Hosting staging final `c62110cc749afe88`; staging-critical 7/7; Vitest 673/673; regressão Playwright 47/47; bundle e bootstrap verdes. Release segue bloqueada pelos fluxos staging ainda sem evidência real listados em `staging-real-validation.md`.

## Baseline P0 - 30/10/2026

Issue: `#12` (`P0: registrar baseline de release e staging`).

Branch: `chore/p0-baseline-20261030`, criada a partir de `origin/main` no commit `2dd9a77`.

Escopo desta execução: coleta e documentação da baseline. Nenhuma refatoração ampla, alteração funcional, deploy ou operação em Firebase real foi realizada. Os testes integrados usaram exclusivamente Auth/Firestore Emulator com o project ID demo `demo-finance-control-local-e2e`.

### Resultado dos gates

| Comando | Resultado |
| --- | --- |
| `npm.cmd ci` | aprovado, exit 0; 870 pacotes adicionados e 871 auditados |
| `npm.cmd test` | aprovado, exit 0; 115 arquivos e 673/673 testes passaram |
| `npm.cmd run build` | aprovado, exit 0; 1.946 módulos transformados |
| `npm.cmd run smoke` | aprovado, exit 0; status `ok`, 25 checks funcionais |
| `npm.cmd run inventory:globals` | aprovado, exit 0; inventário regenerado com 50 entradas globais/API |
| `npm.cmd run bundle:budget` | aprovado, exit 0; nenhuma violação |
| `npm.cmd run bootstrap:check` | aprovado, exit 0; nenhuma violação e `wrote=false` |
| `npm.cmd run perf:audit` | aprovado, exit 0; 2/2 testes Playwright passaram |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules"` | aprovado, exit 0; 128 testes catalogados em 6 arquivos |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow"` | aprovado, exit 0; 1 arquivo e 20/20 testes passaram |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- --reporter=line"` | aprovado, exit 0; 16/16 testes passaram em 3,4 min |

### Métricas congeladas

- Entry chunk: `dist/assets/app-BYocMCyh.js`, 375.588 bytes de um orçamento de 430.080 bytes (87,33%).
- Maior chunk: `dist/assets/services-firestore-BXeVvSYt.js`, 449.417 bytes de um orçamento de 573.440 bytes.
- Chunk Firebase services: `dist/assets/services-firebase-BQOX3gns.js`, 167.177 bytes de um orçamento de 573.440 bytes.
- Globals/API: 50 de um máximo de 50.
- Scripts clássicos: 22 de um máximo de 23.
- Scripts executados pelo loader legado: 22 de um máximo de 23.
- Bibliotecas lazy confirmadas: `xlsx`, `pdf` e `firebase`; bootstrap mantém `chart` e `lucide`.
- O teste conhecido `tests/architecture/global-api-collisions.test.js` passou sem alteração de timeout, retry ou código.
- O E2E local confirmou fail-closed nos emuladores e zero requests ao Firebase cloud.

### Bloqueadores e avisos

- `npm ci` reportou 54 vulnerabilidades em dependências: 27 moderadas, 22 altas e 5 críticas. A correção não pertence ao escopo documental desta baseline e exige triagem própria antes de produção.
- `caniuse-lite` está seis meses desatualizado.
- A Firebase CLI emitiu o aviso de depreciação Node `DEP0169`; os `PERMISSION_DENIED` observados são esperados nos cenários negativos de Rules/Auth/E2E.
- Staging permanece **STAGING NOT VALIDATED** conforme `docs/staging-real-validation.md`: faltam revalidações reais de XLSX/reimportação/arquivo renomeado, auditoria `HOUR_ENTRY_CREATED/UPDATED`, settings/references A/B, mobile ampliado dos fluxos XLSX/backup/horas e ensaio de rollback frontend.
- Produção permanece **NOT READY FOR PRODUCTION DEPLOY**. Esta execução não acessou staging nem produção.

### Decisão P0

Baseline local: **GREEN**, com todos os gates solicitados aprovados.

Release para staging/produção: **NO-GO**, pelos bloqueadores documentais e de segurança acima. Dados, segurança, desempenho, observabilidade e acessibilidade foram considerados; como não houve mudança funcional ou visual, não há impacto novo nessas superfícies além das evidências e pendências registradas.
