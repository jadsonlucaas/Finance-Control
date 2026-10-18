# Before x After de Performance

Executado em: 23/08/2026

Todas as medicoes desta tabela foram feitas localmente, com massa sintetica, `wrote=false`, Vite em localhost e Firebase Emulator quando o fluxo envolve Firestore. Nao houve deploy, push, Firebase real, provedor externo, WhatsApp, telefone ou Admin SDK.

| Indicador | Antes registrado | Depois corretivo | Comando / fonte | Resultado |
| --- | ---: | ---: | --- | --- |
| Entry JS | 395.85 KiB gzip 94.25 KiB | 426230 bytes gzip 102.74 KiB | `npm run build` + `npm run bundle:budget` | Dentro do budget atual, Firebase fora do bootstrap |
| Maior chunk | 541.25 KiB gzip 128.80 KiB | 449417 bytes gzip 111.51 KiB | `npm run build` + `npm run bundle:budget` | Reduzido e separado como `services-firestore` |
| Chunk Firebase principal | 541.25 KiB gzip 128.80 KiB | 167138 bytes gzip 34.15 KiB | `npm run build` + `npm run bundle:budget` | Reduzido por chunk dedicado de Firestore |
| Chunk Firebase no bootstrap | Sim | Nao | `npm run bundle:budget` | Aprovado |
| Runtime XLSX/jsPDF no entry | Nao validado por budget | Ausente | `npm run bundle:budget` | Aprovado |
| Bootstrap localhost | N/D | mediana 402.955ms | `npm run bootstrap:benchmark` | Aprovado localmente |
| Dashboard 100 registros | 0.134ms | 0.183ms | `npm run dashboard:benchmark` | Usa 100/100 registros para KPI |
| Dashboard 1.000 registros | 0.296ms | 0.377ms | `npm run dashboard:benchmark` | Usa 1.000/1.000 registros para KPI |
| Dashboard 5.000 registros | 0.246ms | 1.369ms | `npm run dashboard:benchmark` | Usa 5.000/5.000 registros para KPI |
| Dashboard 10.000 registros | 0.777ms | 1.950ms | `npm run dashboard:benchmark` | Usa 10.000/10.000 registros para KPI |
| Importacao 100 linhas | 50.860ms | 17.068ms | `npm run import:benchmark` | `wrote=false` |
| Importacao 1.000 linhas | 160.696ms | 71.094ms | `npm run import:benchmark` | `wrote=false` |
| Backup 100 registros | 32.187ms | 17.637ms | `npm run backup:benchmark` | `wrote=false` |
| Backup 1.000 registros | 50.539ms | 33.338ms | `npm run backup:benchmark` | `wrote=false` |
| Backup 5.000 registros | 157.897ms | 124.035ms | `npm run backup:benchmark` | `wrote=false` |
| `audit_logs` pagina 1/2/10 | Hibrido, podia depender de lista completa | 50 / 50 / 50 | `npm run firestore:pagination:benchmark` via Emulator | Fonte `firestore`, cursor opaco |
| `idempotency_receipts` pagina 1/2/10 | Sem listagem paginada Firestore | 50 / 50 / 50 | `npm run firestore:pagination:benchmark` via Emulator | Fonte `firestore`, cursor opaco |
| `users` pagina 1/2/10 | Hibrido, podia depender de lista completa | 50 / 50 / 50 | `npm run firestore:pagination:benchmark` via Emulator | Fonte `firestore`, cursor opaco |
| Subscriptions em troca de owner | Cobertura local em memoria | 1 -> 0 -> 1 -> 0 listener ativo | `tests/application/performance/subscriptionLifecycleRuntime.test.js` | Sem vazamento no adapter web lazy |

## Leitura dos resultados

Os tempos locais podem oscilar conforme maquina, cache e Chromium. O criterio funcional desta correcao e:

- historicos persistidos corrigidos usam `limit` e `startAfter` no Firestore;
- cursores nao vazam snapshots ou dados sensiveis;
- dashboard nao calcula KPI a partir da primeira pagina;
- subscriptions fecham listeners antes de trocar owner;
- budgets continuam automatizados.

## Atualizacao Dashboard/read models - 02/09/2026

O Dashboard passou a compor KPIs, filtros e dados de graficos por read models puros. A medicao deve continuar sendo feita por `npm run dashboard:benchmark`, com 100, 1.000 e 5.000 registros no minimo, e o resultado so pode ser declarado como melhoria apos medicao local. A regra de performance permanece: KPI usa dataset completo autorizado e listagem paginada nao altera totais.

Resultado local desta etapa:

