# Homologacao UX, mobile e acessibilidade - Release 7.2

Executado em: 19/09/2026

Escopo: validacao local em `http://127.0.0.1:5173`, com Playwright e dados sinteticos em memoria. Nenhum Firebase real, deploy, push, pull, fetch, Admin SDK, custom claim real ou restore real foi executado.

## Decisao

Status UX local: READY FOR STAGING.

Status geral para staging: READY TO PROVISION STAGING, condicionado a projeto Firebase de staging isolado e checklist operacional ja documentado.

Status para producao: NOT READY FOR PRODUCTION DEPLOY.

## Cobertura automatizada

Arquivo novo: `tests/playwright/release-ux-accessibility.spec.js`.

| Area | Cobertura 7.2 |
| --- | --- |
| Desktop | Dashboard, Saidas, Entradas, Parcelamentos, Controle de Horas, Importacao, Configuracoes, Novo Lancamento, Planner, Relatorio PDF e Administracao de Usuarios sem overflow horizontal bloqueante e sem controles visiveis sem nome acessivel. |
| Mobile | Dashboard, Saidas, Entradas, Parcelamentos, Controle de Horas, Importacao, Configuracoes e Novo Lancamento sem overflow horizontal bloqueante em viewport `390x844`. |
| Teclado | Acoes primarias do header ativaveis por teclado; foco percorre controles nomeados. |
| Acessibilidade | Varredura local de botoes, links, inputs, selects, textareas e elementos `role=button` visiveis para nome acessivel minimo. |

## Correcoes aplicadas

Foram feitas apenas correcoes pequenas de acessibilidade e identificacao de controles:

- `index.html`: `aria-label`/`title` em abrir e fechar menu.
- `src/ui/records/recordListRenderer.js`: nome acessivel em acoes icon-only de marcar/reabrir e excluir lancamento.
- `src/legacy/inline/part-03.js`: nome acessivel equivalente nas linhas legadas de lancamentos.
- `src/ui/settings/settingsPresenter.js`: nome acessivel para excluir pessoa.
- `src/ui/backup/backupPresenter.js`: nome acessivel no arquivo JSON de restore dry-run.
- `src/ui/templates/views/viewNovoTemplate.js`: nome acessivel no campo de vencimento.
- `src/ui/templates/views/viewConfiguracoesTemplate.js`: nomes acessiveis nos arquivos XLSX de entradas/saidas e competencia de arquivamento.

## Achados

| Severidade | Quantidade final | Situacao |
| --- | ---: | --- |
| Bloqueador | 0 | Nenhum bloqueador local remanescente. |
| Critico | 0 | Corrigidos antes da conclusao da etapa. |
| Moderado | 0 | Nenhum overflow horizontal bloqueante remanescente nos cenarios automatizados. |
| Informativo | 1 | A validacao e local/mocked para UX; persistencia real continua coberta pelos E2E com Auth/Firestore Emulator. |

## Gates executados

| Comando | Resultado |
| --- | --- |
| `npm.cmd run inventory:globals` | Aprovado, exit 0; inventario regenerado com 50 globais/APIs. |
| `npm.cmd test` | Aprovado, exit 0; 113 arquivos de teste e 663 testes passaram. |
| `npm.cmd run build` | Aprovado, exit 0; Vite build concluiu com 1946 modulos transformados. |
| `npm.cmd run smoke` | Aprovado, exit 0; status `ok`, 25 checks em `http://127.0.0.1:5175/`. |
| `npx.cmd playwright test tests/playwright/regression-local.spec.js --reporter=line` | Aprovado, exit 0; 47 testes passaram. |
| `npx.cmd playwright test tests/playwright/release-ux-accessibility.spec.js --reporter=line` | Aprovado, exit 0; 3 testes passaram. |
| `npm.cmd run perf:audit` | Aprovado, exit 0; 2 testes passaram. |
| `npm.cmd run bundle:budget` | Aprovado, exit 0; `ok=true`, entry `375588` bytes, limite `430080`, globais `50`. |
| `npm.cmd run bootstrap:check` | Aprovado, exit 0; `ok=true`, 22 scripts classicos, 22 eval executados, 50 globais. |
| `npm.cmd run bootstrap:benchmark` | Aprovado, exit 0; `ok=true`, sem warnings e sem violacoes. |
| `npm.cmd run library-loader:check` | Aprovado, exit 0; `ok=true`, lazy libraries `xlsx`, `pdf`, `firebase`. |
| `npm.cmd run legacy-loader:check` | Aprovado, exit 0; `ok=true`, 22 scripts classicos, 22 eval executados. |
| `npm.cmd run finance-ui-consumers:check` | Aprovado, exit 0; `ok=true`, sem novas exposicoes globais. |
| `npm.cmd run settings-modernization:check` | Aprovado, exit 0; `ok=true`. |
| `npm.cmd run user-admin-modernization:check` | Aprovado, exit 0; `ok=true`. |
| `npm.cmd run resilience:dry-run` | Aprovado, exit 0; `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run post-commit:dry-run` | Aprovado, exit 0; `ok=true`, `wrote=false`, `firebase_touched=false`. |
| `npm.cmd run audit:dry-run` | Aprovado, exit 0; `ok=true`, 8 fixtures validas e 2 invalidas esperadas. |
| `node scripts/analyze-legacy-loader.mjs` | Aprovado, exit 0; `ok=true`, 22 scripts classicos, 22 eval executados. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only firestore "npm.cmd run test:rules"` | Aprovado, exit 0; logs de `PERMISSION_DENIED`, limite de avaliacao e trace do Emulator fazem parte dos cenarios negativos/conhecidos. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:auth-flow"` | Aprovado, exit 0; 1 arquivo e 20 testes passaram. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado, exit 0; 15 testes passaram. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/release-readiness-smoke.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado, exit 0; 1 teste passou. |

## Lacunas

- A spec 7.2 nao substitui homologacao manual em staging real.
- A validacao nao usa `axe-core`, conforme restricao do prompt e dependencias atuais.
- Comparacao visual pixel-perfect e leitores de tela reais permanecem fora desta etapa.
- Fluxos com persistencia real continuam dependendo das suites E2E locais com Auth Emulator e Firestore Emulator.

## Confirmacoes negativas

- Regras financeiras alteradas: nao.
- Firestore Rules alteradas: nao.
- Auth/custom claims alterados: nao.
- Deploy executado: nao.
- Firebase real acessado: nao.
- Push/pull/fetch executado: nao.
