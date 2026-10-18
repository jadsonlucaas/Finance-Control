# Firebase environment safety map

Executado em: 19/09/2026

Objetivo: registrar os identificadores conhecidos antes de qualquer mutacao em Firebase real. Este documento nao contem segredo, token, service account, private key ou credencial pessoal.

## Decisao de alvo

- Projeto de producao conhecido: `finance-control-cce4f`.
- Numero do projeto de producao conhecido: `1050867234579`.
- Projeto staging alvo: `finance-control-staging-260919`.
- Numero do projeto staging: `945561850688`.
- Staging real existente na conta Firebase: criado/conectado por `npx.cmd firebase projects:create finance-control-staging-260919 --display-name "Finance Control Staging"`.
- Firebase Web App staging: `1:945561850688:web:8a00895f04d01d5aa860a5`.
- Hosting default staging: `https://finance-control-staging-260919.web.app`.
- Mutacao Firebase real executada ate este checkpoint: criacao do projeto staging, criacao do Web App staging, habilitacao das APIs `firestore.googleapis.com` e `identitytoolkit.googleapis.com`, criacao do Firestore Database staging, deploy de Rules/Indexes staging e deploy de Hosting staging.
- Comando `firebase use`: nao executado.

## Tabela de seguranca

| tipo | producao conhecida | staging alvo | iguais? | permitido? |
| --- | --- | --- | --- | --- |
| projectId | `finance-control-cce4f` | `finance-control-staging-260919` | nao | sim, somente apos guard passar |
| projectNumber | `1050867234579` | `945561850688` | nao | sim |
| `.firebaserc` alias default | `finance-control-cce4f` | nao usar default | nao aplicavel | nao para staging |
| alias permitido | nao usar | `staging` | nao | sim, somente se mapear para o staging alvo |
| authDomain | `finance-control-cce4f.firebaseapp.com` | `finance-control-staging-260919.firebaseapp.com` | nao | sim |
| storageBucket | `finance-control-cce4f.firebasestorage.app` | `finance-control-staging-260919.firebasestorage.app` | nao | sim |
| messagingSenderId | `1050867234579` | `945561850688` | nao | sim |
| appId web | `1:1050867234579:web:616463d41775696dfc4ce6` | `1:945561850688:web:8a00895f04d01d5aa860a5` | nao | sim |
| measurementId | `G-7ZMJQ7CEH1` | nao criado | nao | nao aplicavel |
| hosting URL | nao versionada no repo | `https://finance-control-staging-260919.web.app` | nao | sim |
| emulator project | nao producao | `demo-finance-control-local-e2e` somente local | nao | permitido somente local |

## Evidencias lidas

- `.firebaserc` aponta `projects.default` para `finance-control-cce4f`.
- `src/services/firebase.js` possui Firebase web config padrao de `finance-control-cce4f`.
- `docs/staging-environment-contract.md` declara que `.firebaserc` nao deve ser usado como fonte de alvo para staging.
- `docs/release-readiness-checkpoint.md` classifica `finance-control-cce4f` como risco operacional de deploy acidental e exige staging separado.
- `npx.cmd firebase projects:list` antes da criacao listou `finance-control-cce4f` e `matsushita-41d78`; nenhum projeto staging explicito foi encontrado.
- `npx.cmd firebase projects:create finance-control-staging-260919 --display-name "Finance Control Staging"` criou o projeto staging com numero `945561850688`.
- `npx.cmd firebase apps:create WEB "Finance Control Staging Web" --project finance-control-staging-260919` criou o Web App staging.
- `npx.cmd firebase apps:sdkconfig WEB 1:945561850688:web:8a00895f04d01d5aa860a5 --project finance-control-staging-260919` confirmou config publica separada da producao.
- API Cloud Firestore foi habilitada somente no staging via credencial local do Firebase CLI.
- `npx.cmd firebase firestore:databases:create "(default)" --location nam5 --project finance-control-staging-260919` criou o database staging em `nam5`.
- `npx.cmd firebase deploy --only firestore:rules,firestore:indexes --project finance-control-staging-260919` publicou Rules/Indexes somente no staging.
- `npx.cmd firebase deploy --only hosting --project finance-control-staging-260919` publicou Hosting somente no staging.
- `npx.cmd playwright test --config=playwright.staging.config.js --reporter=line` confirmou runtime projectId staging e ausencia de requests para producao.

## Guard obrigatorio

O script `scripts/assert-staging-target.mjs` bloqueia:

- alvo vazio;
- aliases ambiguos `default`, `prod` e `production`;
- o projectId de producao `finance-control-cce4f`;
- qualquer projectId fora da allowlist local `finance-control-staging-260919`.

Todo comando real de criacao, deploy de Rules/Indexes ou Hosting desta etapa deve passar por esse guard imediatamente antes de executar.

## Bloqueio operacional atual

Firestore e Hosting de staging foram provisionados e validados de forma parcial. O bloqueio atual e Firebase Auth: a configuracao Email/Password nao existe no projeto (`CONFIGURATION_NOT_FOUND`) e o endpoint de inicializacao `identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED`.

Enquanto Auth nao for inicializado/configurado no projeto staging:

- usuarios sinteticos nao podem ser criados pelo fluxo real de Auth;
- dados sinteticos autenticados nao foram gravados;
- smoke/E2E real autenticado nao foi executado;
- isolamento A -> B permanece pendente;
- status correto: STAGING NOT VALIDATED.
