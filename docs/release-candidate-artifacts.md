# Artefatos do release candidate local

Executado em: 19/09/2026

Este documento lista os artefatos produzidos para preparar staging. O manifest tecnico gerado fica em `docs/release-candidate-manifest.json`.

## Artefatos

| Artefato | Origem | Finalidade |
| --- | --- | --- |
| `dist/` | `npm.cmd run build` | build local do release candidate |
| `docs/release-candidate-manifest.json` | `node scripts/generate-release-manifest.mjs` | manifest com commit, hashes, budgets e flags negativas |
| `firestore.rules` | repositorio | regras a revisar/aplicar futuramente em staging |
| `firestore.indexes.json` | repositorio | indices a revisar/aplicar futuramente em staging |
| `docs/staging-environment-contract.md` | documental | contrato de isolamento |
| `docs/staging-provisioning-plan.md` | documental | plano futuro de criacao/configuracao |
| `docs/staging-synthetic-data-plan.md` | documental | massa ficticia |
| `docs/staging-post-deploy-smoke.md` | documental | smoke futuro em staging |
| `docs/staging-rollback-rehearsal.md` | documental | ensaio de rollback sem restore real |
| `docs/staging-go-no-go.md` | documental | criterios de decisao |

## Observacoes

- O manifest nao deve conter caminhos locais, credenciais ou service account.
- O manifest registra `deployExecuted=false`, `firebaseRealTouched=false` e `restoreRealEnabled=false`.
- A presenca de `.firebaserc` com projeto default existente e tratada como risco operacional e exige `--project` explicito em qualquer etapa futura.