| Indicador | Resultado |
| --- | ---: |
| Dashboard 100 registros | 0.282ms |
| Dashboard 1.000 registros | 0.556ms |
| Dashboard 5.000 registros | 2.135ms |
| Dashboard 10.000 registros | 2.429ms |
| `wrote` | false |

## Correcao 5.4B - Bundle governance

Executado em: 03/09/2026

| Metrica | Antes de 5.4A | 5.4A | Apos 5.4B |
| --- | ---: | ---: | ---: |
| Entry bytes | 426230 | 431251 | 411442 |
| Budget bytes | 430080 | 432128 | 430080 |
| Headroom bytes | 3850 | 877 | 18638 |
| Headroom % | 0.90% | 0.20% | 4.33% |
| Meta recomendada `<= 425000` | Nao atendida por 1230 bytes | Nao atendida por 6251 bytes | Atendida com 13558 bytes de margem |
| Chunk Controle de Horas | N/D | Lazy, mas acionado no bootstrap pos-legado | `hourControlActiveUi-BlGPZ-K5.js`, 24630 bytes, sob demanda |
| Chunk Parcelamentos | No entry | No entry | `parcelamentosRenderer-D2yYUets.js`, 21960 bytes, sob demanda |
| Chunk Firebase | 167138 | 167138 | 167138 |
| Chunk Chart.js | N/D | N/D | `vendor-chart-CieodS8Z.js`, 207440 bytes |
| Maior chunk | 449417 | 449417 | 449417 |
| `npm run bundle:budget` | Aprovado | Aprovado com budget elevado | Aprovado com budget restaurado |

O aumento de 5.4A foi de `2048` bytes (`0.48%`) no limite de Entry JS. A correcao 5.4B reverteu esse aumento e criou margem por lazy loading real: Controle de Horas moderno carrega ao navegar para `controle-horas`, e Parcelamentos carrega ao navegar para `parcelamentos`. Firebase, XLSX, jsPDF, WhatsApp, provider externo e Admin SDK permanecem fora do entry.

## Configuracoes - 04/09/2026

`npm run settings:benchmark` mede a montagem local do read model de Configuracoes com massa sintetica e `wrote=false`.

| Indicador | Resultado |
| --- | ---: |
| Configuracoes 100 referencias | 20.531ms |
| Configuracoes 1.000 referencias | 58.535ms |
| Configuracoes 5.000 referencias | 413.225ms |
| `wrote` | false |

Os valores sao locais e podem oscilar conforme maquina/cache. A etapa valida que a leitura moderna nao escreve dados, nao acessa Firebase real e mantem referencias pessoais/globais separadas.

## Configuracoes 5.6A - Headroom e escopo

Executado em: 05/09/2026

| Metrica | Antes 5.6 | 5.6 | 5.6A |
| --- | ---: | ---: | ---: |
| Entry | 418905 bytes | 425874 bytes | 420552 bytes |
| Budget | 430080 bytes | 430080 bytes | 430080 bytes |
| Headroom | 11175 bytes | 4206 bytes | 9528 bytes |
| Headroom % | 2.60% | 0.98% | 2.22% |
| Globals | 50 | 50 | 50 |
| Classic/eval | 33/33 | 33/33 | 33/33 |

O headroom foi recuperado movendo composicao web de Configuracoes e validacao de escopo para chunk lazy. O budget nao foi aumentado. Usuario comum que solicitar `global` recebe rejeicao de aplicacao; `global` nao vira `personal` silenciosamente.

## Administracao de Usuarios - 05/09/2026

`npm run user-admin:benchmark` mede a montagem local do read model de Administracao de Usuarios com massa sintetica e `wrote=false`.

| Indicador | Resultado |
| --- | ---: |
| Admin 100 usuarios | 12.529ms |
| Admin 1.000 usuarios | 11.306ms |
| Admin 5.000 usuarios | 53.597ms |
| `wrote` | false |

O caminho ativo e lazy via Configuracoes. A etapa deve manter Entry JS abaixo de `430080` bytes, APIs globais em ate `50` e scripts classicos/eval em `33/33`.

Medicao final de bundle: Entry `420576` bytes contra budget `430080`, headroom `9504` bytes (`2.21%`), APIs globais `50`, scripts classicos/eval `33/33`.

## Queries da Administracao de Usuarios - 05/09/2026

Validadas no Firestore Emulator com 1.000 perfis sinteticos:

