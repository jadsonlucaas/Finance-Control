# Arquitetura de prontidao multicanal

## Atualizacao de bridge web do CRUD financeiro - 02/09/2026

A aplicacao web agora dispoe de `window.financeApp.financialCrud` como bridge interna para comandos canonicos do CRUD financeiro. Ela nao e uma API multicanal nova, nao adiciona global de topo e nao altera contratos de WhatsApp, telefone, provider externo ou Admin SDK.

Integracoes futuras devem continuar usando o `ApplicationCommandGateway` diretamente com envelopes canonicos e contexto autorizado. A bridge web existe somente para compatibilizar handlers legados enquanto a UI e migrada para modulos.

Esta etapa cria uma fronteira de aplicacao reutilizavel por UI web e por um backend de integracao futuro. Nenhum canal real foi implementado: nao ha WhatsApp, webhook, Meta API, provedor externo, telefone, NLP, mensagens, Admin SDK, deploy ou colecao Firestore nova.

## Fluxo-alvo

```text
Web UI
   |
   v
ApplicationCommandGateway
   |
   v
Command/Query Handler
   |
   v
Domain Use Case
   |
   v
Repository Interface
   |
   v
Firebase Adapter

Future Integration Backend
   |
   +-------> ApplicationCommandGateway
```

## Componentes adicionados

- `src/application/gateway/applicationEnvelope.js`: normaliza e valida envelopes de comando e consulta.
- `src/application/gateway/applicationResult.js`: padroniza respostas de sucesso, erro, warnings, erros de validacao, correlacao e idempotencia.
- `src/application/gateway/authorization.js`: aplica autorizacao pura por contexto autenticado, acao e recurso.
- `src/application/gateway/idempotency.js`: define fingerprint deterministico e store em memoria para testes locais.
- `src/application/gateway/handlerRegistry.js`: resolve handlers por registro explicito, sem `eval`, `window` ou descoberta dinamica por string de arquivo.
- `src/application/gateway/ApplicationCommandGateway.js`: valida envelope, resolve handler, autoriza, trata idempotencia, chama use case e normaliza resultado.
- `src/application/gateway/financeCommandHandlers.js`: contratos e handlers de comandos financeiros.
- `src/application/gateway/financeQueryHandlers.js`: contratos e handlers de consultas financeiras.
- `src/application/useCases`: casos de uso financeiros independentes de DOM, `window`, Firebase e UI.
- `src/application/gateway/InMemoryFinanceRepository.js`: reexport de compatibilidade para testes que ja usavam o repositorio in-memory.
- `src/application/gateway/defaultApplicationGateway.js`: cria o gateway a partir de dependencias injetadas ou do composition root.
- `src/application/repositories`: contratos, erros normalizados, adapters Firebase Web e implementacoes in-memory.
- `src/application/dependencies/createApplicationDependencies.js`: composition root para runtime web e testes.

## Regras de seguranca da fronteira

- `source.channel` informa origem, mas nunca concede permissao.
- O ator do envelope nao substitui o contexto autenticado.
- `ownerUid` nao e aceito livremente pelo payload; handlers aplicam o owner do contexto autenticado.
- Usuarios `pending` ou `inactive` nao executam comandos financeiros.
- Usuario ativo comum opera somente os proprios dados.
- Integracao exige contexto confiavel explicito.
- Administracao segue a politica atual de `role`/claim/permissoes.
- Metadados multicanal nao alteram calculos financeiros.

## Piloto web

O fluxo piloto e a criacao simples de saida no `handleSubmit` legado. A UI continua lendo o formulario e exibindo o mesmo toast, mas a persistencia passa por `ApplicationCommandGateway` quando disponivel. Parcelamentos, recorrencias e edicoes permanecem no caminho legado nesta etapa.

Fluxo final do piloto:

`UI -> CreateExpenseCommand -> ApplicationCommandGateway -> handler -> FinanceRecordRepository -> FirebaseFinanceRecordRepository -> FinanceRepository/dataSdk -> Firestore Web adapter -> ApplicationResult -> toast`.

