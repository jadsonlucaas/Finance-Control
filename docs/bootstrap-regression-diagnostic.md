# Diagnostico de Regressao de Bootstrap

Data: 2026-09-09

## Escopo

Esta investigacao cobre somente carregamento inicial, loader de bibliotecas e bridges globais do projeto local Finance-Control-New. Nao houve autorizacao para alterar regras financeiras, formulas, autenticacao, Firestore Rules, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, controle de horas ou materializacao percentual.

## Ambiente verificado

- Branch: `melhoria-arquitetura`
- Ultimo commit de entrada: `8df5e32 refactor: moderniza loaders e utilitarios ui legados`
- Remote: vazio
- Working tree inicial: limpa
- Execucao: localhost Vite + Chromium via Playwright

## Baselines

- Bootstrap anterior ao lote do loader de bibliotecas: `203.899ms`
- Bootstrap observado apos o lote anterior: `248.914ms`
- Limite orientativo para regressao aceitavel: `224.3ms` (`203.899ms + 10%`)
- Entry JS observado no lote anterior: `373064` bytes
- Budget oficial: `430080` bytes
- Classic/eval depois do lote anterior: `23/23`
- APIs globais depois do lote anterior: `50`

## Auditoria do diff `e73c2e4..8df5e32`

### O que deixou de executar via eval

- `src/services/libraryLoader.global.js` saiu de `LEGACY_CLASSIC_SCRIPTS`.
- As APIs globais do loader deixaram de ser instaladas por IIFE avaliado junto com o pacote legado.

### O que passou a executar como ES Module

- `src/services/libraryLoader.js` passou a conter a implementacao canonica de:
  - `loadExternalLibrary`
  - `isAllowedExternalLibraryUrl`
  - `ensurePdfLibraries`
  - `ensureSpreadsheetLibrary`
- `src/legacy/libraryLoaderBridge.js` passou a instalar as bridges globais usando `defineLegacyGlobalBridge`.

### Import ES executado cedo

- `src/legacy/classicScripts.js` importa dinamicamente `src/legacy/libraryLoaderBridge.js` durante `loadLegacyClassicScripts`.
- A bridge importa estaticamente `src/services/libraryLoader.js`.
- `libraryLoader.js` importa estaticamente `src/application/resilience/applicationError.js`.

### Promises criadas no bootstrap

- A auditoria de codigo nao encontrou Promise de biblioteca pesada criada no top-level de `libraryLoader.js`.
- `libraryPromises` e apenas um `Map` criado no top-level.
- `loadExternalLibrary` cria Promise somente quando chamado explicitamente.

### Side effects em import

- `libraryLoader.js` nao injeta script no top-level.
- `libraryLoaderBridge.js` nao carrega XLSX/PDF no top-level.
- A instalacao da bridge define nomes globais, mas nao chama `ensurePdfLibraries` nem `ensureSpreadsheetLibrary`.

### Bibliotecas lazy

- XLSX deve carregar somente via `ensureSpreadsheetLibrary`.
- jsPDF/autotable deve carregar somente via `ensurePdfLibraries`.
- PDFJS continua permitido somente para fluxo de importacao legado.
- Chart.js e Lucide permanecem no bootstrap por politica atual.

## Medicoes iniciais antes de correcao

Foram executadas duas rodadas de `npm.cmd run bootstrap:benchmark`, totalizando 10 navegacoes. O script atual roda 5 navegacoes por processo de benchmark em servidor Vite local e Chromium.

| Run | loadMs | firstScreenApproximation | resources |
| --- | ---: | ---: | ---: |
| 1 | 1791.493 | 820 | 125 |
| 2 | 1133.805 | 984 | 123 |
| 3 | 477.745 | 148 | 123 |
| 4 | 570.441 | 236 | 131 |
| 5 | 993.259 | 668 | 147 |
| 6 | 1502.055 | 840 | 125 |
| 7 | 642.026 | 608 | 123 |
| 8 | 272.130 | 64 | 123 |
| 9 | 279.829 | 92 | 123 |
| 10 | 358.220 | 80 | 123 |

Resumo:

- Mediana: `606.234ms`
- Media: `802.100ms`
- p75: `1133.805ms`
- p95: `1791.493ms`
- Minimo: `272.130ms`
- Maximo: `1791.493ms`
- Desvio padrao populacional: `505.031ms`

## Leitura da regressao

A distribuicao inicial nao e comparavel de forma limpa ao baseline `203.899ms`: ha forte comportamento cold/warm, recursos variando de `123` a `147` e outliers acima de `1s`. O aumento observado de `248.914ms` pode conter ruido ambiental, mas tambem ha uma causa arquitetural plausivel: a bridge do loader de bibliotecas passou a importar `libraryLoader.js` antes do pacote legado completo, antecipando tambem o modulo de erro de aplicacao usado apenas em falhas de lazy load.

## Hipotese principal

O carregamento pesado de bibliotecas continua lazy, mas o modulo `libraryLoader.js` esta mais caro do que precisa no bootstrap porque importa `applicationError.js` no top-level para construir erros que so sao necessarios em caminhos de falha. Essa dependencia deve ser tornada lazy ou removida do caminho quente sem reintroduzir o loader global.

## Plano de correcao seguro

1. Manter `libraryLoader.js` como ES Module.
2. Manter `src/services/libraryLoader.global.js` fora do loader classico.
3. Manter `classic/eval <= 23/23`.
4. Tornar a criacao de erro de lazy load independente de import pesado no top-level.
5. Adicionar guard `bootstrap:check`.
6. Reforcar testes de que importar loader/bridge nao injeta scripts, nao cria Promises de bibliotecas e nao duplica listeners.
7. Medir novamente com 10+ amostras apos a correcao.