| Indicador | Resultado |
| --- | ---: |
| Page 1 | 50 itens |
| Page 2 | 50 itens |
| Page 10 | 50 itens |
| Filtro `status=active` | 50 itens |
| Filtro `status=pending` | 50 itens |
| Filtro `role=admin` | 50 itens |
| Filtro `status=active + role=admin` | > 0 itens |
| `pageSize=999` | limitado para 200 |
| Teste Emulator | 3 testes, 6.38s Vitest |

O Emulator valida a estrutura da query, cursor e ausencia de scan completo escondido; nao e usado para declarar billing/custo de producao.

## Importacao financeira - 06/09/2026

`npm run import:benchmark` mede parser XLSX, preparo idempotente, read model de preview e commit em memoria com massa sintetica e `wrote=false`.

| Indicador | 100 linhas | 1.000 linhas | Limite atomico atual |
| --- | ---: | ---: | ---: |
| Parse XLSX | 13.752ms | 35.167ms | 3.679ms |
| Prepare/fingerprint/dedup | 224.762ms | 466.114ms | 34.613ms |
| Preview read model | 9.057ms | 44.193ms | 4.563ms |
| Commit in-memory | 72.147ms | pulado acima do limite | 35.192ms |
| Total | 319.718ms | 545.509ms | 78.047ms |

Os valores sao locais e podem oscilar por maquina/cache. O benchmark nao usa arquivo real, Firebase real, webhook, provider externo, telefone, WhatsApp ou Admin SDK.
## Backup UI e Restore dry-run - 08/09/2026

`npm run backup:benchmark` mede geracao de snapshot, serializacao, validacao, read model de backup, prepare de restore dry-run e read model de restore com massa sintetica e `wrote=false`.

| Indicador | 100 registros | 1.000 registros | 5.000 registros |
| --- | ---: | ---: | ---: |
| Geracao de backup | 25.643ms | 18.429ms | 60.970ms |
| Serializacao | 0.090ms | 0.609ms | 1.930ms |
| Validacao | 3.101ms | 13.506ms | 50.094ms |
| Read model de backup | 1.579ms | 4.311ms | 20.634ms |
| Restore dry-run | 5.142ms | 15.301ms | 67.660ms |
| Read model de restore | 1.113ms | 0.422ms | 2.799ms |
| Total | 36.668ms | 52.579ms | 204.088ms |

O benchmark nao usa arquivo real, Firebase real, webhook, provider externo, telefone, WhatsApp, Admin SDK ou restore real.

## Exportacao PDF - 08/09/2026

`npm run pdf-export:benchmark` mede montagem do `FinancialReportReadModel` e serializacao com massa sintetica e `wrote=false`.

| Indicador | 100 registros | 1.000 registros | 5.000 registros |
| --- | ---: | ---: | ---: |
| Report model | 22.407ms | 26.530ms | 80.933ms |
| Serializacao | 0.092ms | 0.633ms | 2.618ms |
| Total | 22.499ms | 27.163ms | 83.551ms |

O benchmark nao usa arquivo real, Firebase real, webhook, provider externo, telefone, WhatsApp, Admin SDK ou biblioteca PDF externa. A geracao PDF real permanece lazy no navegador.

## Saida do Loader Legado - 08/09/2026

`npm run bootstrap:benchmark` mede o carregamento local com Vite e Chromium.

| Indicador | Antes | Depois |
| --- | ---: | ---: |
| Bootstrap median | baseline nao remedido nesta etapa | 205.252ms |
| Scripts classicos | 33 | 26 |
| Scripts executados por eval | 33 | 26 |
| Bytes legados carregados | 776933 | 776052 |
| `wrote` | false | false |

Nao foi declarado ganho de tempo contra baseline historico porque a mediana anterior nao foi medida no mesmo comando antes da alteracao. O ganho estrutural medido e a reducao de 7 scripts e 881 bytes no loader.

## Bridges e Monitor - 08/09/2026

`npm run bootstrap:benchmark` mede o carregamento local com Vite e Chromium. A mediana anterior registrada era `205.252ms`; a mediana pos-lote nesta maquina foi `203.899ms` em amostra de 5 execucoes, com `wrote=false`. Por variacao de ambiente/cache, nao ha declaracao de ganho temporal causal.

| Indicador | Antes | Depois |
| --- | ---: | ---: |
| Bootstrap median | 205.252ms | 203.899ms |
| Scripts classicos | 26 | 24 |
| Scripts executados por eval | 26 | 24 |
| Bytes legados carregados | 776052 | 754753 |
| Entry JS | 372911 | 372910 |
| `wrote` | false | false |

Chunk novo/afetado: `dist/assets/performanceMonitor-r48FUWgM.js`, cerca de `7.75 kB`.

## Loader de Bibliotecas - 08/09/2026