Em testes, o mesmo handler recebe `InMemoryFinanceRecordRepository` explicitamente.

## Camada de casos de uso

Em 22/08/2026, operacoes financeiras principais foram centralizadas em `src/application/useCases/financeRecordUseCases.js`.

- Casos consolidados: `CreateExpense`, `UpdateExpense`, `MarkExpenseAsPaid`, `ArchiveExpense`, `DeleteExpense`, `CreateIncome`, `ConsolidateMonthlyIncome`, `CreateInstallmentSeries`, `CreateRecurrenceSeries`, `CreateHourEntry` e `UpdateHourEntry`.
- `financeCommandHandlers.js` passa a ser uma camada fina de delegacao entre envelope/gateway e use case.
- Auditoria de mutacoes financeiras passa por helper padronizado em `auditUseCaseEvents.js`.
- O backend futuro deve montar contexto autorizado e chamar o mesmo gateway/caso de uso; nenhum canal externo real foi criado.

## Migracao incremental do legado

Em 22/08/2026, `src/ui/legacy-events.js` deixou de ser carregado como texto via loader classico e passou a ser instalado como ES Module por `bootstrapApp()`.

- O backend futuro continua sem depender de scripts legados ou DOM.
- Bridges temporarias seguem limitadas ao runtime web legado.
- `classicScripts.js` permanece somente para os scripts ainda nao migrados.
- Nenhum WhatsApp, webhook, telefone, Admin SDK ou permissao publica foi criado.

## Garantias desta etapa

- Nao houve nova global top-level inventariada.
- Nao houve alteracao de regras financeiras, tributarias, parcelamentos, recorrencias, jornada, importacao, relatorios ou Firebase Rules.
- Nao houve deploy, push, pull, fetch, rebase, migracao de dados ou escrita em Firebase real.
- A implementacao em memoria serve apenas para testes locais e simulacao de consumidor server-side.

## Reducao de globais e backend futuro

Em 22/08/2026, foi criada a politica `docs/global-api-reduction-policy.md` e o diagnostico `docs/global-api-reduction-diagnostic.md`.

- Bridges de dominio/core passaram a ser registradas por `defineLegacyGlobalBridge`.
- Colisoes de bridge falham em teste/dev.
- `window.financeApp.installLegacyEventBindings` foi removido por ausencia de consumidor.
- `window.financeEvents` permanece somente como compatibilidade web.
- Backend futuro deve continuar importando `src/application`/`src/domain`, sem conhecer `window.financeApp`, `window.financeEvents` ou scripts classicos.

## Idempotencia persistente e metadata operacional

Em 22/08/2026, o gateway passou a reservar receipts persistiveis para comandos com `idempotencyKey`.

- `src/application/gateway/operationMetadata.js` centraliza origem, autoria, schema, correlacao e chaves.
- `src/application/gateway/idempotency.js` define fingerprint deterministico, chave logica e builder de receipt.
- `src/application/repositories/idempotencyRepositories.js` fornece `InMemoryIdempotencyRepository` e `FirebaseWebIdempotencyRepository`.
- `CreateExpenseCommand` e o piloto real: primeira execucao cria; replay identico retorna `IDEMPOTENT_REPLAY`; payload diferente retorna `CONFLICT`.
- O path privado e `users/{uid}/idempotency_receipts/{receiptId}`.
- A reserva Firebase Web usa transacao.
- `source.channel` segue como metadata e nao concede autorizacao.
- O backend futuro devera usar o mesmo contrato; nenhum WhatsApp, webhook, telefone, provider, Admin SDK ou colecao de mensagens foi criado.

## Importacoes idempotentes

Em 22/08/2026, a fronteira de importacao ganhou casos de uso locais independentes de DOM/Firebase direto:

- `PrepareImportBatch` faz preview idempotente e classificacao de candidatos.
- `CommitImportBatch` usa receipts persistiveis e `FinanceRecordRepository.createMany`.
- `bank_import` e `spreadsheet_import` continuam sendo apenas canais de metadata.
- O dry-run `npm run import:dry-run` usa somente repositorios em memoria e massa sintetica.

