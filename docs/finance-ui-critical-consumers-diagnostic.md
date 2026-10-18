# Diagnostico de consumidores criticos `financeUI`

Executado em: 12/09/2026

## Baseline local confirmado

- Branch: `melhoria-arquitetura`
- HEAD inicial: `26b9b87 refactor: remove financeUI dos modulos modernos`
- Remote: vazio
- Worktree inicial: limpa
- Entry: `375011` bytes contra budget `430080`
- Classic/eval: `22/22`
- Bytes legados: `747119`
- APIs globais top-level: `50`

## Metodo

Foram auditadas as 13 chamadas diretas informadas em `src/legacy/inline/part-08.js` e `src/legacy/inline/part-14.js`. A contagem considera chamadas textuais diretas a `window.financeUI`, sem contar `window.financeApp.financeUiAdapters` como eliminacao de dependencia global.

O teste de caracterizacao `legacy settings fallback renders people and macros without active UI loader` foi executado antes da migracao e passou. Ele forca falha do loader moderno de Configuracoes para exercitar o fallback classico real, com fixtures sinteticas de pessoa, salario historico e macros global/pessoal.

## Chamadas auditadas

| Chamada anterior | Funcao envolvente | Evento/fluxo | DOM alterado | Efeitos proximos | Classe | Decisao |
| --- | --- | --- | --- | --- | --- | --- |
| `part-08:11 window.financeUI.setHtml('pessoas-list', '')` | `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-list` | limpa lista vazia | A | Migrada para `pessoasList.innerHTML = ''` |
| `part-08:12 window.financeUI.setHidden('pessoas-empty', false)` | `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-empty` | exibe empty state | A | Migrada para `pessoasEmpty.classList.toggle('hidden', false)` |
| `part-08:14 window.financeUI.setHidden('pessoas-empty', true)` | `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-empty` | oculta empty state | A | Migrada para DOM local |
| `part-08:15 window.financeUI.setHtml('pessoas-list', pessoas.map(...))` | `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-list` | renderiza pessoa, salario vigente, botoes | B | Migrada para DOM local; HTML/calculos existentes preservados |
| `part-08:27 window.financeUI.setHtml('macro-list', '')` | `renderConfiguracoes` | fallback da aba Configuracoes | `#macro-list` | limpa lista vazia | A | Migrada para DOM local |
| `part-08:28 window.financeUI.setHidden('macro-empty', false)` | `renderConfiguracoes` | fallback da aba Configuracoes | `#macro-empty` | exibe empty state | A | Migrada para DOM local |
| `part-08:30 window.financeUI.setHidden('macro-empty', true)` | `renderConfiguracoes` | fallback da aba Configuracoes | `#macro-empty` | oculta empty state | A | Migrada para DOM local |
| `part-08:31 window.financeUI.setHtml('macro-list', macros.map(...))` | `renderConfiguracoes` | fallback da aba Configuracoes | `#macro-list` | renderiza badges Global/Pessoal e exclusao condicional | B | Migrada para DOM local; autorizacao existente preservada |
| `part-08:48 window.financeUI.activateTab(tab)` | `switchTab` | clique em tabs, router, smoke, Playwright | `#main-tabs`, `#view-*` | historico, render tab, sidebar/router/lazy loaders | C | Resolvida; ativacao visual agora passa por `navigationCoordinator.js` -> `navigationTabs.js:activateTab` |
| `part-14:110 window.financeUI.setHtml('pessoas-list', '')` | override `renderConfiguracoes` | fallback da aba Configuracoes apos recebimento quinzenal | `#pessoas-list` | limpa lista vazia | A | Migrada para DOM local |
| `part-14:111 window.financeUI.setHidden('pessoas-empty', false)` | override `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-empty` | exibe empty state | A | Migrada para DOM local |
| `part-14:113 window.financeUI.setHidden('pessoas-empty', true)` | override `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-empty` | oculta empty state | A | Migrada para DOM local |
| `part-14:114 window.financeUI.setHtml('pessoas-list', pessoas.map(...))` | override `renderConfiguracoes` | fallback da aba Configuracoes | `#pessoas-list` | renderiza salario, historico e tipo de recebimento | B | Migrada para DOM local; calculos e payloads preservados |

## Tabela de equivalencia

| Chamada anterior | Caminho novo | Bridge ainda envolvida | Teste de equivalencia | Limitacao |
| --- | --- | --- | --- | --- |
| `setHtml/setHidden` de pessoas em `part-08` | DOM local em `renderConfiguracoes` | Nao para essas chamadas | Playwright fallback legado de Configuracoes | `part-14` sobrepoe a lista de pessoas apos `_currentRenderConfiguracoes` |
| `setHtml/setHidden` de macros em `part-08` | DOM local em `renderConfiguracoes` | Nao para essas chamadas | Playwright fallback legado de Configuracoes | Render legado continua fallback, nao UI principal |
| `setHtml/setHidden` de pessoas em `part-14` | DOM local no override de `renderConfiguracoes` | Nao para essas chamadas | Playwright fallback legado de Configuracoes | Mantem HTML legado e escaping existente |
| `activateTab` em `part-08` | `navigationCoordinator.js` -> `navigationTabs.js:activateTab` | Nao para `switchTab` | Playwright `legacy navigation preserves hash router, back and sidebar behavior` | `part-08` permanece como fallback classico minimo; runtime efetivo usa coordenador ES |

## Resultado

- Chamadas diretas `window.financeUI` em `part-08`: `9 -> 0`
- Chamadas diretas `window.financeUI` em `part-14`: `4 -> 0`
- Reducao real de acoplamento: 13 chamadas deixaram de depender de `window.financeUI` ou `financeUiAdapters`.
- Consolidacao global: nenhuma chamada nova para `financeUiAdapters` foi criada.
- Consumidor direto remanescente nos arquivos criticos: nenhum.
- Atualizacao 5.20: apos auditoria de consumidores, `window.financeUI` nao e mais instalada. As propriedades aninhadas em `window.financeApp.financeUiAdapters` permanecem por compatibilidade com `part-03.js`, `part-07.js` e `part-29.js`.

## Bloqueios

`part-08.js:switchTab` permanece como fallback classico, mas o runtime efetivo passa por `navigationCoordinator.js`, que chama essa continuacao classica para preservar historico, renderizacao, router, lazy loaders e fechamento de sidebar. Migrar o `switchTab` inteiro exige um lote proprio para substituir `tabHistory`/`isSidebarOpen` lexicais por dependencias explicitas.

Nenhuma regra financeira, payload, persistencia, auth, Firestore Rule, idempotencia, auditoria, reconciliacao pos-commit, loader de biblioteca, benchmark ou integracao externa foi alterada.