`npm run bootstrap:benchmark` mede o carregamento local com Vite e Chromium. Baseline anterior do lote: `203.899ms`; a mediana final desta etapa foi `248.914ms` em amostra de 5 execucoes, com `wrote=false`. Por variacao de ambiente/cache, nao ha declaracao de ganho temporal causal.

| Indicador | Antes | Depois |
| --- | ---: | ---: |
| Bootstrap median | 203.899ms | 248.914ms |
| Scripts classicos | 24 | 23 |
| Scripts executados por eval | 24 | 23 |
| Bytes legados carregados | 754753 | 751896 |
| Entry JS | 372910 | 373064 |
| `wrote` | false | false |

Chunk novo/afetado: `dist/assets/libraryLoaderBridge-BhRFLgRW.js`, cerca de `3.61 kB`. XLSX, jsPDF/autotable e PDFJS continuam lazy; Chart.js e Lucide permanecem no bootstrap por politica atual.

## Correcao da Regressao do Loader - 09/09/2026

O benchmark foi ampliado para `BOOTSTRAP_BENCHMARK_RUNS=10` e passou a emitir media, mediana, p75, p95, minimo, maximo, desvio padrao e fases inferidas por recursos do navegador. A medicao anterior ao ajuste teve mediana `606.234ms`, media `802.100ms`, p75 `1133.805ms`, p95 `1791.493ms`, minimo `272.130ms`, maximo `1791.493ms` e desvio `505.031ms`.

A causa corrigida foi o import estatico de `src/services/libraryLoader.js` dentro de `src/legacy/libraryLoaderBridge.js`, que antecipava o loader canonico e seu contrato de erro para o bootstrap. A bridge agora e proxy lazy: instala somente as APIs globais e importa `libraryLoader.js` apenas na primeira chamada de `loadExternalLibrary`, `ensurePdfLibraries` ou `ensureSpreadsheetLibrary`.

| Indicador | Antes da correcao | Depois da correcao |
| --- | ---: | ---: |
| Bootstrap median `loadMs` | 606.234ms | 568.788ms |
| Bootstrap media `loadMs` | 802.100ms | 776.425ms |
| Bootstrap p75 `loadMs` | 1133.805ms | 814.604ms |
| Bootstrap p95 `loadMs` | 1791.493ms | 1778.471ms |
| First screen median | N/D | 114ms |
| Scripts classicos | 23 | 23 |
| Scripts executados por eval | 23 | 23 |
| Bytes legados carregados | 751896 | 751896 |
| Entry JS | 373064 | 373064 |
| Bridge chunk | 3.66 kB | 1.76 kB |
| Library loader chunk | acoplado a bridge | 2.76 kB lazy |

O criterio orientativo contra o baseline historico `203.899ms` (`<=224.3ms`) nao foi atingido pela metrica `loadMs`. A instrumentacao por fases mostrou que `library-loader-setup` nao aparece no bootstrap e que a maior variacao vem do `document-load` no Vite local e do carregamento dos chunks legados. A metrica de primeira tela em runs aquecidos ficou abaixo do baseline historico, mas nao substitui o criterio oficial. Proximo lote de legado deve aguardar novo baseline em ambiente controlado ou foco direto na reducao dos chunks legados.

## Benchmark deterministico de Bootstrap - 11/09/2026

`npm run bootstrap:benchmark` passou a usar `vite preview` como gate principal e `vite dev` apenas como comparacao informativa. O comando coleta 10 amostras cold e 10 warm, preserva os valores brutos e calcula mediana, media, p75, p95, minimo, maximo, desvio padrao e coeficiente de variacao.

Baseline versionado: `docs/bootstrap-performance-baseline.json`.

| Ambiente | Metrica | Cold median | Warm median | Gate |
| --- | --- | ---: | ---: | --- |
| preview | `app_bootstrap_ms` | 344.75ms | 99.70ms | sim |
| preview | `first_screen_ready_ms` | 395.15ms | 129.20ms | sim |
| preview | `legacy_loader_ms` | 333.25ms | 95.80ms | diagnostico |
| preview | `bridge_install_ms` | 66.95ms | 26.75ms | diagnostico |
| preview | `auth_init_ms` | 84.70ms | 35.85ms | diagnostico |
| preview | `document_load_ms` | 293.50ms | 129.15ms | nao |
| dev | `app_bootstrap_ms` | 372.95ms | 106.25ms | nao |
| dev | `document_load_ms` | 324.50ms | 133.65ms | nao |

Thresholds: warning acima do baseline +10%; falha acima do baseline +20%; somente para `app_bootstrap_ms` e `first_screen_ready_ms`. `document_load_ms` e `environment_overhead_ms` sao informativos.