Essa etapa nao implementa provider externo, webhook, telefone, mensagens ou backend multicanal real.

## Migracao XLSX para pipeline idempotente

Em 22/08/2026, o fluxo local XLSX de saidas e entradas passou a compartilhar o pipeline canonico de importacoes:

- `src/application/imports/spreadsheetImportParser.js` mapeia planilhas para payloads normalizados sem DOM, `window`, Firebase ou persistencia.
- `src/application/imports/importPipelineRuntime.js` instala `window.financeApp.importPipeline` como bridge temporaria para a UI legada.
- `src/legacy/inline/part-03.js` continua cuidando de arquivo, DOM e relatorio, mas delega preview/commit para `PrepareImportBatch` e `CommitImportBatch`.
- A persistencia XLSX ocorre por `FinanceRecordRepository.createMany`/`dataSdk.createMany`, nao por loop de `window.dataSdk.create`.
- `npm run import:xlsx-dry-run` valida localmente duplicidade, legado, conflito, invalidas e commit atomico.
- Nenhum Firebase real, deploy, webhook, WhatsApp, telefone, provider externo, Admin SDK ou regra financeira foi alterado.

## Materializacao Percentual

`MaterializePercentageRulesForCompetence` esta preparado para chamada por consumidor confiavel futuro porque recebe contexto, repositories e clock por injecao. O runner local `financeApp.percentageRuleMaterializationRunner` usa o mesmo caso de uso sem depender de DOM/window para calcular ou persistir.

A materializacao automatica usa `source_channel=system`. O nome `percentage_rule_materialization` permanece como operacao/processo em `command_name`, auditoria e `source_reference_id`, preservando a taxonomia multicanal: channel nao e operation.

O fluxo agora reconcilia falha parcial entre `createIfAbsent` e `receipt.complete`: retry valida a entidade deterministica existente, completa receipt `processing` como `RECONCILED_EXISTING` e evita duplicidade de ocorrencia/auditoria. Um backend server-side futuro deve reutilizar a mesma validacao antes de completar receipts orfaos.

## Auditoria multicanal futura

Auditoria canonica passa a aceitar `source_channel=future_integration` para testes locais e desenho de contratos, sem implementar WhatsApp, webhook, telefone ou provider externo. Canal e operacao continuam separados: `source_channel` identifica origem; `operation` e `command_name` identificam o caso de uso.

Backends futuros devem reaproveitar `AuditTrailService`, gravar `AuditEvent` com `correlation_id` obrigatorio e elevar o nivel de confianca para server-side. Ate la, a auditoria web permanece rastreavel, mas client-side.

Nesta etapa nao ha webhook, provider WhatsApp, telefone, colecao de mensagens, Cloud Function ou Admin SDK. O backend futuro deve resolver identidade e autorizacao antes de chamar o caso de uso.

## Backup e recuperacao segura

`src/application/backup/financeBackupUseCases.js` prepara consumo futuro por backend confiavel sem acoplar a UI ou Firebase direto.

- A UI web e um backend futuro podem chamar os mesmos casos por contexto e repositorios injetados.
- `source_channel` segue sendo metadado e nao concede permissao.
- O owner efetivo vem do contexto autorizado.
- Restore real de producao deve ser implementado somente em backend confiavel futuro, com Admin SDK e aprovacao operacional explicita.
- A etapa atual cobre somente contrato local, testes em memoria e dry-run; nao ha webhook, WhatsApp, telefone, provider externo, deploy ou Firebase real.

## Performance para consumidores futuros

Em 23/08/2026, a composicao web passou a carregar repositorios Firebase sob demanda. Consumidores futuros devem continuar chamando casos de uso por `context` e `repositories`, sem depender do bundle web inicial.

- `source_channel` permanece metadata, nao permissao.
- Paginacao por `limit`/`cursor` deve ser preservada em adapters server-side futuros.
- Subscriptions devem ter ciclo de vida explicito e cancelamento por owner.
- Backends futuros devem implementar consultas nativas e indices planejados antes de trafego real.
- Nenhum provider externo, WhatsApp, telefone, Admin SDK, deploy ou Firebase real foi adicionado nesta etapa.

