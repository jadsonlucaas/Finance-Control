# Roadmap de migracao incremental do legado

## Atualizacao de CRUD financeiro principal - 02/09/2026

Foi criada uma fatia modular para o CRUD financeiro principal sem remover `part-03.js`:

- `src/ui/records/expenseFormController.js`
- `src/ui/records/incomeFormController.js`
- `src/ui/records/recordMutationPresenter.js`
- `src/ui/records/mutationAttemptStore.js`
- `src/ui/records/financialCrudControllerInstaller.js`

Proximo passo seguro: extrair leitura/orquestracao do formulario de saida em uma etapa separada, mantendo testes para parcelamento, recorrencia, refresh do dashboard e fallback local sem autenticacao.

Este roadmap lista candidatos para analise futura. Menor acoplamento aparente nao significa baixo impacto funcional: cada grupo exige busca de consumidores, teste estrutural, smoke, Playwright quando houver UI, preservacao de bridges e validacao de APIs globais antes de migrar.

## Grupo 1 concluido

| Grupo | Arquivos | Status | Observacao |
| --- | --- | --- | --- |
| Eventos legados | `src/ui/legacy-events.js` | Migrado para ES Module | Instalado por `bootstrapApp()` via `installLegacyEventBindings`; removido do loader classico |

## Reducao de globais concluida

| Item | Status | Observacao |
| --- | --- | --- |
| Auditoria das 58 APIs globais | Concluida | Detalhes em `docs/global-api-reduction-diagnostic.md` |
| `window.financeApp.installLegacyEventBindings` | Removido | Sem consumidor real apos bootstrap; `window.financeEvents` permanece |
| Registry de bridges | Criado | `defineLegacyGlobalBridge` registra origem canonica e bloqueia colisao em teste/dev |
| Inventario top-level | Mantido em 58 | Nenhuma global nova e nenhuma remocao top-level segura nesta etapa |

## Proximos candidatos

| Ordem | Grupo | Arquivos provaveis | Risco | Motivo |
| ---: | --- | --- | --- | --- |
| 1 | Stubs vazios/curtos | `part-21.js` a `part-25.js`, `part-30.js`, `part-31.js` | Baixo | Arquivos pequenos sem globals aparentes; confirmar que nao dependem de sourceURL/ordem |
| 2 | Helpers visuais base | `src/ui/legacy-ui.js` | Medio | Pode virar `installLegacyUiGlobals`, mas afeta modais/toast usados em toda UI |
| 3 | Loader de bibliotecas locais | `src/services/libraryLoader.global.js` | Medio | Ja e infraestrutura visual; precisa garantir Chart/Lucide antes do dashboard |
| 4 | Monitoramento/performance | `src/services/performanceMonitor.global.js` | Medio | Sem regra financeira, mas afeta `perf:audit` |
| 5 | Planner/feriados | `part-27.js` | Medio/alto | Candidato por delegar a dominio moderno, mas usa DOM e calendario/DSR |
| 6 | Modais pequenos de ajuste | `part-11.js`, `part-13.js` | Alto | Persistem dados; migrar somente apos casos de uso especificos |

## Bloqueados nesta fase

- `part-03.js`: CRUD principal, dashboard, submit e muitos globais criticos.
- `part-04.js`: bridges tributarias criticas.
- `part-05.js`: consolidacao de entradas.
- `part-06.js`: controle de horas ainda fornece compatibilidade e consumidores legados; a UI ativa ja delega render/create/update ao adapter moderno.
- `part-08.js`: parcelamentos.
- `part-16.js`: outras receitas/descontos de entrada.
- `part-20.js`: importacoes e compatibilidade de controle de horas/detalhe/sincronizacao derivada.
- `part-28.js`: administracao/autenticacao.
- `part-29.js`: percentuais, filtros e dashboard.

## Candidatos de reducao de duplicacao

- `saveEntryDiscountAdjustmentByEntry`: remover fallback de `part-11.js` somente apos teste de ordem do loader e descontos antigos.
- `openEntryDiscountHistoryModal`: consolidar fallback e versao componentizada de `part-16.js`.
- `showToast`: manter somente `src/ui/toast.js` apos migracao de `legacy-ui`.
- Bridges tributarias e de horas: remover exposicao global apenas quando `part-04.js` e consumidores legados forem migrados.

