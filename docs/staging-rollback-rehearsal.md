# Ensaio de rollback de staging

Executado em: 19/09/2026

Este runbook prepara rollback sem executar restore real e sem alterar Firebase real.

## Objetivo

Comprovar que a equipe sabe parar uma publicacao ruim em staging, preservar evidencias e retornar ao ultimo artefato aprovado sem mutacao destrutiva.

## Ensaio local permitido

- `npm.cmd run build`
- `node scripts/generate-release-manifest.mjs`
- `npm.cmd run backup:dry-run`
- `npm.cmd run resilience:dry-run`
- `npm.cmd run post-commit:dry-run`
- `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/release-readiness-smoke.spec.js --config=playwright.e2e-local.config.js --reporter=line"`

## Passos futuros em staging

1. Registrar commit, manifest e horario da publicacao.
2. Gerar snapshot pre-release por mecanismo aprovado.
3. Publicar somente artefato aprovado em staging.
4. Executar smoke pos-deploy.
5. Em falha critica, bloquear novos testes manuais, registrar evidencias e retornar ao artefato anterior aprovado.
6. Restore real de dados continua bloqueado sem backend confiavel, aprovacao operacional e auditoria server-side.

## Proibido

- Restore real pelo cliente.
- Escrita em producao.
- Uso de backup real como massa de teste.
- Alterar timeout, retry, budget ou regra financeira para mascarar falha.
# Estado após 7.3I

O rollback não foi ensaiado nesta execução. Não havia evidência suficiente para executar troca e restauração de versão sem ampliar o risco operacional; permanece pendência explícita e nenhum dado foi alterado para rollback.
