# Politica de Migracao da UI Legada

## Objetivo

Migrar utilitarios visuais de `src/ui/legacy-ui.js` para ES Modules sem alterar comportamento visual, IDs, classes, markup, regras financeiras, autenticacao, Firestore Rules ou persistencia.

## Regras

- `window.financeUI` so pode ser removido depois de busca completa de consumidores em `src/legacy/inline`, `src/ui`, templates, testes e smoke.
- Helpers DOM simples devem reutilizar `src/ui/dom.js`.
- Toast legado deve preservar `#toast`, classes, duracao e semantica enquanto houver consumidor classico.
- Overlays devem preservar idempotencia, parent em `body` e classes existentes.
- Navegacao/tabs nao deve ser reescrita enquanto `part-03.js` controlar historico e sidebar.
- Bridges globais ainda publicas devem ser instaladas por `bridgeRegistry`; `financeUI` nao deve voltar a ser registrada como global.
- Nenhuma funcao de UI pode importar `dataSdk`, Firebase, `src/domain` financeiro ou regras de autenticacao.
- Modulos modernos nao devem importar `src/ui/legacy-ui.js`; somente o loader legado pode instalar a bridge durante a fase de compatibilidade.
- Modulos modernos tambem nao devem consumir `window.financeUI` nem `window.financeApp.financeUiAdapters`; visual moderno deve usar imports ES ou dependencias injetadas.
- `classic/eval`, globais e budget nao podem aumentar.

## Estado atual

`src/ui/legacy-ui.js` e ES Module e instala apenas os adapters aninhados por `installLegacyUiBridge(target)`. O arquivo saiu do loader classico e a exposicao publica `window.financeUI` foi aposentada; `window.financeApp.financeUiAdapters` permanece para consumidores classicos remanescentes.

## Remocao futura dos adapters aninhados

Para remover `financeApp.financeUiAdapters`, todos os itens abaixo devem estar verdadeiros:

- `part-03.js`, `part-07.js`, `part-08.js`, `part-14.js` e `part-29.js` nao chamam mais `window.financeUI`.
- Fallbacks modernos usam imports explicitos.
- Playwright cobre navegacao, sidebar, overlays, toast e troca de usuario.
- Smoke cobre dashboard, entradas, saidas, configuracoes e modais.
- `npm run legacy-loader:check`, `npm run bootstrap:benchmark` e `npm run bundle:budget` aprovam.

## Atualizacao de consumidores - 12/09/2026

`part-03.js` e `part-29.js` ja nao chamam `window.financeUI` diretamente. Chamadas visuais seguras devem continuar usando `window.financeApp.financeUiAdapters` ate que esses scripts sejam convertidos para ES Modules ou que exista um contrato moderno equivalente.

`window.financeUI` ainda nao podia ser removida naquele lote porque `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos permaneciam consumidores runtime. A remocao da exposicao publica exigia `npm run finance-ui-consumers:check` aprovado e busca completa de consumidores.

## Atualizacao de consumidores modernos - 12/09/2026

`src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` nao dependem mais de `window.financeUI` nem de `window.financeApp.financeUiAdapters`. `part-07.js` tambem nao chama mais `window.financeUI` diretamente e usa o adapter visual temporario por ainda estar no pacote classico.

Estado atual apos a etapa de navegacao: `part-08.js` e `part-14.js` nao chamam mais `window.financeUI` diretamente, e `part-08.js:switchTab` nao chama `financeUI.activateTab` nem `financeUiAdapters.activateTab`.

## Atualizacao 5.20 - aposentadoria de `window.financeUI`

`window.financeUI` nao e mais instalada no runtime. `installLegacyUiBridge(target)` preserva a implementacao ES e instala somente `window.financeApp.financeUiAdapters`, necessario para `part-03.js`, `part-07.js` e `part-29.js`.

Qualquer remocao futura dos adapters aninhados exige busca completa de consumidores, regressao de navegacao/sidebar/toast/overlays/listagens, smoke, Playwright, `finance-ui-consumers:check`, `legacy-loader:check` e `bundle:budget` aprovados.