## Impacto futuro

- Dominio e aplicacao ficam cada vez mais importaveis sem browser.
- Bridges globais permanecem temporarias para o legado.
- Backend futuro nao deve carregar `classicScripts.js` nem `src/legacy/inline`.
- Nenhum WhatsApp, webhook, telefone, provedor externo ou Admin SDK foi implementado.

## Atualizacao de Dashboard/read models - 02/09/2026

Foram criados read models puros para Dashboard, Saidas e Entradas sem remover scripts classicos nesta etapa:

- `src/application/readModels/dashboardReadModel.js`
- `src/application/readModels/dashboardChartData.js`
- `src/application/readModels/expenseListReadModel.js`
- `src/application/readModels/incomeListReadModel.js`
- `src/application/selectors/dashboardFilters.js`
- `src/ui/dashboard/dashboardController.js`
- `src/ui/dashboard/dashboardPresenter.js`

`src/ui/dashboard/dashboardData.js` passou a atuar como adapter legado para DOM/`window` e delegar agregacoes, KPIs e charts ao read model canonico. `part-03.js`, `part-16.js` e `part-29.js` permanecem no loader porque ainda concentram bridges consumidas por consolidacao, outras receitas/descontos, materializacao percentual e renderizacao. A retirada de script classico segue bloqueada ate busca completa de consumidores e smoke/Playwright especificos.
# Atualizacao de performance - 23/08/2026

Antes de migrar novos scripts legados, preservar as seguintes garantias:

- Firebase SDK nao deve voltar ao bootstrap HTML.
- `part-03` continua area de alto risco por concentrar renderizacao, importacao e handlers.
- Helpers de dominio nao devem importar `src/services/*` quando esses servicos carregam Firebase.
- Qualquer reducao de global deve manter bridge enquanto houver consumidor legado.
- Migrações que toquem listagem devem manter `limit`, `cursor`, `hasMore` e `nextCursor`.
- Migrações que toquem listeners devem cobrir unsubscribe na troca de usuario.

## Correcao de conexao da UI ativa de Controle de Horas - 02/09/2026

Apos a revisao do commit `9cb8ba7`, foi identificado que a fatia moderna existia, mas a tela ativa ainda era atendida por overrides legados de `renderControleHoras` e `saveHourControlRecord`. A correcao instalou `src/ui/hours/hourControlActiveUi.js` depois de `loadLegacyClassicScripts`, preservando as mesmas bridges globais e direcionando renderizacao, criacao e edicao para `hourControlController`, `hourControlPresenter`, `hourControlReadModel` e `ApplicationCommandGateway`.

Status atual:

- UI ativa conectada ao caminho moderno para listar, criar e editar lancamentos de horas.
- Criacao e edicao comprovadas por Playwright local com dados e idempotencia mockados.
- `part-06.js`, `part-17.js`, `part-18.js`, `part-19.js`, `part-20.js` e `part-29.js` permanecem carregados por compatibilidade e consumidores nao removidos.
- Proxima reducao de scripts classicos exige cobertura especifica para detalhe, exclusao, entrada financeira derivada de H.E., filtros historicos e cache global.

## Atualizacao de Planner financeiro - 03/09/2026

Foi criada uma fatia modular para o Planner sem remover `part-26.js` nem `part-27.js`:

- `src/application/selectors/plannerFilters.js`
- `src/application/readModels/plannerReadModel.js`
- `src/ui/planner/plannerController.js`
- `src/ui/planner/plannerPresenter.js`
- `src/ui/planner/plannerActiveUi.js`
- `src/ui/planner/loadPlannerActiveUi.js`

O bootstrap instala `installPlannerLazyLoader(globalThis)` apos `loadLegacyClassicScripts(globalThis)`. As bridges globais existentes do Planner sao preservadas e redirecionadas para a UI ativa moderna quando o modal e aberto.

`part-26.js` permanece necessario como fallback legado e compatibilidade de consumidores antigos. `part-27.js` permanece necessario porque ainda compoe feriados usados pelo DSR. Nenhum desses scripts esta autorizado para remocao sem cobertura de regressao de feriados, DSR, eventos locais, registros financeiros persistidos, controle de horas derivado e busca completa de consumidores.