## Correcao aplicada

- `src/services/libraryLoader.js` continua ES Module.
- O import top-level de `src/application/resilience/applicationError.js` foi removido do loader de bibliotecas.
- O erro de lazy load preserva o contrato serializavel:
  - `code: LAZY_LOAD_FAILED`
  - `category: LAZY_LOAD`
  - `severity: error`
  - `retryable: true`
  - `schemaVersion: 1`
- `src/legacy/libraryLoaderBridge.js` deixou de importar `libraryLoader.js` estaticamente.
- A bridge passou a ser proxy lazy:
  - `isAllowedExternalLibraryUrl` continua sincrono e leve;
  - `loadExternalLibrary`, `ensurePdfLibraries` e `ensureSpreadsheetLibrary` fazem `import('../services/libraryLoader.js')` somente no primeiro uso real.
- `bootstrap:check` foi criado para impedir:
  - reintroducao de `libraryLoader.global.js`;
  - import eager de `applicationError.js` no loader;
  - import estatico de `libraryLoader.js` na bridge;
  - XLSX/PDF/importacao/backup/relatorio no entry;
  - `classic/eval` acima de `23/23`;
  - globais acima de `50`;
  - entry acima de `430080` bytes.

## Medicoes finais apos correcao

Comando: `BOOTSTRAP_BENCHMARK_RUNS=10 npm.cmd run bootstrap:benchmark`

| Run | loadMs | firstScreenApproximation | resources |
| --- | ---: | ---: | ---: |
| 1 | 1778.471 | 1260.0 | 124 |
| 2 | 1163.283 | 881.2 | 123 |
| 3 | 743.145 | 108.0 | 144 |
| 4 | 814.604 | 196.0 | 127 |
| 5 | 584.882 | 104.0 | 123 |
| 6 | 525.649 | 120.0 | 123 |
| 7 | 531.910 | 108.0 | 124 |
| 8 | 552.694 | 92.0 | 123 |
| 9 | 530.263 | 120.0 | 123 |
| 10 | 539.345 | 108.0 | 123 |

Resumo `loadMs`:

- Mediana: `568.788ms`
- Media: `776.425ms`
- p75: `814.604ms`
- p95: `1778.471ms`
- Minimo: `525.649ms`
- Maximo: `1778.471ms`
- Desvio padrao populacional: `385.038ms`

Resumo `firstScreenApproximation`:

- Mediana: `114ms`
- Media: `309.720ms`
- p75: `196ms`
- p95: `1260ms`
- Minimo: `92ms`
- Maximo: `1260ms`
- Desvio padrao populacional: `390.684ms`

## Fases observadas

Nas medicoes finais, a fase `library-loader-setup` nao apareceu no bootstrap. Isso comprova que `libraryLoader.js` nao foi requisitado antes de acao explicita de usuario. A bridge apareceu como recurso leve, entre `3.8ms` e `13ms` nos runs validos em que foi classificada.

Os maiores tempos vieram de:

- `document-load`, entre `424.2ms` e `1630.4ms`;
- carregamento legado em runs frios, com picos em `part-*`/`legacy-ui`;
- variacao local do Vite/Chromium, com forte diferenca entre cold e warm.

## Resultado frente ao criterio

O criterio orientativo de `203.899ms + 10% = 224.3ms` nao foi atingido para `loadMs`. A causa especifica atribuivel ao loader de bibliotecas foi corrigida, mas a metrica total continua dominada por variacao ambiental e pelo volume legado carregado no bootstrap.

Nao foi feita otimizacao artificial, nao foi aumentado threshold e nao houve novo lote de migracao de legado nesta tarefa.

## Decisao

Proximo lote de legado: pausar ate haver baseline mais estavel ou tarefa dedicada a reduzir os chunks legados ainda carregados no bootstrap. `legacy-ui.js` permanece bloqueado por consumidores reais.

## Governanca deterministica do benchmark - 11/09/2026

A etapa seguinte separou a antiga metrica `loadMs` em metricas canonicas. O gate principal deixou de ser `document_load_ms`, porque ele mede navegacao, servidor local, browser e evento `load`, e passou a ser `app_bootstrap_ms`, medido por marcas explicitas da Performance API.

Marcadores adicionados:

- `finance-app-entry-start`
- `finance-bridges-ready`
- `finance-legacy-loader-start`
- `finance-legacy-loader-end`
- `finance-auth-init-start`
- `finance-auth-init-end`
- `finance-shell-ready`
- `finance-first-screen-ready`
- `finance-bootstrap-complete`

Resultado de gate em `vite preview`:

| Metrica | Cold median | Warm median | Papel |
| --- | ---: | ---: | --- |
| `app_bootstrap_ms` | 344.75ms | 99.70ms | gate principal |
| `first_screen_ready_ms` | 395.15ms | 129.20ms | gate secundario |
| `legacy_loader_ms` | 333.25ms | 95.80ms | diagnostico |
| `bridge_install_ms` | 66.95ms | 26.75ms | diagnostico |
| `auth_init_ms` | 84.70ms | 35.85ms | diagnostico |
| `document_load_ms` | 293.50ms | 129.15ms | informativo |

`library-loader-setup` permaneceu ausente do critical path (`0/20` amostras preview). XLSX, jsPDF/autotable e Firebase lazy nao foram tocados no carregamento inicial medido.

Baseline versionado criado em `docs/bootstrap-performance-baseline.json`. Politica: warning acima de `+10%` e falha acima de `+20%` somente para metricas controlaveis (`app_bootstrap_ms` e `first_screen_ready_ms`).