## Resiliencia para consumidores futuros

Em 30/08/2026, a taxonomia de erros passou a ser reutilizavel por backend/chatbot futuro sem implementar canal externo.

- Codigos de `ApplicationError` sao estaveis e serializaveis.
- Mensagem de UI nao deve ser usada como regra de negocio.
- `source_channel` continua sendo metadata e nao muda politica de erro, autorizacao ou retry.
- Retry futuro de integracao deve usar a mesma politica conservadora e a mesma `idempotencyKey`.
- Nao existe erro especifico de WhatsApp, telefone, provider, webhook, Admin SDK ou colecao de mensagens nesta etapa.
- `executeWithResilience` e `RetryPolicy` funcionam sem DOM/browser e podem ser consumidos por backend futuro com repositorios injetados.

## Reconciliacao pos-commit para consumidores futuros

Em 01/09/2026, consumidores futuros ganharam um contrato local para diferenciar falha antes do commit de resposta perdida depois do commit.

- Todo consumidor deve preservar `MutationAttemptContext` enquanto o payload nao mudar.
- Resposta `uncertain` nao autoriza novo envio automatico; deve chamar `ReconcileMutationAttempt`.
- Reconciliacao consulta receipt e entidade existente; nao cria registro financeiro.
- Backend futuro deve expor esse fluxo por canal confiavel mantendo `source_channel` como metadata, nao como permissao.
- Nao foi criado webhook, WhatsApp, telefone, provider externo, Admin SDK, deploy, fila offline ou Firebase real.

## Dashboard/read models para consumidores futuros

Em 02/09/2026, Dashboard, Saidas e Entradas ganharam read models puros reutilizaveis por UI web ou backend futuro com repositorios injetados.

- `dashboardReadModel` funciona sem DOM, `window`, Chart.js, Firebase ou provider externo.
- `source_channel` continua metadata neutra e nao altera calculo, filtro ou autorizacao.
- KPIs recebem dataset completo autorizado pelo chamador; listagens podem paginar visualmente sem alterar totais.
- `dashboardChartData` prepara series de grafico sem depender de Chart.js.
- `ExpenseListReadModel` e `IncomeListReadModel` assumem dataset ja escopado por owner e suportam detalhe por `id`.
- Nao foi criado WhatsApp, webhook, telefone, provider externo, Admin SDK, deploy ou Firebase real.

## Planner local e readiness multicanal

Em 04/09/2026, eventos manuais do Planner e feriados customizados foram isolados por owner no armazenamento local da interface web. Eles continuam sendo estado local da UI, nao contratos multicanal.

- `plannerLocalEventStore` exige owner explicito, usa chaves V2 por owner e nao toca Firebase real.
- Chaves V1 globais permanecem como legado nao atribuido e nao devem ser migradas automaticamente.
- Backend, WhatsApp ou outros canais futuros devem receber implementacao propria de repositorio/caso de uso, sem ler `localStorage` nem depender das bridges globais.
- O controller moderno do Planner recebe `readSource`, `localEventStore`, `ownerProvider` e `financialActions` por injecao.
- A bridge web atual segue adaptada em `src/app.js`, mantendo `plannerController` e `plannerActiveUi` desacoplados de `window.financeApp.financialCrud`.

## Configuracoes para consumidores futuros

Em 04/09/2026, Configuracoes ganhou `settingsReadModel` como leitura pura reutilizavel por UI web ou backend futuro com repositorios injetados.

- O read model funciona sem DOM, `window`, Firebase, `dataSdk`, provider externo ou canal de mensagem.
- Referencias pessoais e compartilhadas permanecem separadas; o owner efetivo vem do contexto autenticado.
- Permissoes sao refletidas no modelo, mas autorizacao definitiva continua nos casos de uso, Rules ou backend confiavel.
- Parametros tributarios e regras percentuais sao expostos como configuracao ja persistida, sem recalculo ou materializacao.
- A UI web atual adapta as bridges legadas em `src/app.js`; consumidores futuros devem chamar casos de uso/repositorios diretamente, sem depender dessas bridges.

