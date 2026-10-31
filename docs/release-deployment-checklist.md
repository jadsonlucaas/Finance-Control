# Checklist de deploy futuro

Este checklist e um gate manual para uma etapa futura. Ele nao autoriza deploy a partir do ambiente local atual.

## Pre-flight

- Confirmar branch e commit aprovados para release.
- Confirmar worktree limpo.
- Confirmar que nao ha arquivos `.env`, service account, chave privada, dumps reais ou credenciais locais no commit.
- Confirmar que o projeto Firebase alvo e staging, nao producao.
- Executar comandos sempre com `--project <staging-project-id>` explicito.
- Confirmar variaveis de ambiente de staging e ausencia de `VITE_FINANCE_USE_FIREBASE_EMULATORS=true`.
- Confirmar indices Firestore necessarios em staging.
- Confirmar plano de rollback e responsavel de release.

## Gates obrigatorios antes de staging

- `npm.cmd run inventory:globals`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run smoke`
- `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules"`
- `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow"`
- `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"`
- `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/release-readiness-smoke.spec.js --config=playwright.e2e-local.config.js --reporter=line"`
- `npx.cmd playwright test tests/playwright/release-ux-accessibility.spec.js --reporter=line`
- Checks de bundle, bootstrap, loaders, importacao, backup, administracao e resiliencia listados no checkpoint.

## Validacoes manuais em staging

- Login, logout, troca de usuario e usuario inativo.
- Dashboard com filtros, datas, pessoas e categorias.
- Criacao/edicao/exclusao de saidas.
- Parcelamento, pagamento de parcela e recorrencias.
- Entradas, consolidacao e detalhes de calculo.
- Controle de horas, hora extra e banco de horas.
- Importacao XLSX e reimportacao duplicada.
- Configuracoes pessoais e globais conforme permissao.
- Administracao de usuarios por admin autorizado.
- Backup, download, validacao e restore dry-run.
- Exportacao PDF.
- Layout desktop/mobile sem overflow em telas criticas.
- Navegacao por teclado e botoes icon-only com nome acessivel.
- Conferir manualmente que a evidencia local de `docs/release-ux-accessibility-readiness.md` se mantem no staging real.

## Condicoes para producao

- Staging aprovado com dados ficticios e depois com massa controlada/sanitizada.
- Projeto Firebase de producao conferido por duas pessoas.
- `.firebaserc` e comandos de deploy revisados para evitar alvo incorreto.
- Restore real ou plano alternativo formalizado e testado fora de producao.
- Backups pre-release gerados e verificados.
- Owner de release definido.
- Monitoramento e criterio de rollback definidos.
- Nenhuma lacuna critica aberta em Auth, Rules, dados, importacao, backup ou calculos financeiros.

## Proibido

- Executar deploy diretamente do checkpoint local.
- Usar banco de producao como massa de teste.
- Usar Admin SDK ou service account no frontend.
- Fazer restore real sem runbook aprovado.
- Alterar regras financeiras para passar gate.
- Relaxar budgets, retries, timeouts ou baselines sem justificativa e aprovacao.

## Pacote 7.1 de staging isolado

Antes de qualquer staging real, conferir:

- `docs/staging-environment-contract.md`
- `docs/staging-provisioning-plan.md`
- `docs/staging-synthetic-data-plan.md`
- `docs/staging-post-deploy-smoke.md`
- `docs/staging-rollback-rehearsal.md`
- `docs/staging-go-no-go.md`
- `docs/release-candidate-artifacts.md`
- `docs/release-candidate-manifest.json`

O pacote 7.1 nao autoriza deploy, nem troca o projeto Firebase alvo. Ele apenas define o contrato para provisionar staging isolado e ensaiar localmente com Emulator.

## Adendo 7.3

O staging real `finance-control-staging-260919` foi criado, Firestore Database/Rules/Indexes foram provisionados e Hosting foi publicado na URL real. O staging ainda NAO esta validado porque Firebase Auth nao foi inicializado/configurado: `identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED` e signup/config retornaram `CONFIGURATION_NOT_FOUND`.

Antes de qualquer nova escrita real ou novo deploy, executar `node scripts/assert-staging-target.mjs --project finance-control-staging-260919` e manter todos os comandos com `--project finance-control-staging-260919`.

Producao `finance-control-cce4f` permanece denylist absoluta.
# 7.3I

- [x] Guard explícito de staging antes do deploy
- [x] Hosting staging `c62110cc749afe88`
- [x] Staging critical 7/7
- [ ] XLSX, auditoria, settings/references e mobile ampliado em staging
- [ ] Rollback frontend staging
- [ ] Liberação para produção

## P3 — staging final

- [x] Guard executado antes de operações cloud
- [x] Target único `finance-control-staging-260919`
- [x] Produção `finance-control-cce4f` em denylist
- [x] Staging critical ampliado: 9/9 por rodada
- [x] Três rodadas completas sem retry: 27/27
- [x] Login A/B, pending, inactive e A → B → A
- [x] CRUD/reload, parcelamento/pagamento e recorrência
- [x] XLSX e reimportação renomeada sem duplicidade
- [x] Horas e auditoria create/update
- [x] Backup/upload/preview e restore dry-run `wrote=false`
- [x] `parent_id` de parcela não tratado como foreign key
- [x] Settings/references A/B
- [x] Mobile 390x844 em login, XLSX, horas e backup
- [x] Zero requests observados para produção
- [x] Rollback frontend staging ensaiado e versão atual restaurada
- [x] **STAGING VALIDATED**
- [ ] Produção permanece fora de escopo e não autorizada
