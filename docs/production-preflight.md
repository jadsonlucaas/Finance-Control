# Preflight de produção para o primeiro go-live

Executado em: 31/10/2026

Issue: #17 — `release: preparar ambiente de produção para primeiro go-live`.

## Decisão

Status: **NO-GO / PRODUCTION NOT READY**.

Este preflight foi somente leitura. Nenhum deploy, criação de release, alteração de Auth, escrita Firestore, publicação de Rules/Indexes ou mutação de Hosting foi executado.

## Identidade do ambiente

| Item | Evidência | Estado |
| --- | --- | --- |
| Firebase projectId | `finance-control-cce4f` | confirmado |
| Project number | `1050867234579` | confirmado |
| Web App pretendido | `Finance Control`, app ID `1:1050867234579:web:c0e9456b8e45d3e5fc4ce6` | confirmado |
| Hosting site | `finance-control-cce4f` | confirmado |
| URL padrão | `https://finance-control-cce4f.web.app` | confirmado |
| Vínculo Hosting → Web App | app ID `1:1050867234579:web:c0e9456b8e45d3e5fc4ce6` | confirmado |
| Domínio customizado | nenhum cadastrado | pendente de decisão; não bloquear se a URL padrão for o domínio aprovado |
| Canal live | existe, sem releases listadas | confirmado; primeiro go-live ainda não ocorreu |

Existem dois Web Apps ativos no projeto. O go-live deve usar somente o app vinculado ao Hosting (`Finance Control`). O app adicional `finance-control-web` não deve ser selecionado por engano.

## Auth

- Email/Password: habilitado.
- Password required: habilitado.
- Domínios autorizados atuais: `localhost`, `finance-control-cce4f.firebaseapp.com` e `finance-control-cce4f.web.app`.
- Outros providers: não confirmados neste preflight e não devem ser habilitados implicitamente.
- Domínio customizado futuro exige inclusão explícita em Authorized Domains antes do smoke.

Estado: **aprovado para a URL padrão**, condicionado a usuário sintético de smoke e owner operacional definidos.

## Firestore

| Item | Estado remoto |
| --- | --- |
| Database | `(default)`, `FIRESTORE_NATIVE` |
| Região | `southamerica-east1` |
| Concurrency | `PESSIMISTIC` |
| Delete protection | desabilitada |
| Rules release | `projects/finance-control-cce4f/releases/cloud.firestore` |
| Ruleset atual | `62167b62-f34f-45cc-8f99-fad42ab803af` |
| Índices compostos aplicados | 0 |

### Rules pretendidas

- Arquivo: `firestore.rules`.
- SHA-256 do arquivo no repositório: `BDC1F8D8B5D3FFCF399483BF72A6A6531757BD607351EADA1981C2D979BAD5F9`.
- Rules remotas: 194 linhas.
- Rules pretendidas: 736 linhas.
- Comparação normalizada: diferente.

Estado: **BLOCKER**. O ruleset remoto não corresponde às Rules pretendidas. A diferença deve ser revisada e aprovada antes de qualquer publicação futura; este preflight não autoriza deploy de Rules.

### Indexes pretendidos

`firestore.indexes.json` define três índices de `users`:

1. `status ASC, email ASC`;
2. `role ASC, email ASC`;
3. `status ASC, role ASC, email ASC`.

SHA-256: `229167F1A944093DE01CE65DB86F591BA56B1C6756909D53016EA2E584825DE5`.

Produção possui zero índices compostos aplicados. Estado: **BLOCKER**.

## Variáveis de build de produção

As variáveis devem vir do ambiente seguro da pipeline; nenhum `.env*.local` pode ser versionado.

| Variável | Contrato |
| --- | --- |
| `VITE_FINANCE_ENV` | exatamente `production` |
| `VITE_FINANCE_USE_FIREBASE_EMULATORS` | exatamente `false` |
| `VITE_FIREBASE_PROJECT_ID` | exatamente `finance-control-cce4f` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `finance-control-cce4f.firebaseapp.com` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `finance-control-cce4f.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1050867234579` |
| `VITE_FIREBASE_APP_ID` | `1:1050867234579:web:c0e9456b8e45d3e5fc4ce6` |
| `VITE_FIREBASE_API_KEY` | configuração web pública obtida do Web App correto; não registrar em documentação/logs |
| `VITE_FIREBASE_MEASUREMENT_ID` | opcional, somente se aprovado |
| `VITE_SENTRY_DSN` | DSN client-side do projeto Sentry de produção; pendente |
| `VITE_APP_RELEASE` | SHA/tag imutável da release; pendente |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | valor aprovado para produção; pendente |