## Administracao de Usuarios para consumidores futuros

Em 05/09/2026, a Administracao de Usuarios ganhou read model e controller locais sem criar canal externo.

- `userAdminReadModel` funciona sem DOM, `window`, Firebase, provider externo ou canal de mensagem.
- `userAdminPermissions` diferencia admin por claim, admin/owner por perfil ativo e usuario inativo.
- A UI web apenas adapta `userAdminSdk`; backend futuro deve expor administracao por credencial confiavel propria.
- Custom claims continuam fora do cliente e nao foram emitidas por esta etapa.
- Nao foi criado WhatsApp, webhook, telefone, provider externo, Admin SDK, deploy ou Firebase real.

## Importacao para consumidores futuros

Em 06/09/2026, a UI ativa de Importacao passou a consumir o pipeline moderno sem virar fonte de contrato. Consumidores futuros devem reutilizar `PrepareImportBatch`, `CommitImportBatch`, `spreadsheetImportParser` e `ImportPreviewReadModel` por imports explicitos e repositorios injetados.

- `source_channel=spreadsheet_import` continua metadata, nao permissao.
- UI web nao chama Firebase nem `dataSdk` diretamente no caminho moderno de XLSX.
- Response-lost deve preservar `MutationAttemptContext` e reconciliar antes de reenviar.
- Sem colecao duravel de `import_batches`, estados incertos ainda podem exigir suporte/reconciliacao operacional.
- Backend futuro pode reaproveitar os casos de uso, mas deve implementar credenciais, repositorios e autorizacao proprios.
- Nao foi criado WhatsApp, webhook, telefone, provider externo, Admin SDK, deploy, push ou Firebase real.

## Saida do Loader e Backend Futuro - 08/09/2026

O primeiro lote de saida do loader removeu apenas placeholders aposentados do carregamento classico. O backend/chatbot futuro continua autorizado a depender somente de `src/domain` e `src/application`; nao deve carregar `window`, `classicScripts`, `eval`, `part-XX` nem bridges globais.

`npm run legacy-loader:check` protege esta fronteira: nenhuma importacao de `src/legacy/**` em `src/application/**` ou `src/domain/**`, nenhum novo `eval`, nenhum `new Function`, globals `<= 50` e scripts classicos/eval no teto vigente do lote atual.

## Loaders de Bibliotecas e Backend Futuro

Em 08/09/2026, `src/services/libraryLoader.global.js` saiu do classic/eval loader. A fonte canonica passou a ser `src/services/libraryLoader.js`, com bridge apenas em `src/legacy/libraryLoaderBridge.js` para consumidores web legados de PDF, XLSX e PDFJS. Essa decisao mantem o backend futuro isolado de `window`, `classicScripts`, `eval`, `part-XX`, DOM e loaders globais. Bibliotecas de navegador continuam fronteira de UI; casos de uso em `src/application/**` e `src/domain/**` nao dependem delas.

## Busca administrativa futura

Em 05/09/2026, apenas filtros exatos de `users` foram validados como escalaveis no Firestore Web: `status`, `role` e `status + role`. Busca global por nome/email deve ser contrato de backend/provedor futuro com autorizacao propria e sincronizacao planejada.

Consumidores futuros nao devem interpretar o campo visual "Buscar na pagina" como API de full-text. O contrato atual de repositorio usa cursor opaco e nao expõe snapshots Firebase.
## UI de Backup/Restore para consumidores futuros

Em 08/09/2026, Backup e Restore ganharam uma UI ativa local para preview, download, upload, validacao e restore dry-run. Essa UI nao e contrato de integracao externo e nao executa restore real.

- Read models de backup e restore funcionam sem DOM, `window`, Firebase, `dataSdk`, provider externo ou canal de mensagem.
- O controller web chama casos de uso com contexto e repositorios injetados.
- Restore real continua reservado para backend confiavel futuro, com Admin SDK server-side, auditoria server-side, permissao operacional e testes no Firebase Emulator.
- O adapter de download e apenas infraestrutura browser; consumidores futuros devem serializar e armazenar snapshots por contrato proprio.
- Nao foi criado WhatsApp, webhook, telefone, provider externo, Admin SDK, deploy, push ou Firebase real.

