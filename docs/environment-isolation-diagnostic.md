# Diagnóstico de isolamento de ambientes Firebase — etapa 7.3H

## Resultado

O isolamento local foi validado em 17/10/2026. Esta validação não homologa staging nem produção.

## Sintoma e causa raiz

Um E2E local inicializou o SDK com `finance-control-cce4f`. O valor vinha do `FIREBASE_CONFIG` hardcoded de `src/services/firebase.js`: `createFirebaseService` escolhia `emulatorConfig() || environmentConfig() || config`, portanto a ausência das variáveis no `webServer` genérico terminava silenciosamente no argumento default de produção. Não era cache nem configuração stale. O runner dedicado possuía as variáveis corretas, mas o comando observado usava `playwright.config.js`, que iniciava `npm run dev` sem propagá-las.

## Contrato

| ambiente explícito | projectId obrigatório | emuladores |
| --- | --- | --- |
| `local-e2e` | `demo-finance-control-local-e2e` | Auth `127.0.0.1:9099` e Firestore `127.0.0.1:8080`, obrigatórios |
| `staging` | `finance-control-staging-260919` | proibidos |
| `production` | `finance-control-cce4f` | proibidos |

Ausência de `VITE_FINANCE_ENV`, divergência de projectId ou divergência do modo de emuladores aborta o bootstrap. Não existe mais fallback para produção. O runtime expõe somente o descritor não sensível `window.__financeFirebaseRuntime` para verificação no browser.

## Origem e risco das configurações

| origem | ambiente | projectId | emulator | fallback | risco após correção |
| --- | --- | --- | --- | --- | --- |
| `scripts/start-e2e-local-vite.mjs` | local-e2e | demo local | obrigatório | não | baixo; rejeita sobrescrita conflitante |
| `playwright.e2e-local.config.js` | local-e2e | demo local | obrigatório | não | baixo; teste observa runtime e rede |
| `.env.staging.local` / `.env.staging.example` | staging | staging | proibido | não | baixo; arquivo local permanece ignorado |
| `src/services/firebase.js` | production | produção | proibido | não | condicionado a seleção explícita de production |
| runners Playwright genéricos | local-e2e | demo local | obrigatório | não | baixo; usam o launcher local fail-closed |

## Evidências

- Testes arquiteturais cobrem os três ambientes, env ausente, cruzamentos de projectId e flags de emulator inválidas.
- E2E local completo: 16/16, incluindo inspeção do descritor runtime e captura de rede.
- Hosts permitidos no E2E local: `127.0.0.1` nas portas do Vite, Auth e Firestore.
- A captura falha ao observar IDs de staging/produção ou endpoints cloud de Firestore, Identity Toolkit e Secure Token. Foram observados zero requests cloud e zero requests para produção.
- Regressão local: 47/47; performance: 2/2; Rules e Auth Emulator: verdes no projeto demo.

## Execução segura

- Local E2E: iniciar os emuladores com `--project demo-finance-control-local-e2e --only auth,firestore` e executar `npm.cmd run test:e2e-local`.
- Staging: carregar exclusivamente `.env.staging.local`, validar `finance-control-staging-260919` com o guard e usar `playwright.staging.config.js`. Não foi executado nesta etapa.
- Produção: exige seleção explícita `production`, projectId exato e emuladores desligados. Não foi executada nem acessada nesta etapa.

Decisão: **LOCAL ENVIRONMENT ISOLATION VALIDATED**. Staging: **NOT VALIDATED**. Produção: **NOT READY**.