É proibido definir no build de produção: URLs/ports de emulator, `demo-*`, `finance-control-staging-260919` ou credenciais de usuário.

## Fail-closed

O runtime atual exige `VITE_FINANCE_ENV`, configuração Firebase completa, projectId igual ao contrato do ambiente e flag de emulator coerente. Configuração ausente, parcial ou cruzada lança erro e impede conexão silenciosa.

Lacuna operacional: `.firebaserc` usa produção como `default`. Não existe guard dedicado de deploy de produção. Todo comando futuro deve usar `--project finance-control-cce4f` explícito e uma etapa de aprovação humana; depender do default é proibido. Estado: **BLOCKER de processo** até o gate ser automatizado na pipeline aprovada.

## Sentry production

O PR #15 de observabilidade está aberto e não mesclado em `main`. A base atual não contém `@sentry/browser`, DSN de produção, release tagging nem projeto Sentry de produção confirmado.

Estado: **BLOCKER**. Antes do go-live:

- mesclar/revalidar a camada de observabilidade;
- criar/confirmar projeto Sentry exclusivo de produção;
- configurar DSN somente na pipeline;
- manter `sendDefaultPii=false` e sanitização de dados financeiros/PII;
- confirmar captura de erro sintético e release no smoke, sem payload sensível.

## Inspeção do bundle local

Build executado localmente com a configuração pública do Web App de produção:

- build: aprovado;
- padrões de private key, service account, GitHub token, client secret ou chave de provider: 0;
- dependência Sentry na base: ausente;
- ocorrências do ID de staging no bundle: 1;
- evidências de projeto/endpoint local-emulator no bundle: 1.

Estado: **BLOCKER**. O bundle só pode ser promovido quando a varredura retornar zero para staging e emulator/local. Firebase Web API key e Sentry DSN são identificadores client-side, mas não substituem a regra de não incluir credenciais ou segredos server-side.

## Validação local do candidato

Executada em 31/10/2026, sem deploy:

- `npm test`: 115 arquivos e 673 testes aprovados;
- `npm run bundle:budget`: aprovado, entry `375588` bytes, Firebase `167177` bytes, maior chunk `449417` bytes e 50 globals;
- `npm run bootstrap:check`: aprovado, 22 scripts clássicos, 22 scripts executados por eval e `wrote=false`;
- `npm run smoke`: aprovado com 25 checks locais.

Esses resultados validam o candidato local, mas não eliminam os blockers de ambiente, configuração e promoção descritos neste documento.

## Backup pré-release

Nenhum backup de produção foi criado nesta etapa. O backup client-side é owner-scoped e restore real permanece bloqueado; ele não substitui um backup abrangente do Firestore.

Estado: **BLOCKER**. Antes do go-live, definir e executar por processo confiável:

- mecanismo de snapshot/export abrangente;
- destino, criptografia, retenção e acesso;
- hash/manifest e horário do backup;
- teste de leitura/validação sem restaurar em produção;
- owner e aprovador;
- plano para configurações Auth, Rules, indexes e Hosting, que não são cobertos pelo snapshot de dados.

## Rollback, smoke e ownership

- Runbook de rollback: `docs/production-rollback.md`.
- Smoke pós-release: `docs/production-smoke.md`.
- Release owner: **não definido — BLOCKER**.
- Incident/rollback owner: **não definido — BLOCKER**.
- Janela de release e canal de comunicação: **não definidos — BLOCKER**.
- PR #16 com a evidência final de staging segue aberto e não mesclado em `main`: **BLOCKER de promoção**.

## Gates obrigatórios para mudar para GO

- [ ] PR #16 e dependências aprovados/mesclados na release candidate.
- [ ] Rules pretendidas revisadas e plano de aplicação/rollback aprovado.
- [ ] Três índices compostos aplicados e `READY` antes da aplicação depender deles.
- [ ] Sentry production configurado e sanitização revalidada.
- [ ] Bundle sem staging ID, demo project ou endpoints de emulator.
- [ ] Scan de segredos do artefato aprovado.
- [ ] Backup pré-release abrangente gerado e verificado.
- [ ] Release owner, rollback owner, janela e comunicação definidos.
- [ ] Candidato exato identificado por commit/tag e artefato imutável.
- [ ] Smoke e critérios de rollback assinados.
- [ ] Aprovação explícita separada para deploy.

Até todos os itens acima estarem concluídos: **NO DEPLOY**.
