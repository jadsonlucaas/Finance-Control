# Preflight de produção para o primeiro go-live

Executado em: 31/10/2026
Issue: #17 — `release: preparar ambiente de produção para primeiro go-live`.

## Decisão

Status: **PRODUCTION PREFLIGHT GO — P5 autorizado apenas como processo controlado**.

Este documento não autoriza deploy por si só. Nenhum deploy, release Hosting, escrita Firestore, alteração de Auth, publicação de Rules/Indexes ou restore foi executado neste preflight.

## Matriz de gates

| Gate | Estado | Evidência/ação |
| --- | --- | --- |
| CI na `main` | PASS | PR #14 mesclado; workflow `CI / Quality gates` ativo. |
| Observabilidade | PASS | PR #15 mesclado; Sentry lazy, noop sem DSN, sanitização e base OpenTelemetry. |
| Staging | PASS | PR #16 mesclado; `STAGING VALIDATED`, 27/27 críticos, retries=0 e zero requests para produção. |
| Target | PASS | projectId único `finance-control-cce4f`; Hosting/Web App vinculados confirmados. |
| Auth | PASS | Email/Password habilitado e password required. |
| Firestore | PASS | `(default)`, Native, `southamerica-east1`, concorrência pessimista. |
| Rules candidatas | PASS | arquivo local idêntico ao ruleset homologado em staging. |
| Rules em produção | PENDING P5 | produção ainda usa ruleset antigo; aplicar somente em etapa explícita e validada. |
| Indexes candidatos | PASS | três indexes versionados e confirmados. |
| Indexes em produção | PENDING P5 | zero composites; criar e aguardar `READY` antes de fluxo dependente. |
| Build production | PASS | guard aprovado, build aprovado, projectId production e emulators=false. |
| Sentry production | PENDING P5 | injetar DSN/release/sample rate pelo ambiente seguro e validar evento sintético. |
| Backup pré-release | PENDING P5 | executar e validar antes da primeira mutação. |
| Rollback | PASS | runbook e gatilhos definidos em `docs/production-rollback.md`. |
| Smoke | PASS | runbook bloqueante definido em `docs/production-smoke.md`; execução é pós-deploy. |

## Identidade do ambiente

- Firebase projectId: `finance-control-cce4f`.
- Project number: `1050867234579`.
- Web App: `Finance Control`, app ID `1:1050867234579:web:c0e9456b8e45d3e5fc4ce6`.
- Hosting site: `finance-control-cce4f`.
- Domínio inicial aprovado: `https://finance-control-cce4f.web.app`.
- Custom domain: NOT APPLICABLE no primeiro go-live.
- Canal live: existe e ainda não possuía release no preflight inicial.

O Web App adicional `finance-control-web` não é target do go-live.

## Rules: diff explícito

| Origem | Ruleset | Linhas | SHA-256 normalizado |
| --- | --- | ---: | --- |
| Produção | `62167b62-f34f-45cc-8f99-fad42ab803af` | 193 | `11152512D76F80ADAB0333A79CFE249275063C4C769C844F33A557004FB9D8F1` |
| Staging | `b5fc5ac6-677d-4df6-af9b-740e7a307c88` | 735 | `B29FB6E667156C535AB54ADF3D2A58B12E08A87956EAB0E9EACA05D8E9EE7EDE` |
| Candidata local | `firestore.rules` | 735 | `B29FB6E667156C535AB54ADF3D2A58B12E08A87956EAB0E9EACA05D8E9EE7EDE` |

Staging e candidata são exatamente iguais após normalização. Produção difere: comparação por linha encontrou 595 linhas candidatas ausentes e 53 linhas exclusivas do ruleset antigo. O candidato acrescenta validações de status/role, transições administrativas, ownership, formatos financeiros, referências pessoais/compartilhadas, idempotency receipts e parâmetros tributários. Detalhes operacionais: `docs/production-firestore-diff.md`.