## Atualizacao de isolamento do Planner - 04/09/2026

`part-26.js`, `part-20.js` e `part-27.js` ainda existem por compatibilidade, mas quando `window.financeApp.plannerStorage` esta instalado eles leem eventos/feriados V2 escopados por owner. As chaves V1 globais ficam como legado nao atribuido e nao devem ser migradas automaticamente.

Antes de remover esses scripts, a proxima etapa precisa preservar:

- bridges globais do Planner;
- DSR lendo feriados customizados do owner atual;
- reset de modal/listeners em troca de usuario/logout;
- testes Playwright de isolamento multiusuario no mesmo navegador.

## Atualizacao de Configuracoes e referencias - 04/09/2026

Foi criada uma fatia modular para a UI ativa de Configuracoes sem remover scripts classicos:

- `src/application/readModels/settingsReadModel.js`
- `src/ui/settings/settingsController.js`
- `src/ui/settings/settingsPresenter.js`
- `src/ui/settings/settingsActiveUi.js`
- `src/ui/settings/loadSettingsActiveUi.js`

O bootstrap instala `installSettingsLazyLoader(globalThis)` apos `loadLegacyClassicScripts(globalThis)`. As bridges globais existentes de Configuracoes sao preservadas e redirecionadas para a UI ativa moderna quando a aba e aberta.

`part-03.js` permanece necessario para funcoes legadas de categoria, pessoas, macros e complementos. `part-09.js` permanece necessario para parametros tributarios locais. `part-16.js` e `part-29.js` continuam carregados por outras receitas/descontos, filtros e wrappers de configuracoes. Nenhum script classico desta area esta autorizado para remocao sem regressao especifica de referencias pessoais/globais, tipos de H.E., importacoes, historico, parametros tributarios e consumidores das bridges globais.

## Atualizacao de Administracao de Usuarios - 05/09/2026

Foi criada uma fatia modular para a UI ativa de Administracao de Usuarios sem remover `part-28.js`:

- `src/application/userAdmin/userAdminPermissions.js`
- `src/application/readModels/userAdminReadModel.js`
- `src/ui/admin/userAdminController.js`
- `src/ui/admin/userAdminPresenter.js`
- `src/ui/admin/userAdminActiveUi.js`
- `src/ui/admin/loadUserAdminActiveUi.js`

O carregamento ocorre pela rota lazy de Configuracoes. As bridges `refreshManagedUsers`, `renderManagedUsers`, `setManagedUserRole`, `setManagedUserStatus` e `toggleManagedUserStatus` continuam preservadas. `part-28.js` nao pode ser removido sem nova cobertura de autenticacao, avisos de conta pendente/inativa, logout, bootstrap de perfil, claim admin, troca de usuario e consumidores das bridges.

## Atualizacao de Importacao financeira - 06/09/2026

Foi criada uma fatia modular para a UI ativa de Importacao XLSX sem remover `src/ui/importacao.js`, `part-03.js` ou `part-08.js`:

- `src/application/readModels/importPreviewReadModel.js`
- `src/ui/imports/importController.js`
- `src/ui/imports/importPresenter.js`
- `src/ui/imports/importActiveUi.js`
- `src/ui/imports/loadImportActiveUi.js`

O bootstrap instala um loader lazy em `src/app.js`. O renderer legado ainda e carregado sob demanda para preservar historico, importacao bancaria/CSV e consumidores existentes. O parser XLSX canonico tambem e carregado dinamicamente e continua fora do entry.

Nao ha autorizacao para remover bridges ou scripts classicos de importacao nesta etapa. Antes de qualquer reducao futura sera necessario cobrir importacao bancaria completa, historico/remocao de lote, retry de lazy-load, falha de rede, troca de usuario, smoke visual e busca completa de consumidores.
## Atualizacao de Backup e Restore - 08/09/2026

Foi criada uma fatia modular para a UI ativa de Backup e Restore dentro de Configuracoes, sem remover scripts classicos e sem habilitar restore real:

