# Politica de Saida do Loader Legado

## Regras

- Nao migrar scripts financeiros, tributarios, auth/security, parcelamentos, recorrencias, horas, importacao, backup/restore ou PDF em lote amplo.
- Nao remover arquivo legado apenas porque saiu do loader; remocao fisica exige busca de consumidores e motivo registrado.
- Bridges globais so podem ser removidas quando `docs/legacy-consumer-graph.md`, testes e smoke confirmarem ausencia de consumidores.
- Modulos em `src/application/**` e `src/domain/**` nao podem importar `src/legacy/**`.
- UI moderna nao pode importar `src/legacy/inline/part-XX.js`.
- Nenhum novo `eval` ou `new Function` e permitido.
- O budget oficial do entry permanece `430080` bytes.
- Qualquer reducao deve ser acompanhada de `npm run legacy-loader:check`.

## Fluxo Seguro

1. Atualizar grafo de consumidores.
2. Classificar scripts A-G.
3. Escolher somente itens `DEAD`, `BRIDGE-ONLY` ou `UI LOW-RISK`.
4. Preservar bridge se ainda houver consumidor.
5. Rodar Vitest, build, smoke, Playwright, performance, bundle e emuladores.
6. Documentar contagens antes/depois.

## Backend Futuro

O backend/chatbot futuro deve depender de `src/application` e `src/domain`, nunca de `window`, `classicScripts`, `eval`, `part-XX` ou bridges globais.

## Segundo Lote

- Bridges puras devem ser instaladas por ES Modules antes do classic loader.
- `src/legacy-globals.js` nao deve voltar para `LEGACY_CLASSIC_SCRIPTS`; novas compatibilidades de dominio/core devem entrar em `src/legacy/globalBridge.js` e delegar para modulo canonico.
- `src/services/performanceMonitor.global.js` nao deve voltar para `LEGACY_CLASSIC_SCRIPTS`; a API global temporaria e `window.financePerformance`, instalada por `installPerformanceMonitor()`.
- `libraryLoader.global.js` nao deve voltar para `LEGACY_CLASSIC_SCRIPTS`; as bridges temporarias devem vir de `src/legacy/libraryLoaderBridge.js` delegando para `src/services/libraryLoader.js`.
- `legacy-ui.js` nao deve voltar para `LEGACY_CLASSIC_SCRIPTS`; `window.financeUI` nao deve ser reinstalada, e `window.financeApp.financeUiAdapters` permanece bloqueado enquanto houver consumidores classicos diretos em `part-03.js`, `part-07.js` e `part-29.js`.

## Terceiro Lote

- Loaders de bibliotecas devem ter Promise cacheada, retry apos falha, allowlist explicita e erro `LAZY_LOAD_FAILED`.
- XLSX, jsPDF/autotable e PDFJS permanecem lazy e nao podem aparecer no entry.
- Nenhum CDN novo pode ser adicionado sem diagnostico e teste dedicado.
- `npm run library-loader:check` protege lazy loading, allowlist, ausencia de `eval`/`new Function` e ausencia de bibliotecas pesadas no bootstrap.
- O teto estrutural do loader legado passa a ser `classicScriptsMax=23` e `evalExecutedScriptsMax=23`.

## Correcao de Bootstrap dos Loaders

- `src/legacy/libraryLoaderBridge.js` deve permanecer como proxy lazy: instala nomes globais, mas nao importa `src/services/libraryLoader.js` estaticamente.
- `src/services/libraryLoader.js` nao deve importar `applicationError.js` no top-level; erros de lazy load precisam manter o contrato serializavel sem aumentar o caminho quente.
- `npm run bootstrap:check` deve ser executado antes de qualquer novo lote para validar `classic/eval <= 23`, globais `<= 50`, budget `430080`, XLSX/PDF fora do entry, ausencia de novo `eval` e `new Function = 0`.
- A bridge `financeUI` deve continuar instalada antes dos scripts classicos enquanto houver consumidores legados.

## Benchmark deterministico antes do proximo lote

- Proximos lotes do loader legado devem avaliar `legacy_loader_ms` e `app_bootstrap_ms`, nao `document_load_ms`.
- `document_load_ms` e `environment_overhead_ms` sao informativos e nao autorizam nem bloqueiam migracao sozinhos.
- O baseline versionado fica em `docs/bootstrap-performance-baseline.json` e nao pode ser autoatualizado no mesmo benchmark.
- `npm run bootstrap:benchmark` deve passar em `vite preview` com 10 cold + 10 warm antes de novo lote.
- Apos a decomposicao de `legacy-ui.js`, o teto estrutural passa a ser `classic/eval <= 22`. A proxima etapa deve remover consumidores diretos de `financeUI`, nao reintroduzir o arquivo no `eval`.

## Consumidores `financeUI` apos `part-03`/`part-29`

`part-03.js` e `part-29.js` nao podem voltar a chamar `window.financeUI` diretamente. O gate `npm run finance-ui-consumers:check` protege essa fronteira e deve ser executado junto com `legacy-loader:check`.

`part-08.js` e `part-14.js` nao devem voltar a chamar `window.financeUI` diretamente. A navegacao de `part-08.js` tambem nao deve voltar a `financeUI.activateTab` nem a `financeUiAdapters.activateTab`. `window.financeUI` so pode ser removida apos auditoria completa de adapters, propriedades aninhadas, aliases dinamicos e consumidores restantes. Modulos modernos nao devem voltar a depender de `window.financeUI` nem de `window.financeApp.financeUiAdapters`.