Não publicar Rules junto ao Hosting implicitamente. Em P5, a aplicação das Rules deve ser uma etapa separada, com target explícito, hash conferido e smoke de autorização antes do Hosting.

## Indexes

Produção possui zero indexes compostos. O candidato `firestore.indexes.json` contém:

1. `users(status ASC, email ASC)`;
2. `users(role ASC, email ASC)`;
3. `users(status ASC, role ASC, email ASC)`.

Em P5/predeploy, usar target explícito e publicar somente indexes. Aguardar os três estados `READY`; não promover frontend que dependa de index em criação.

## Guard e build de produção

O gate obrigatório é:

```text
npm run production:target-check -- finance-control-cce4f
```

O script `scripts/assert-production-target.mjs` exige target exato, ambiente `production`, configuração Firebase completa, projectId coerente e emulator flag exatamente `false`. Rejeita aliases, staging, projetos demo e configuração cruzada. Seu retorno contém `authorizesDeploy: false` porque o guard nunca substitui aprovação humana.

Build validado com a configuração pública do Web App correto:

- projectId efetivo: `finance-control-cce4f`;
- emulator flag: `false`;
- endpoints localhost/emulator: 0;
- projeto demo em texto literal: 0;
- chunk Sentry lazy: presente;
- padrões de segredo server-side: 0.

A string `finance-control-staging-260919` aparece uma vez no mapa fail-closed `FIREBASE_ENVIRONMENTS`; ela é denylist/contrato de ambiente, não fallback nem configuração selecionada. O runtime selecionado é exclusivamente production e falha em configuração ausente ou cruzada.

## Sentry production

A aplicação aceita, fora do Git:

- `VITE_SENTRY_DSN`: DSN client-side do projeto production;
- `VITE_APP_RELEASE`: SHA/tag imutável;
- `VITE_SENTRY_TRACES_SAMPLE_RATE`: valor aprovado;
- environment derivado de `VITE_FINANCE_ENV=production`.

Sem DSN, Sentry permanece noop. P5 deve falhar antes do deploy se a observabilidade mínima não estiver configurada e deve validar evento sintético sanitizado após a release.

## Backup, owners e janela

- Release/backup owner: `jadsonlucaas` (repository owner), a confirmar na Issue de P5.
- Rollback/incident owner primário: `jadsonlucaas`; um segundo executor deve ser registrado na Issue de P5.
- Janela: 60 minutos, sendo até 30 minutos para release/smoke e pelo menos 30 minutos de observação.
- Retenção mínima do backup pré-release: 30 dias.
- Backup: export abrangente do Firestore antes da primeira mutação; registrar destino protegido, horário, manifest/hash e validação de leitura.
- Configurações Auth, Rules, indexes e versão Hosting devem ser inventariadas separadamente, pois não fazem parte do export de dados.
- Restore real permanece proibido durante preflight e smoke.

Se owner, segundo executor, janela calendarizada, destino protegido ou validação do backup não estiverem registrados antes da mutação: parar P5.

## Sequência bloqueante de P5

1. CI verde no SHA candidato e worktree limpo.
2. Registrar SHA, owners, janela, versão Hosting atual e autorização explícita.
3. Injetar envs production/Sentry pelo ambiente seguro.
4. Executar o guard e build; repetir scan de segredos/isolamento.
5. Criar e validar backup pré-release.
6. Se necessário, aplicar indexes isoladamente e aguardar `READY`.
7. Se necessário, aplicar Rules homologadas isoladamente e executar smoke de autorização.
8. Fazer deploy somente de Hosting com `--project finance-control-cce4f` explícito.
9. Executar imediatamente `docs/production-smoke.md`.
10. Acionar `docs/production-rollback.md` ao primeiro critério de rollback.

Qualquer divergência do target, SHA, hashes, owners ou configuração muda a decisão para **NO-GO**.