- `src/application/readModels/backupPreviewReadModel.js`
- `src/application/readModels/restorePreviewReadModel.js`
- `src/ui/backup/backupController.js`
- `src/ui/backup/backupPresenter.js`
- `src/ui/backup/backupDownloadAdapter.js`
- `src/ui/backup/backupActiveUi.js`
- `src/ui/backup/loadBackupActiveUi.js`

O carregamento ocorre pelo caminho lazy de Configuracoes. A interface permite preview, download seguro, upload, validacao e dry-run; `CommitFinanceRestore` e rollback permanecem fora da UI.

Nao ha autorizacao para remover bridges ou implementar restore real client-side. Antes de qualquer passo futuro sera necessario cobrir Firebase Emulator, backend confiavel, permissao administrativa, auditoria server-side, snapshot pre-restore, rollback e busca completa de consumidores.

## Atualizacao de Exportacao PDF - 08/09/2026

Foi criada uma fatia modular para a exportacao ativa do Relatorio Financeiro Gerencial sem remover a bridge global `exportPDF`:

- `src/application/readModels/financialReportReadModel.js`
- `src/ui/reports/reportExportController.js`
- `src/ui/reports/reportExportPresenter.js`
- `src/ui/reports/pdfAdapter.js`
- `src/ui/reports/reportExportActiveUi.js`
- `src/ui/reports/loadReportExportActiveUi.js`

O carregamento ocorre por lazy loader instalado apos os scripts classicos. A biblioteca PDF continua sob demanda por `ensurePdfLibraries`. `part-03.js` permanece carregado porque ainda contem consumidores legados, fallback visual, filtros, dashboard e outras funcoes criticas.

Nao ha autorizacao para remover `exportPDF`, `part-03.js` ou helpers legados de PDF sem busca completa de consumidores, smoke, Playwright e equivalencia funcional ampliada.

## Saida do Loader Legado - 08/09/2026

Primeiro lote concluido sem mudanca funcional: `part-21.js`, `part-22.js`, `part-23.js`, `part-24.js`, `part-25.js`, `part-30.js` e `part-31.js` sairam de `src/legacy/classicScripts.js`. Eles eram placeholders aposentados de Dashboard/graficos, sem funcoes, sem `window.*`, sem DOM, sem `dataSdk` e sem consumidores runtime.

Resultado medido: scripts classicos/eval `33/33 -> 26/26`, bytes carregados pelo loader `776933 -> 776052`, APIs globais `50 -> 50`. Proximo lote recomendado: `performanceMonitor.global.js` e, depois de prova de side effects, `part-12.js`/`part-18.js`.

## Saida do Loader Legado - Segundo Lote - 08/09/2026

Resultado medido: scripts classicos/eval `26/26 -> 24/24`, bytes carregados pelo loader `776052 -> 754753`, APIs globais `50 -> 50`. `src/legacy-globals.js` saiu do eval porque `installGlobalBridge()` instala as bridges de dominio/core por ES Module e e reaplicado depois do pacote classico para restaurar bridges canonicas sobrescritas por declaracoes globais legadas. `src/services/performanceMonitor.global.js` saiu do eval e foi substituido por `src/services/performanceMonitor.js`, carregado como chunk ES explicito. `libraryLoader.global.js` e `legacy-ui.js` ficam bloqueados por consumidores classicos reais.

## Saida do Loader Legado - Terceiro Lote - 08/09/2026

Resultado medido: scripts classicos/eval `24/24 -> 23/23`, bytes carregados pelo loader `754753 -> 751896`, APIs globais `50 -> 50`. `src/services/libraryLoader.global.js` saiu do eval e foi substituido por `src/services/libraryLoader.js` mais `src/legacy/libraryLoaderBridge.js`, mantendo as bridges temporarias para PDF, XLSX e PDFJS sem CDN novo. `legacy-ui.js` permanece bloqueado por consumidores classicos reais e deve ser o proximo alvo somente com cobertura focada de navegacao, overlays, toast e listagens.

## Correcao de Bootstrap dos Loaders - 09/09/2026

Antes de novo lote, a regressao `203.899ms -> 248.914ms` foi investigada. `src/legacy/libraryLoaderBridge.js` virou proxy lazy e nao importa mais `src/services/libraryLoader.js` durante o bootstrap. O loader canonico continua ES Module e e requisitado somente no primeiro uso real de XLSX/PDF/PDFJS. Como `loadMs` final ainda ficou acima do limite orientativo historico por variacao local e volume legado, o proximo lote deve priorizar estabilizacao de benchmark ou reducao dos chunks legados antes de remover novos scripts.