O entry subiu de `373064` para `374009` bytes por causa das marcas deterministicas, ainda abaixo da meta de observabilidade de `375000` bytes e do budget oficial `430080` bytes. O headroom atual e `56071` bytes.

## Decomposicao `legacy-ui.js` - 11/09/2026

`src/ui/legacy-ui.js` saiu do pacote classic/eval e passou a ser ES Module instalado antes do legado. A bridge `financeUI` continua ativa.

| Metrica | Antes | Depois |
| --- | ---: | ---: |
| Scripts classic/eval | 23/23 | 22/22 |
| Bytes do loader classico | 751896 | 746720 |
| APIs globais | 50 | 50 |
| Entry JS | 374009 | 374155 |
| Budget oficial | 430080 | 430080 |

O benchmark deterministico continua sendo o gate de performance para `app_bootstrap_ms` e `first_screen_ready_ms`; `document_load_ms` permanece apenas informativo. O entry aumentou `146` bytes pelo ponto de import dinamico da bridge ES, permanecendo abaixo da meta preferencial de `375000` bytes e do budget oficial.

## Consumidores `financeUI` - 12/09/2026

`part-03.js` e `part-29.js` passaram a usar `window.financeApp.financeUiAdapters` para chamadas visuais. A alteracao nao remove scripts do pacote classic/eval, mas reduz dependencia runtime direta da bridge `window.financeUI`.

| Metrica | Antes | Depois |
| --- | ---: | ---: |
| `window.financeUI` em `part-03.js` | 13 | 0 |
| `window.financeUI` em `part-29.js` | 3 | 0 |
| Scripts classic/eval | 22/22 | 22/22 |
| APIs globais | 50 | 50 |
| Entry JS | 374155 | 374155 |
| Budget oficial | 430080 | 430080 |

O adapter passou a ser instalado pelo mesmo chunk `legacy-ui`, sem chunk novo e sem aumento do entry. Benchmark final `preview` com status `ok`, sem warnings nem violations:

| Metrica preview | Baseline warm | Depois warm | Depois cold |
| --- | ---: | ---: | ---: |
| `app_bootstrap_ms` | 124.45 | 81.35 | 207.8 |
| `first_screen_ready_ms` | 154.95 | 105.4 | 274.5 |
| `legacy_loader_ms` | 120.5 | 75.4 | 193.7 |
| `bridge_install_ms` | 24.7 | 31.5 | 89.75 |

## Consumidores modernos `financeUI` - 12/09/2026

`src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` deixaram de depender de `window.financeUI`. `part-07.js` deixou de chamar `window.financeUI` diretamente e passou a usar o adapter visual temporario instalado em `window.financeApp.financeUiAdapters`.

Impacto validado: nenhum script foi removido do classic/eval loader, nenhuma API global foi adicionada e nenhum chunk pesado novo foi introduzido. O build gerou entry `375011` bytes contra budget `430080`, com `classic/eval=22/22`, APIs globais `50`, bytes legados `747119`, novo `eval=0` e `new Function=0`.

`npm run bootstrap:benchmark` foi aprovado com status `ok`, sem warnings nem violations contra as metricas gate `app_bootstrap_ms` e `first_screen_ready_ms`.

## Consumidores criticos `financeUI` - 12/09/2026

`part-08.js` e `part-14.js` tiveram apenas chamadas puramente visuais desacopladas de `window.financeUI`. A etapa nao removeu scripts do classic/eval loader, nao alterou baseline de performance e nao declara ganho causal de tempo.

| Metrica | Antes | Depois |
| --- | ---: | ---: |
| `window.financeUI` em `part-08.js` | 9 | 0 |
| `window.financeUI` em `part-14.js` | 4 | 0 |
| `navigationBridgeConsumers` | 1 | 0 |
| Scripts classic/eval | 22/22 | 22/22 |
| APIs globais top-level | 50 | 50 |
| Entry JS | 375011 | 375011 |
| Budget oficial | 430080 | 430080 |
| Bytes legados carregados | 747119 | 747948 |

`npm run bootstrap:benchmark` foi aprovado com status `ok`, sem warnings nem violations contra `app_bootstrap_ms` e `first_screen_ready_ms`. O aumento de bytes legados vem do helper local de ativacao visual em `part-08.js`; nenhum script saiu ou entrou no loader. Atualizacao 5.20: `window.financeUI` nao e mais instalada; `financeApp.financeUiAdapters` permanece por compatibilidade/adapters, nao por `part-08.js:switchTab`.
