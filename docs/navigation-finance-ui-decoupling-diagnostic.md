# Diagnostico de desacoplamento da navegacao `financeUI`

Executado em: 12/09/2026

## Baseline local confirmado

- Branch: `melhoria-arquitetura`
- HEAD inicial 5.19: `775273a test: comprova navegacao canonica e inventario de bridges`
- Remote: vazio
- Worktree inicial: limpa
- Classic/eval: `22/22`
- APIs globais top-level antes da etapa: `50`

## Caminho anterior

Antes da etapa 5.19, a navegacao ja nao chamava `window.financeUI.activateTab` nem `window.financeApp.financeUiAdapters.activateTab`, mas `src/legacy/inline/part-08.js` continha o helper `activateLegacyTabView(tab)`.

Esse helper classico duplicava a implementacao visual canonica ao trocar classes de `#main-tabs button` e alternar `hidden` nos elementos `#view-*`.

## Caminho posterior

1. `src/legacy/classicScripts.js` avalia o bundle legado como antes.
2. `installNavigationCoordinator(target)` e chamado antes de `src/ui/router.js`.
3. A bridge publica existente `window.switchTab(tab, options = {})` passa a ser coordenada por `src/ui/navigation/navigationCoordinator.js`.
4. O coordenador chama o `switchTab` classico anterior como continuacao para preservar `tabHistory`, `currentTab`, `updateBackButton()`, `renderCurrentTab()` e fechamento de sidebar.
5. Em seguida, delega a ativacao visual para `src/ui/navigationTabs.js:activateTab`.
6. `src/ui/router.js` envolve o `switchTab` ja coordenado e preserva o comportamento de hash.
7. Os wrappers de lazy load continuam em `src/app.js` e permanecem depois do router.

## Fronteiras preservadas

| Area | Estado |
| --- | --- |
| Ativacao visual | `src/ui/navigationTabs.js:activateTab` via `navigationCoordinator.js` |
| Bridge publica | `window.switchTab(tab, options = {})` preservada |
| Router/hash | Preservado em `src/ui/router.js`; nenhum novo router criado |
| Lazy load | Preservado em `src/app.js` e renderizadores existentes |
| Renderizacao | `renderCurrentTab()` preservado |
| Sidebar | Fechamento preservado pelo `switchTab` classico anterior |
| Globais | Nenhum novo global top-level; nenhuma nova propriedade em `financeApp` |
| Autorizacao | Nao alterada |
| Efeitos financeiros | Nenhum efeito financeiro foi movido ou alterado |

## Chamadas e bridges

- `part-08.js`: `window.financeUI` permanece `0`.
- `part-08.js`: `window.financeApp.financeUiAdapters.activateTab` permanece `0`.
- `part-08.js`: `activateLegacyTabView` foi removido.
- `navigationBridgeConsumers=[]` no `npm run finance-ui-consumers:check`.
- Atualizacao 5.20: `window.financeUI` nao e mais instalada; as propriedades aninhadas em `window.financeApp.financeUiAdapters` continuam por compatibilidade.
- Consumidores runtime indiretos remanescentes por `window.financeApp.financeUiAdapters`: `part-03.js`, `part-07.js` e `part-29.js`.
- A remocao de `window.financeUI` ou `financeUiAdapters` continua fora do escopo desta etapa.

## Contrato caracterizado

O teste Playwright `legacy navigation preserves hash router, back and sidebar behavior` agora comprova:

- `window.switchTab('saidas')` atualiza `location.hash` para `#/saidas` via router;
- o `hashchange` ativa visualmente a aba e exibe `#view-saidas`;
- repetir a mesma aba preserva a tela ativa;
- `dashboard -> saidas -> entradas -> goBackTab()` retorna para `#/saidas` usando browser history;
- navegar com sidebar aberta fecha o overlay/sidebar;
- `financeUI.activateTab` e `financeUiAdapters.activateTab` nao sao consultados.

## Limitacoes

`part-03.js`, `part-07.js` e `part-29.js` ainda possuem consumidores de `financeUiAdapters` fora da navegacao. Eles permanecem fora do escopo desta etapa.

`part-08.js:switchTab` foi mantido como fallback classico minimo para reduzir risco em carregamentos parciais e preservar o contrato textual do bundle legado, mas a navegacao efetiva do runtime passa pelo coordenador ES instalado antes do router.

Nenhuma regra financeira, payload, persistencia, auth, Firestore Rule, idempotencia, auditoria, reconciliacao pos-commit, loader de biblioteca, benchmark, WhatsApp, webhook, telefone, provider externo ou Admin SDK foi alterado.