## Decomposicao de UI Legada - 11/09/2026

`src/ui/legacy-ui.js` foi convertido de script raw executado por `eval` para ES Module. O loader classico agora instala `installLegacyUiBridge(globalThis)` antes dos `part-XX`, preservando `window.financeUI` para consumidores existentes.

Resultado estrutural: `classic/eval 23/23 -> 22/22`, bytes do loader `751896 -> 746720`, APIs globais `50 -> 50`. Helpers DOM simples reutilizam `src/ui/dom.js`; toast, overlay, sidebar e tabs ficaram na bridge por ausencia de equivalente canonico com comportamento identico.

Bloqueios remanescentes: `part-03.js`, `part-07.js`, `part-08.js`, `part-14.js`, `part-29.js`, `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` ainda consomem `financeUI`. Proximo lote recomendado: reduzir chamadas diretas de navegacao/overlay em `part-03.js` e `part-29.js` com testes Playwright focados.

## Consumidores `financeUI` - 12/09/2026

O lote recomendado foi executado para `part-03.js` e `part-29.js`: as chamadas diretas a `window.financeUI` nesses dois arquivos foram reduzidas para zero e redirecionadas para `window.financeApp.financeUiAdapters`.

Resultado estrutural naquele lote: `classic/eval 22/22 -> 22/22`, APIs globais `50 -> 50`, novo `eval=0`, `new Function=0`. A bridge `window.financeUI` permanecia por consumidores reais em `part-07.js`, `part-08.js`, `part-14.js`, `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js`.

Proximo lote recomendado: migrar `part-07.js` com cobertura de controle de horas/lista/empty state; depois `part-08.js` e `part-14.js` com foco em configuracoes/listas de pessoas/macros.

## Consumidores modernos `financeUI` - 12/09/2026

O lote seguinte removeu `financeUI` dos modulos modernos e migrou `part-07.js` para o adapter visual temporario:

- `src/ui/importacao.js` usa `src/ui/toast.js`;
- `src/ui/monthDetail/monthDetailEvents.js` usa `src/ui/navigationTabs.js`;
- `src/ui/records/financialCrudControllerInstaller.js` usa injecao local/`src/ui/toast.js`;
- `src/legacy/inline/part-07.js` usa `window.financeApp.financeUiAdapters` para DOM/lista/meta, sem mover calculos.

Resultado estrutural esperado: `modernFinanceUiConsumers=[]`, `part07FinanceUiCalls=0`, consumidores remanescentes diretos somente em `part-08.js` e `part-14.js`. Proximo lote recomendado: migrar `part-08.js` e `part-14.js` apenas com cobertura focada em Configuracoes/listas de pessoas/macros.

## Consumidores criticos `financeUI` - 12/09/2026

Foram caracterizadas as 13 chamadas remanescentes em `part-08.js` e `part-14.js`. O lote seguro migrou somente apresentacao isolavel de Configuracoes:

- `part-08.js` pessoas/macros: `setHtml`/`setHidden` passaram para DOM local;
- `part-14.js` pessoas/tipo de recebimento: `setHtml`/`setHidden` passaram para DOM local;
- `part-08.js:switchTab` permaneceu classico por acoplamento com historico, router, lazy loaders e sidebar, mas sua ativacao visual foi desacoplada de `financeUI`.

Resultado apos a etapa de navegacao: `part08FinanceUiCalls=0`, `part14FinanceUiCalls=0`, `directFinanceUiConsumers=[]`, `navigationBridgeConsumers=[]`, `modernGlobalUiConsumers=[]`, `classic/eval=22/22`. Consumidores runtime indiretos ainda conhecidos: `part-03`, `part-07` e `part-29` via `window.financeApp.financeUiAdapters`. Proximo lote recomendado: estado de navegacao classica (`tabHistory`, `isSidebarOpen`, `switchTab`, `goBackTab`, router e lazy loaders), sem remover `window.financeUI` antes de cobrir adapters, aliases e consumidores dinamicos.
