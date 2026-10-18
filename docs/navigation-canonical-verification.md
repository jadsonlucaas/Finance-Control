# Verificacao canonica da navegacao

Executado em: 12/09/2026

## Baseline confirmado

- Branch: `melhoria-arquitetura`
- HEAD inicial da auditoria 5.19: `775273a test: comprova navegacao canonica e inventario de bridges`
- Worktree inicial: limpa
- Remote: vazio

## Caminho runtime efetivo

1. Clique real em `#main-tabs` e tratado por `src/ui/legacy-events.js`.
2. O handler chama a bridge publica existente `window.switchTab(button.dataset.tab)`.
3. `src/ui/router.js` envolve `window.switchTab`; chamadas de UI atualizam `location.hash`.
4. O `hashchange` chama `window.switchTab(tab, { fromRouter: true })`.
5. Os wrappers de lazy load em `src/app.js` chamam o `switchTab` anterior e, quando `options.fromRouter` esta ativo, disparam o loader da tela lazy aplicavel.
6. O `switchTab` capturado pelo router e instalado por `src/ui/navigation/navigationCoordinator.js`.
7. O coordenador chama o `switchTab` classico anterior como continuacao para preservar historico, `currentTab`, `updateBackButton()`, `renderCurrentTab()` e fechamento de sidebar.
8. A ativacao visual e delegada diretamente para `src/ui/navigationTabs.js:activateTab`.
9. Os lazy loaders continuam externos ao coordenador.

## Coordenador ES

`src/legacy/classicScripts.js` carrega os scripts classicos, instala a bridge global existente e, antes de importar `src/ui/router.js`, chama `installNavigationCoordinator(target)`.

O coordenador:

- preserva a superficie publica `window.switchTab(tab, options = {})`;
- nao cria novo global top-level;
- nao cria nova propriedade em `window.financeApp`;
- nao chama `window.financeUI.activateTab`;
- nao chama `window.financeApp.financeUiAdapters.activateTab`;
- chama o `switchTab` classico anterior para manter historico, renderizacao e sidebar no legado;
- chama `navigationTabs.activateTab(tab, target)` para botoes e `#view-*`.

## Remocao da duplicacao visual

O helper classico `activateLegacyTabView(tab)` foi removido de `src/legacy/inline/part-08.js`.

`part-08.js:switchTab` permanece como fallback classico minimo, sem ativacao visual local. No runtime normal, `window.switchTab` e substituido pelo coordenador ES antes do router e dos wrappers de lazy load passarem a usa-lo.

## Bridges e consumidores restantes

Resultado do checker atualizado:

- consumidores diretos de `window.financeUI`: nenhum;
- consumidores de `window.financeApp.financeUiAdapters`: `src/legacy/inline/part-03.js`, `src/legacy/inline/part-07.js`, `src/legacy/inline/part-29.js`;
- consumidores de navegacao por `financeUI.activateTab` ou `financeUiAdapters.activateTab` em `part-08.js`: nenhum;
- duplicacao visual classica em `part-08.js`: removida;
- coordenador ES: `src/ui/navigation/navigationCoordinator.js`;
- implementacao canonica: `src/ui/navigationTabs.js:activateTab`;
- aliases/dinamicos nao resolvidos no conjunto auditado: nenhum.

## Caracterizacao adicionada

Playwright:

- `legacy navigation preserves hash router, back and sidebar behavior` comprova que `switchTab` nao consulta `financeUI.activateTab` nem `financeUiAdapters.activateTab`;
- o fluxo cobre aba valida, repeticao da mesma aba, `goBackTab`, sidebar e aba desconhecida.

Vitest:

- `tests/ui/navigationCoordinator.test.js` cobre coordenacao de estado, ativacao visual, renderizacao e sidebar;
- `tests/architecture/financeUiConsumersCheck.test.js` rejeita retorno por bridge global e rejeita helper visual classico duplicado;
- `tests/ui/navigationLazyLoad.test.js` continua cobrindo delayed A -> B -> C, saida antes da conclusao do loader, troca de sessao durante carregamento e falha com retry.

## Bloqueios restantes

- Remover `window.financeUI` exige migrar ou substituir consumidores de `financeUiAdapters` em `part-03`, `part-07` e `part-29`.
- `src/legacy/inline/part-03.js` ainda contem um `switchTab` textual antigo com adapter visual, mas ele e sobrescrito depois por `part-08` e pelo coordenador; a remocao textual exige etapa propria para reduzir risco no bundle classico concatenado.
- A navegacao ainda depende de `router.js`, wrappers de lazy load e renderizadores legados; esta etapa nao cria novo router nem novo historico.

Nenhuma regra financeira, Auth, Firestore Rule, payload, persistencia, idempotencia, auditoria, reconciliacao pos-commit, WhatsApp, webhook, telefone, provider externo ou Admin SDK foi alterado.
