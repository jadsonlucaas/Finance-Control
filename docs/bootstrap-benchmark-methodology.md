# Metodologia do Benchmark de Bootstrap

Data: 2026-09-11

## Diagnostico da metodologia anterior

O `npm run bootstrap:benchmark` anterior iniciava o cronometro no processo Node imediatamente antes de `page.goto()` e encerrava depois de `waitUntil: "load"` mais a leitura de `window.financePerformance`. Isso tornava `loadMs` uma metrica de navegacao completa, nao uma metrica exclusiva do bootstrap da aplicacao.

Essa medicao incluia:

- resolucao e resposta do servidor Vite local;
- download e parse do HTML;
- download, parse e execucao do entry;
- Vite dev client e HMR no modo `dev`;
- download de chunks e recursos carregados antes do evento `load`;
- evento `load` do documento;
- variacao de Chromium/Playwright/processo local;
- parte da inicializacao real do app;
- parte do carregamento legado;
- primeira tela aproximada via FCP ou DOMContentLoaded.

Por isso a mediana `568.788ms` da etapa anterior nao representa diretamente regressao do app. Ela mede uma combinacao de ambiente, documento, rede local, browser, servidor e aplicacao.

## Metricas canonicas

### `app_bootstrap_ms`

Tempo controlavel principal. Vai de `finance-app-entry-start` ate `finance-bootstrap-complete`.

Inclui:

- instalacao de globals modernos;
- instalacao de bridges;
- carregamento classico legado necessario ao shell;
- registro dos lazy loaders apos legado;
- instalacao dos servicos Firebase modulares necessarios ao shell.

Nao inclui:

- download do HTML;
- espera do `load` do documento;
- overhead do Playwright;
- recursos externos lazy acionados pelo usuario.

Esta e a metrica de gate principal.

### `legacy_loader_ms`

Tempo de `finance-legacy-loader-start` ate `finance-legacy-loader-end`.

Inclui somente o caminho do loader classico: import dos raw scripts, execucao via eval documentada, instalacao de globals finais e imports modulares que permanecem acoplados ao legado.

### `bridge_install_ms`

Tempo aproximado de instalacao de bridges ate `finance-bridges-ready`.

Inclui as bridges instaladas no bootstrap e a bridge do loader de bibliotecas, mas nao deve acionar XLSX, jsPDF/autotable ou Firebase.

### `auth_init_ms`

Tempo de `finance-auth-init-start` ate `finance-auth-init-end`.

Representa a instalacao dos servicos Firebase/Auth necessarios ao shell. Nao mede login real, permissao de usuario nem chamadas a Firebase real.

### `first_screen_ready_ms`

Tempo de `finance-app-entry-start` ate `finance-first-screen-ready`.

Representa a primeira tela funcional utilizavel pelo shell local. Em caso de tela de autenticacao inicial, considera o shell pronto para interacao quando o legado e o shell estao instalados e a UI inicial pode responder.

### `lazy_registration_ms`

Tempo gasto registrando lazy loaders apos `finance-legacy-loader-end`, sem carregar as features lazy.

### `document_load_ms`

Tempo de navegacao do browser, vindo de `PerformanceNavigationTiming.duration` quando disponivel. E informativo e nao bloqueia regressao do app.

### `environment_overhead_ms`

Diferenca aproximada entre `document_load_ms` e `app_bootstrap_ms`. Quando negativa, reporta `0`. Serve para evidenciar ruido do ambiente.

## Gates de regressao

Somente metricas controlaveis bloqueiam regressao:

- `app_bootstrap_ms`: gate principal.
- `first_screen_ready_ms`: gate secundario.
- `legacy_loader_ms`: gate diagnostico para proximos lotes de migracao.

Metricas informativas:

- `document_load_ms`;
- `environment_overhead_ms`;
- contagem de recursos;
- duracao de chunks inferida por resource timing.

## Ambientes

O benchmark passa a separar:

- `preview`: build de producao servido localmente por `vite preview`; usado como gate principal por ser mais reprodutivel e sem HMR/dev client.
- `dev`: Vite dev server; usado apenas como comparacao informativa.

## Cold e warm

O benchmark coleta:

- 10 cold runs: novo browser context por amostra, aproximando cache frio de contexto.
- 10 warm runs: mesmo browser context e mesma pagina, preservando cache do contexto.

Os dois conjuntos nunca sao misturados na mesma mediana.

## Estatistica

Para cada metrica numerica sao registrados:

- valores brutos;
- minimo;
- maximo;
- media;
- mediana;
- p75;
- p95;
- desvio padrao;
- coeficiente de variacao.

Outliers nao sao descartados automaticamente.

## Baseline versionado

O baseline fica em `docs/bootstrap-performance-baseline.json` e nao e atualizado automaticamente pelo benchmark. Mudancas futuras de baseline exigem etapa explicita.

Politica inicial:

- warning: mediana de `app_bootstrap_ms` acima do baseline + 10%;
- failure: mediana de `app_bootstrap_ms` acima do baseline + 20%;
- a mesma regra se aplica ao `first_screen_ready_ms`;
- `document_load_ms` nunca e gate principal.
