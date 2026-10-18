# Contrato do ambiente de staging

Executado em: 19/09/2026

Este contrato prepara o pacote de staging sem criar projeto real, sem login em cloud, sem deploy, sem Firebase real, sem Admin SDK e sem restore real.

## Decisao

Status: READY TO PROVISION STAGING.

Status de producao: NOT READY FOR PRODUCTION DEPLOY.

O ambiente real de staging ainda nao existe neste repositório local. Esta etapa define o contrato que deve ser seguido quando o projeto isolado for criado por processo operacional externo.

## Isolamento obrigatorio

- O projeto de staging deve ser um Firebase project separado de producao.
- Todos os comandos futuros de staging devem usar `--project <staging-project-id>` explicito.
- `.firebaserc` aponta para `finance-control-cce4f`; portanto nao deve ser usado como fonte de alvo para staging.
- `VITE_FINANCE_USE_FIREBASE_EMULATORS=true` e permitido somente nos ensaios locais com projeto `demo-*`.
- O app atual usa `src/services/firebase.js` com configuracao Firebase padrao do projeto existente quando emuladores nao estao ativos. A troca real para staging exige build com configuracao de ambiente revisada antes de qualquer publicacao.
- Nenhum teste, smoke ou importacao de staging pode usar dados reais de producao.

## Variaveis esperadas

| Nome | Staging real | Ensaio local |
| --- | --- | --- |
| `VITE_FIREBASE_PROJECT_ID` | ID do projeto staging | `demo-finance-control-local-e2e` |
| `VITE_FIREBASE_API_KEY` | chave web publica do staging | `demo-key` ou ausente |
| `VITE_FIREBASE_AUTH_EMULATOR_URL` | ausente | `http://127.0.0.1:9099` |
| `VITE_FIRESTORE_EMULATOR_HOST` | ausente | `127.0.0.1` |
| `VITE_FIRESTORE_EMULATOR_PORT` | ausente | `8080` |
| `VITE_FINANCE_USE_FIREBASE_EMULATORS` | ausente ou `false` | `true` |

## Artefatos controlados

- Build local: `dist/`.
- Manifest: `docs/release-candidate-manifest.json`.
- Regras: `firestore.rules`.
- Indices: `firestore.indexes.json`.
- Checklist futuro: `docs/release-deployment-checklist.md`.
- Smoke pos-deploy futuro: `docs/staging-post-deploy-smoke.md`.

## Condicoes negativas

- Deploy executado nesta etapa: nao.
- Firebase real tocado nesta etapa: nao.
- Firestore Rules alteradas nesta etapa: nao.
- Auth/custom claims alterados nesta etapa: nao.
- Regras financeiras alteradas nesta etapa: nao.
- Interface funcional alterada nesta etapa: nao.