## Relatorios PDF para consumidores futuros

Em 08/09/2026, o Relatorio Financeiro Gerencial ganhou `FinancialReportReadModel` puro para reutilizacao futura por backend confiavel ou outro consumidor autorizado.

- O read model funciona sem DOM, `window`, Firebase, `dataSdk`, jsPDF, autotable, provider externo ou canal de mensagem.
- `source_channel` nao altera conteudo financeiro.
- O backend futuro deve resolver identidade e autorizacao antes de montar o report model.
- O adapter web de PDF e apenas infraestrutura de navegador e nao deve ser usado como contrato server-side.
- Nao foi criado WhatsApp, webhook, telefone, provider externo, Admin SDK, deploy, push ou Firebase real.

## Bridges Globais e Backend Futuro - 08/09/2026

`src/legacy-globals.js` e `src/services/performanceMonitor.global.js` sairam do classic/eval loader. A compatibilidade restante passa por installers ES explicitos (`installGlobalBridge()` e `installPerformanceMonitor()`), mas isso continua sendo superficie temporaria de frontend. Integracoes futuras, backend, webhook ou canais externos devem depender apenas de casos de uso, contratos de aplicacao e servicos explicitamente injetados.

## Bootstrap e Loaders Lazy - 09/09/2026

`src/legacy/libraryLoaderBridge.js` e uma bridge temporaria de frontend e nao e contrato para backend, webhook, chatbot ou provider externo. A implementacao canonica `src/services/libraryLoader.js` permanece restrita a bibliotecas de navegador e e carregada sob demanda. Consumidores futuros devem depender de casos de uso/read models puros, nao de `window`, DOM, CDN, PDF/XLSX browser ou bridges globais.

## Observabilidade de Bootstrap - 11/09/2026

As marcas de bootstrap sao diagnostico local de frontend. Elas nao enviam telemetria externa, nao criam provider, nao mudam contratos de integracao e nao devem ser usadas por backend/chatbot futuro como API funcional.

Consumidores futuros continuam devendo depender de contratos explicitos em `src/application/**` e `src/domain/**`. `financePerformance`, Performance marks, `classicScripts`, `eval`, `part-XX` e bridges globais continuam superficies temporarias ou diagnosticas do frontend.

## UI Legada e Integracoes Futuras - 11/09/2026

`financeUI` continua sendo bridge temporaria de frontend para consumidores legados. A migracao para ES Module reduz `eval`, mas nao transforma `financeUI` em contrato para backend, chatbot, webhook ou provider externo.

Integracoes futuras devem ignorar `window.financeUI`, DOM, overlays, toast, sidebar e tabs. O backend deve continuar usando apenas `src/application/**`, `src/domain/**`, contratos de payload e servicos explicitamente injetados.

## Adapter visual para consumidores legados - 12/09/2026

`window.financeApp.financeUiAdapters` e um adapter temporario de frontend para scripts classicos que ainda nao podem importar ES Modules diretamente. Ele nao e contrato de backend, chatbot, webhook, WhatsApp, provider externo ou Admin SDK.

O adapter nao acessa Firebase, `dataSdk`, auth, regras financeiras ou persistencia. Consumidores futuros devem continuar dependendo de `src/application/**`, `src/domain/**` e portas explicitamente injetadas, nunca de DOM, `window.financeUI` ou `financeUiAdapters`.

## Fronteira moderna sem `financeUI` - 12/09/2026

Os modulos modernos de Importacao, Month Detail e records nao dependem mais de `window.financeUI` nem de `window.financeApp.financeUiAdapters`. Isso reforca que a bridge visual e somente compatibilidade de frontend legado.

Consumidores futuros, backend, chatbot, WhatsApp, webhook, provider externo e Admin SDK continuam proibidos de usar `window.financeUI`, `financeUiAdapters`, DOM, toast, sidebar, tabs ou scripts `part-XX`. A entrada correta permanece em casos de uso/read models de `src/application/**` e regras puras de `src/domain/**`.
