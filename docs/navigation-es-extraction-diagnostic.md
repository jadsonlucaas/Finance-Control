# Diagnostico de extracao ES da coordenacao de navegacao

Executado em: 12/09/2026

## Objetivo da etapa

Extrair apenas a coordenacao de navegacao visual de `src/legacy/inline/part-08.js` para ES Modules, mantendo a bridge publica `window.switchTab(tab, options = {})`.

## Arquivos de runtime alterados

- `src/ui/navigation/navigationCoordinator.js`: novo coordenador ES.
- `src/legacy/classicScripts.js`: instala o coordenador depois do bundle classico e antes do router.
- `src/legacy/inline/part-08.js`: remove o helper visual classico `activateLegacyTabView`.

## Caminho final

`legacy-events` ou consumidores classicos -> `window.switchTab` existente -> `router.js`/hash -> `navigationCoordinator.js` -> `switchTab` classico anterior para historico/render/sidebar -> `navigationTabs.js:activateTab` -> lazy loaders.

Observacao: o router ainda envolve `window.switchTab` apos o coordenador ser instalado. Sem `fromRouter`, o router continua convertendo a chamada em mudanca de hash; no `hashchange`, ele chama o coordenador com `fromRouter`.

## O que foi preservado

- Nenhum novo router.
- Nenhum novo historico externo ao router existente.
- Nenhum novo global top-level.
- Nenhuma nova propriedade em `window.financeApp`.
- Nenhum retorno por `window.financeUI.activateTab`.
- Nenhum retorno por `window.financeApp.financeUiAdapters.activateTab`.
- `renderCurrentTab()` permanece no legado.
- Wrappers de lazy load de `controle-horas` e `parcelamentos` permanecem em `src/app.js`.
- Atualizacao 5.20: `window.financeUI` nao e mais instalada; `financeUiAdapters` permanece por compatibilidade, mas nao e usado pela navegacao de `part-08`.
- `tabHistory`, `currentTab`, `updateBackButton()`, `renderCurrentTab()` e fechamento de sidebar continuam na continuacao classica anterior, sem historico paralelo no coordenador.

## Caracterizacao antes da mudanca

- `npm.cmd test -- tests/ui/navigationLazyLoad.test.js tests/playwright/regression-local.spec.js`: passou para o arquivo unitario `tests/ui/navigationLazyLoad.test.js` com 4 testes; o arquivo Playwright nao e executado pelo Vitest por nao conter testes Vitest.
- `npm.cmd run finance-ui-consumers:check`: passou e reportou `navigationEvidenceStatus` bloqueado por helper visual classico duplicado.

## Caracterizacao depois da mudanca

- `tests/ui/navigationCoordinator.test.js` cobre a composicao do coordenador com a continuacao classica anterior.
- `tests/architecture/financeUiConsumersCheck.test.js` rejeita helper visual classico duplicado.
- `tests/playwright/regression-local.spec.js` comprova que o `switchTab` efetivo tem o marcador do coordenador ES e nao usa bridges visuais globais.
- `npm run finance-ui-consumers:check` passa com:
  - `navigationCoordinatorUsesCanonical: true`;
  - `part08HasClassicVisualActivation: false`;
  - `navigationBridgeConsumers: []`;
  - `newGlobalExposures: []`.

## Fora do escopo

- Remover `window.financeUI`.
- Remover `window.financeApp.financeUiAdapters`.
- Converter `part-03`, `part-07`, `part-29` ou `part-08` inteiro.
- Alterar calculos financeiros, Auth, Firestore Rules, persistencia, importacao, backup/restore, PDF, horas, parcelamentos, recorrencias, tributos, auditoria ou reconciliacao pos-commit.

## Riscos residuais

- `src/legacy/inline/part-03.js` ainda contem um `switchTab` textual antigo com chamada a `financeUiAdapters.activateTab`; ele permanece sobrescrito no runtime pelo `part-08` e pelo coordenador ES, mas deve ser removido apenas em uma etapa propria com cobertura do bundle classico.
- Consumidores remanescentes de `financeUiAdapters` em `part-03`, `part-07` e `part-29` ainda impedem a remocao da bridge global.
