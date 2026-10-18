# Estado atual da arquitetura

Gerado em: 2026-07-18

Este documento registra o baseline tecnico atual do repositorio antes de novas refatoracoes. O objetivo e preservar o comportamento existente, especialmente regras financeiras, fluxo de interface, sincronizacao Firebase/localStorage e contratos globais usados pelos scripts legados.

Observacao: o prompt cita `src/legacy/legacyLoader.js`, mas esse arquivo nao existe no estado atual do repositorio. O carregador legado ativo e `src/legacy/classicScripts.js`.

## Visao geral

A aplicacao e um app Vite com ponto de entrada em `src/app.js`. O bootstrap moderno instala templates, estado global, repositorio financeiro, helpers de UI, construtores de payload, mutacoes de registros, importacao, seletores financeiros e modulos de detalhe mensal. Depois disso, carrega scripts legados por concatenacao/eval global atraves de `src/legacy/classicScripts.js`.

O legado ainda domina parte importante da interface e da orquestracao de eventos. Para manter compatibilidade, varios modulos modernos expõem APIs em `window`, e o loader legado instala tambem funcoes globais historicas como renderizadores, navegacao, importadores, exportacao PDF e calculos financeiros.

O Firebase e instalado de forma assincrona apos o carregamento legado. Quando disponivel, `installFirebaseServicesWhenReady` instala `authSdk`, `dataSdk`, `userAdminSdk`, auditoria, sincronizacao de localStorage em nuvem e proxy legado do `FinanceRepository`.

## Fluxo de inicializacao

1. `src/app.js` importa CSS, bibliotecas visuais locais e templates.
2. `installTemplates` injeta a estrutura base da UI.
3. Estado e caches modernos sao instalados em `window` por `src/state/appState.js` e `src/state/financeRecordIndex.js`.
4. `FinanceRepository` e configurado com alvo `auto` e exposto para compatibilidade.
5. Bridges globais, tema, icones, helpers de registros, componentes de UI e formularios sao registrados.
6. `loadLegacyClassicScripts` carrega o legado em ordem fixa.
7. O loader legado importa renderizadores e roteador modernos que ainda encapsulam comportamento legado.
8. `installFirebaseServicesWhenReady` conecta Firebase Auth, Firestore, auditoria, sincronizacao e repositorio.

## Mapa de dependencias

- `src/app.js` depende de `src/ui/templates.js`, `src/services/localVisualLibraries.js`, `src/state/appState.js`, `src/domain/FinanceRepository.js`, `src/legacy/globalBridge.js`, `src/legacy/storageSync.js`, `src/legacy/theme.js`, `src/legacy/recordHelpers.js`, `src/state/financeRecordIndex.js`, componentes de UI, modulos de registros, seletores financeiros, importacao e parcelamentos.
- `src/legacy/classicScripts.js` depende de `src/legacy-globals.js`, servicos globais de biblioteca/performance, UI/eventos legados e arquivos `src/legacy/inline/part-03.js` a `part-31.js`.
- `src/services/installFirebaseServices.js` depende de `firebase.js`, `auth.js`, `dataSdk.js`, `userAdmin.js`, `audit.js` e configura o `FinanceRepository` para usar um proxy do SDK legado.
- `src/services/dataSdk.js` depende do Firestore/Auth e centraliza CRUD de registros financeiros, cache local, snapshots, colecoes compartilhadas e sincronizacao de localStorage.
- `src/ui/router.js` depende do `window.switchTab` legado. Ele encapsula a navegacao por hash sem substituir a semantica visual da troca de abas.
- Modulos em `src/domain` e `src/application` sao a zona mais estavel para regras puras e casos de uso, mas ainda ha duplicacao com funcoes legadas expostas em `window`.

## Modulos modernos

- `src/core`: constantes, datas, formatadores, dinheiro e helpers de storage.
- `src/domain`: regras e modelos de dashboard, entradas, DSR, horas, impostos, importacoes, parcelamentos, regras percentuais, payloads e schemas.
- `src/application`: casos de uso para entradas, registros e seletores financeiros.
- `src/services`: Firebase, Auth, Firestore, auditoria, mutacoes financeiras, sanitizacao, bibliotecas externas, icones, performance e administracao de usuarios.
- `src/state`: estado global proxyado e indice em memoria de registros financeiros.
- `src/ui`: componentes, templates, dashboard, detalhe mensal, renderizacao de listas, importacao bancaria, eventos legados e roteador.

## Areas legadas

- `src/legacy-globals.js`: inicializa variaveis globais historicas.
- `src/legacy/classicScripts.js`: carregador principal do legado.
- `src/legacy/inline/part-03.js`: concentra grande parte da aplicacao classica, incluindo navegacao, formularios, renderizacao, importacao XLSX e exportacao PDF.
- `src/legacy/inline/part-04.js`: contem calculos historicos de impostos e salario liquido expostos em `window`.
- `src/legacy/inline/part-05.js` a `part-31.js`: complementos legados para entradas, detalhes, controle de horas, configuracoes, calendario, regras percentuais, armazenamento e eventos auxiliares.
- `src/ui/legacy-ui.js` e `src/ui/legacy-events.js`: compatibilidade DOM, delegacao de eventos e handlers para a UI antiga.

## APIs globais

O inventario atual foi regenerado por `npm run inventory:globals` e esta em `docs/global-api-inventory.md`. Foram detectadas 57 entradas globais/API.

Globais criticos preservados:

- Navegacao e renderizacao: `switchTab`, `goBackTab`, `renderDashboard`, `renderSaidas`, `renderEntradas`.
- Formularios e CRUD: `handleSubmit`, `editRecord`, `deleteRecord`, `duplicateRecord`.
- Entradas e calculos: `consolidarEntradaMensal`, `calcularINSS`, `calcularIRRF`, `calcularLiquido`, `calcularDSR`, `openEntryDetailModal`, `openEntryOtherRevenuesModal`, `getEntryOtherRevenueRecords`.
- Importacao/exportacao: `importSaidasSpreadsheet`, `importEntradasSpreadsheet`, `exportPDF`, `ensureSpreadsheetLibrary`, `ensurePdfLibraries`.
- Firebase e persistencia: `dataSdk`, `authSdk`, `userAdminSdk`, `cloudLocalStorageSync`, `firebaseBatchDeleteRecords`.
- Estado e repositorio: `financeApp`, `financeRepository`, `financeState`, `financeRecordMutations`, `financeRecordPayloadBuilders`.

## Handlers inline e eventos

O HTML moderno evita handlers inline diretos como `onclick`, `onchange` e `onsubmit`. O inventario continua monitorando esses atributos. A compatibilidade atual e feita principalmente por:

- IDs historicos usados por scripts legados.
- Atributos `data-legacy-*` nos templates.
- Delegacao central em `src/ui/legacy-events.js`.
- Funcoes globais chamadas por renderizadores legados.

Qualquer migracao deve preservar os nomes globais ate que o inventario confirme que nao ha consumidores.

## Firebase

Servicos ativos:

- `src/services/firebase.js`: inicializa Firebase App, Auth e Firestore do projeto `finance-control-cce4f`.
- `src/services/auth.js`: login, cadastro, logout, persistencia de sessao do navegador e normalizacao de erros.
- `src/services/userAdmin.js`: perfil de usuario, listagem administrativa e atualizacao de status/papel.
- `src/services/dataSdk.js`: CRUD financeiro, snapshots em tempo real, cache, localStorage em nuvem e colecoes compartilhadas.
- `src/services/audit.js`: registro de eventos em `audit_logs`.

Fluxo de autenticacao:

1. Auth usa `browserSessionPersistence`.
2. Mudancas de usuario emitem `authStateChanged`.
3. `userAdminSdk.ensureProfile` cria perfil padrao quando necessario.
4. `dataSdk` assina registros do usuario, colecoes compartilhadas e chaves sincronizadas.
5. Logout limpa assinaturas, cache em memoria e dados locais escopados ao usuario.

## Colecoes do Firestore

Regras principais em `firestore.rules`:

- `users/{uid}`: perfil do usuario. Leitura pelo proprio usuario ou admin. Criacao pelo proprio usuario com `role=user` e `status=pending`. Atualizacao restrita para preservar `role` e `status` pelo proprio usuario.
- `users/{uid}/finance_records/{recordId}`: registros financeiros do usuario. Tipos permitidos: `saida`, `entrada`, `pessoa`, `categoria`, `macro`, `controle_horas`, `salario_historico`, `percentage_rule`.
- `users/{uid}/local_storage/{key}`: espelho em nuvem de chaves `finance-control-*`.
- `users/{uid}/audit_logs/{logId}`: trilha de auditoria append-only para usuario ativo; update e delete sao negados inclusive para admin client-side.
- `shared_macros/{docId}`: macros globais compartilhadas.
- `shared_categories/{docId}`: categorias globais compartilhadas.
- `tax_parameters/{parameterId}`: parametros tributarios versionados para INSS/IRRF, leitura por usuario ativo e escrita por admin ativo com shape valido.

## Politica de autoridade administrativa

A politica vigente e **Politica A - Claim confiavel independente**.

- Custom claim `admin: true`: autoridade administrativa confiavel para bootstrap e recuperacao, emitida somente fora do cliente por Console Firebase, script Firebase Admin SDK ou backend confiavel. Nao depende de perfil Firestore ativo para operacoes administrativas previstas nas Rules.
- Role `admin` no perfil: autoridade administrativa baseada em `users/{uid}.role`, valida somente quando `status == 'active'`.
- Role `owner` no perfil: autoridade equivalente a admin nas Rules quando `status == 'active'`; representa autoridade operacional maxima no app, mas nao cria custom claims.
- Status `pending`: estado inicial de novas contas; bloqueia acesso financeiro ate aprovacao administrativa.
- Status `active`: controla acesso comum do usuario as proprias subcolecoes e habilita autoridade por perfil.
- Status `inactive`: bloqueia acesso pessoal as proprias subcolecoes. Se houver custom claim `admin: true`, a autoridade administrativa permanece para recuperacao, mas nao para operacoes pessoais nos proprios dados financeiros.
- Bootstrap e recuperacao: devem usar custom claim emitida por ambiente confiavel. O cliente nao consegue criar, editar ou simular custom claim.
- Integracao server-side futura: chatbot/WhatsApp deve usar backend com credencial server-side confiavel. Firebase Admin SDK server-side normalmente nao depende das Firestore Rules do cliente; ainda assim, as Rules permanecem fechadas para clientes nao confiaveis e nenhum codigo de chatbot foi implementado nesta etapa.

## localStorage

A aplicacao usa localStorage como compatibilidade historica e como fonte auxiliar de configuracoes. As chaves sincronizaveis usam prefixo `finance-control-`.

Chaves e usos relevantes:

- `finance-control-theme-v1`: tema claro/escuro.
- `finance-control-tax-settings-v1`: configuracoes de impostos.
- `finance-control-overtime-types-v1`: tipos de hora extra.
- `finance-control-custom-holidays-v1`: feriados personalizados legados sem owner, tratados como nao atribuidos.
- `finance-control-planner-events-v1`: eventos legados do planejador sem owner, tratados como nao atribuidos.
- `finance-control-custom-holidays-v2:{ownerHash}`: feriados personalizados do Planner escopados por owner.
- `finance-control-planner-events-v2:{ownerHash}`: eventos locais do Planner escopados por owner.
- `finance-control-entry-sources-v1`: fontes de entrada.
- `finance-control-hidden-entry-sources-v1`: fontes ocultas.
- `finance-control-percentage-exit-rules-v1`: regras percentuais.
- `finance-control-performance-baselines`: baselines de performance.
- `finance-control-user-records-cache-v1-{uid}`: cache local de registros por usuario.
- `finance-control-user-records-cache-active-v1`: usuario ativo do cache.
- `finance-control-cloud-local-storage-reloaded-v1`: controle de recarga apos sincronizacao.

`src/legacy/storageSync.js` e `src/services/dataSdk.js` interceptam operacoes de Storage para sincronizar chaves permitidas com Firestore. As chaves de cache de registros sao excluidas dessa sincronizacao.

## Cache de registros

Ha dois niveis principais de cache:

- Cache persistente em localStorage gerenciado por `src/services/dataSdk.js`, com TTL de 15 minutos por usuario.
- Indice em memoria em `src/state/financeRecordIndex.js`, organizado por tipo, competencia, pessoa, status e cache de consultas.

O estado de cache e exposto por `window.__financeCacheState` e eventos `financeCacheStateChanged`. O indice em memoria expõe helpers globais para criar, consultar e invalidar registros financeiros.

## Importacao e exportacao

Importacao XLSX legada:

- Implementada principalmente em `src/legacy/inline/part-03.js`.
- Usa `ensureSpreadsheetLibrary` para carregar XLSX.
- Opera em fluxos de Saidas e Entradas.
- Gera assinaturas de importacao para deduplicacao e permite remocao de itens importados.

Importacao bancaria:

- Implementada em `src/ui/importacao.js`.
- Processa CSV/PDF de bancos suportados.
- Importa registros como `saida`, com `source_mode=import` no contrato canonico, leitura compativel com legado `source_mode=imported`, `import_source=bank:*`, `import_batch_id` e assinaturas de deduplicacao.
- Para PDF Itau, usa PDF.js sob demanda.

Exportacao PDF:

- Implementada no legado, com entrada global `exportPDF`.
- Usa `ensurePdfLibraries`, jsPDF e autotable carregados sob demanda.

## Fronteiras de dominio

- Dominio puro: calculos de dinheiro, datas, horas, DSR, impostos, entradas, importacoes, parcelamentos e regras percentuais.
- Aplicacao: montagem de payloads, consolidacao, mutacoes de registros e seletores.
- Servicos: Firebase, Auth, Firestore, auditoria, bibliotecas externas e sincronizacao.
- Estado: proxy global e indices/cache em memoria.
- UI: templates, renderizadores, modais, toasts, delegacao de eventos e roteamento.
- Legado: qualquer comportamento ainda acoplado a `window`, DOM por ID fixo, scripts concatenados ou funcoes inline historicas.

## Riscos de regressao

- Ordem de carga: funcoes globais podem ser sobrescritas se o bootstrap moderno e o legado mudarem de ordem.
- Corrida de inicializacao: Firebase e instalado apos o legado; renderizadores devem tolerar `dataSdk` ainda indisponivel.
- Duplicacao de regras financeiras: calculos de impostos, entradas, DSR, horas e regras percentuais existem entre dominio moderno e legado.
- localStorage: o patch de `Storage.prototype` afeta leitura/escrita global e pode gerar efeitos colaterais em testes e navegadores.
- Cache: leituras iniciais podem vir de cache local antes do snapshot Firestore.
- Colecoes compartilhadas: macros/categorias globais sao mescladas aos registros do usuario e podem sobrescrever duplicatas logicas.
- Navegacao: `src/ui/router.js` depende da semantica de `window.switchTab` e `goBackTab`.
- Importacao/exportacao: dependem de bibliotecas carregadas sob demanda e de contratos globais usados pelo smoke.
- Arquivo ausente: `src/legacy/legacyLoader.js` citado em prompts/documentos nao existe; a referencia correta atual e `src/legacy/classicScripts.js`.

## Sequencia segura de migracao

1. Manter este baseline atualizado com testes, build, smoke e inventario de globais antes de cada etapa.
2. Migrar primeiro funcoes puras ja cobertas ou de baixo acoplamento, preservando bridges em `window`.
3. Consolidar calculos duplicados em `src/domain`, sem alterar nomes globais nem formato dos resultados.
4. Extrair mapeadores de importacao para dominio/aplicacao mantendo os mesmos campos persistidos.
5. Migrar renderizadores pequenos para componentes modernos, mantendo IDs e eventos esperados.
6. Migrar modais e listas de Entradas/Saidas apos ampliar testes de congelamento visual/comportamental.
7. Reduzir APIs globais uma a uma apenas quando o inventario e os testes confirmarem ausencia de consumidores.

## Proximos componentes de menor risco

Esta lista representa somente candidatos para analise futura. Menor acoplamento aparente nao significa baixo impacto funcional. Nenhum componente listado esta autorizado para migracao sem testes de regressao especificos, analise de consumidores e preservacao das bridges globais.

- Wrappers de configuracao local de calendario/feriados em `part-26.js`.
- Fontes de entrada e regras percentuais em `part-29.js`, mantendo as chaves de localStorage.
- Mapeadores puros de importacao hoje concentrados em `part-03.js`.
- Builders de dados para PDF antes de mexer no desenho jsPDF.
- View models de linhas de registros, aproveitando `src/ui/records/recordListRenderer.js`.
- Bridges de calculo que ja possuem equivalentes em `src/domain`.

## Validacao do baseline

Comandos obrigatorios para este baseline:

- `npm run inventory:globals`
- `npm test`
- `npm run build`
- `npm run smoke`

Resultado da validacao deve ser registrado no fechamento da tarefa.

## Resultado da validacao do baseline

Executado em: 18/07/2026

- npm run inventory:globals: aprovado
- npm test: 45 arquivos de teste aprovados
- npm test: 128 testes aprovados
- npm run build: aprovado
- npm run smoke: aprovado, status ok
- APIs globais inventariadas: 57
- Regras financeiras alteradas: nao
- Comportamento de interface alterado: nao

## Observabilidade de bootstrap

Atualizado em: 11/09/2026

O bootstrap possui marcadores deterministicas via Performance API, sem telemetria externa e sem nova API global publica. O coletor continua sendo o `financePerformance` ja existente.

Metricas controlaveis:

- `app_bootstrap_ms`
- `legacy_loader_ms`
- `bridge_install_ms`
- `auth_init_ms`
- `first_screen_ready_ms`
- `lazy_registration_ms`

Metricas informativas:

- `document_load_ms`
- `environment_overhead_ms`

O benchmark principal usa `vite preview` local, separa 10 amostras cold e 10 warm, e compara somente `app_bootstrap_ms` e `first_screen_ready_ms` contra `docs/bootstrap-performance-baseline.json`.

## Atualizacao da Fase 1.3 - referencias

Em 18/07/2026, a arquitetura passou a ter contrato explicito para referencias globais e pessoais:

- `shared_macros` e `shared_categories` representam somente referencias globais.
- `users/{uid}/finance_records` armazena referencias pessoais `type=macro` e `type=categoria`.
- `src/domain/referenceData.js` centraliza normalizacao, validacao, combinacao efetiva, resolucao de categoria de lancamento e dry-run local.
- `dataSdk` decide o destino por `shared_scope`, usando `personal` por padrao em criacoes comuns.
- A tela de Configuracoes identifica `Global` e `Pessoal` e nao oferece manutencao global para usuario comum.
- Nenhuma migracao destrutiva, integracao WhatsApp, telefone, webhook ou Firebase Admin SDK foi implementado.

## Atualizacao da Fase 1.4 - contratos financeiros

Em 18/07/2026, a arquitetura passou a ter contratos centrais para registros financeiros:

- `src/domain/records` centraliza schemas, normalizacao, validacao estruturada e dry-run para `saida`, `entrada`, `pessoa`, `controle_horas`, `salario_historico`, `percentage_rule`, `macro` e `categoria`.
- `dataSdk` valida create/update/upsert antes do Firestore e retorna `FINANCE_RECORD_CONTRACT_INVALID` com erros/warnings estruturados.
- `firestore.rules` valida shape minimo por tipo, metadata multicanal opcional, owner/type imutaveis e campos proibidos como telefone/WhatsApp.
- Registros legados continuam legiveis; aliases sao diagnosticados e normalizados em memoria, sem migracao real.
- Nenhuma regra de calculo financeiro, parcelamento, horas, importacao, relatorio, chatbot ou Firebase real foi alterada nesta etapa.

## Atualizacao da Fase 2.1 - arredondamento de parcelamentos

Em 18/07/2026, a geracao de parcelamentos passou a usar dominio monetario em centavos:

- `src/domain/installmentSeries.js` centraliza `CreateInstallmentSeries`, datas de parcelas e analise dry-run de series legadas.
- `src/core/money.js` expoe conversao explicita para centavos e divisao deterministica de parcelas.
- `FinanceRepository`, `dataSdk` e `financeRecordMutations` expoem `createMany`/`createManyRecords`; no Firebase local a serie e persistida via `writeBatch`.
- O formulario legado preserva o layout, mas preview e criacao de parcelamento usam a regra central em centavos.
- Nenhuma serie existente foi corrigida automaticamente, nenhum campo `amount_cents` foi persistido e nenhuma integracao WhatsApp/Firebase real foi implementada.

## Atualizacao da Fase 2.2 - recorrencias explicitas

Em 18/07/2026, a geracao de recorrencias passou a exigir frequencia e termino explicitos:

- `src/domain/recurrenceSeries.js` centraliza `CreateRecurrenceSeries`, calculo de datas e dry-run de series recorrentes.
- Frequencias novas sao `monthly` e `yearly`; `recurrence` legado (`mensal`/`anual`) continua preenchido para leitura antiga.
- Toda serie nova usa `recurrence_series_id`, `recurrence_sequence_no` e `recurrence_total_occurrences`.
- `parent_id` permanece exclusivo de parcelamentos e nao e reutilizado em recorrencias novas.
- A UI de novo lancamento mostra preview de frequencia, quantidade, primeira data, ultima data e total projetado antes de salvar.
- A persistencia de recorrencia usa `createManyRecords`, evitando escrita parcial por loop de `createRecord`.
- Escopos "esta e proximas" e "toda a serie" estao modelados, mas bloqueados ate haver mutacao atomica segura e regressao especifica.
- Nenhuma recorrencia legada foi migrada, nenhum Firebase real foi usado e nenhuma integracao WhatsApp foi implementada.

## Atualizacao da Fase 2.3 - parametros tributarios versionados

Em 21/08/2026, INSS, IRRF e salario liquido passaram a usar motor versionado por competencia:

- `src/domain/taxParameters.js` define o contrato de parametros tributarios, status, vigencias, faixas e validacao de timeline.
- `src/domain/taxParameterRepository.js` fornece repositorio em memoria para a baseline local.
- `src/domain/taxEngine.js` centraliza `CalculateINSS`, `CalculateIRRF`, `CalculateNetIncome` e wrappers legados.
- `src/legacy-globals.js` e `src/legacy/inline/part-04.js` mantem as APIs globais antigas, mas encaminham para `window.financeApp.taxEngine`.
- As tabelas atuais foram classificadas como `legado sem fonte`; nenhum valor oficial novo foi inventado.
- A base tributaria de entradas permanece `salario + hora extra + DSR`; outras receitas ficam separadas e nao entram em INSS/IRRF.

## Controle de horas canonico

Em 21/08/2026, o controle de horas passou a ter motor canonico em `src/domain/workSession.js`, exposto por `src/domain/hours.js` para compatibilidade. O motor usa minutos inteiros, aceita jornada atravessando meia-noite quando `allowCrossMidnight = true`, valida intervalos e calcula hora extra/banco sem depender de DOM, `window`, modal ou Firebase.

As bridges globais antigas continuam existindo, mas passam a delegar para o motor novo. `src/legacy/inline/part-06.js` persiste campos legados e canonicos em novos lancamentos. `src/legacy/inline/part-27.js` preserva a coleta de feriados de UI/planner e delega DSR para o motor quando disponivel.

Nao houve migracao automatica nem recalculo de registros reais. O dry-run local esta em `src/domain/hourControlDryRun.js`, com politica em `docs/hour-control-reconciliation-plan.md`.
- `tax_parameters` foi modelada nas Rules para leitura por usuario ativo e escrita por admin ativo.
- `docs/tax-history-reconciliation-plan.md` define dry-run historico sem escrita real.
- Nenhum Firebase real, deploy, UI administrativa publica ou migracao historica persistida foi implementado.

## Atualizacao da fronteira multicanal de aplicacao

Em 21/08/2026, a arquitetura recebeu a fronteira `ApplicationCommandGateway` para preparar consumo por UI web e por backend de integracao futuro, sem implementar canal externo real.

- `src/application/gateway` concentra envelopes, resultado padrao, autorizacao pura, idempotencia local, registries explicitos, gateway, handlers e repositorio em memoria para testes.
- Comandos e consultas passam a ter contratos documentados em `docs/application-command-contracts.md` e `docs/application-query-contracts.md`.
- A criacao simples de saida no formulario legado e o piloto web: a UI monta `CreateExpenseCommand`, chama o gateway quando disponivel e preserva o toast/comportamento existente.
- `source.channel=future_integration` existe apenas como metadado tecnico e nao implementa WhatsApp, webhook, telefone, provider externo ou mensagem.
- Identidade externa e idempotencia persistida foram documentadas como contratos futuros em `docs/external-identity-future-contract.md` e `docs/idempotency-contract.md`, sem criar colecoes Firestore.
- Nenhuma regra financeira, tributaria, parcelamento, recorrencia, jornada, autenticacao, importacao, relatorio, Firebase real ou interface ampla foi alterada.

## Atualizacao da camada formal de repositorios

Em 21/08/2026, a fronteira multicanal recebeu contratos formais de repositorio em `src/application/repositories` e composition root em `src/application/dependencies/createApplicationDependencies.js`.

- `FinanceRecordRepository`, `UserProfileRepository`, `SharedReferenceRepository`, `LocalSettingsRepository` e `AuditRepository` agora possuem metodos esperados documentados.
- Adapters Firebase Web encapsulam os facades atuais e mantem `dataSdk`/Firestore como infraestrutura.
- Implementacoes in-memory ficam reservadas a testes e simulacoes.
- O piloto web `CreateExpense` foi verificado: no runtime normal ele persiste por `FirebaseFinanceRecordRepository -> FinanceRepository/dataSdk`, nao por in-memory.
- Handlers do gateway usam `repositories.financeRecords` e nao instanciam persistencia diretamente.
- Nenhuma global critica foi removida; bridges legadas continuam compativeis.

## Atualizacao da camada de casos de uso

Em 22/08/2026, a regra de aplicacao dos comandos financeiros principais foi extraida dos handlers para `src/application/useCases`.

- `financeRecordUseCases.js` centraliza `CreateExpense`, `UpdateExpense`, `MarkExpenseAsPaid`, `ArchiveExpense`, `DeleteExpense`, `CreateIncome`, `ConsolidateMonthlyIncome`, `CreateInstallmentSeries`, `CreateRecurrenceSeries`, `CreateHourEntry` e `UpdateHourEntry`.
- `financeCommandHandlers.js` fica restrito a contrato/registry/delegacao para use cases.
- Auditoria padronizada fica em `auditUseCaseEvents.js` e roda apos mutacao persistida.
- Casos de uso recebem `context`, `input` e repositorios por dependencia; nao importam DOM, `window`, Firebase, toast ou componentes visuais.
- Parcelamentos, recorrencias, tributos e jornada reutilizam os motores de dominio existentes.
- Nenhum WhatsApp, webhook, telefone, Admin SDK, deploy, Firebase real ou permissao publica foi implementado.

## Atualizacao da migracao ES Modules do legado

Em 22/08/2026, o primeiro grupo legado foi removido do carregamento classico por eval:

- `src/ui/legacy-events.js` agora e ES Module real e exporta `installLegacyEventBindings(target)`.
- `bootstrapApp()` instala os eventos explicitamente antes de carregar os scripts classicos restantes.
- `src/legacy/classicScripts.js` passou de 34 para 33 entradas e nao carrega mais `src/ui/legacy-events.js?raw`.
- A bridge temporaria `target.financeEvents` foi preservada para diagnostico/compatibilidade.
- O teste `tests/architecture/no-new-eval.test.js` bloqueia novo `eval` fora do loader legado documentado.
- Nenhuma API global inventariada foi adicionada; o inventario permanece em 58.

## Atualizacao da reducao de globais

Em 22/08/2026, a reducao de dependencias globais passou a ter politica e diagnostico proprios:

- `docs/global-api-reduction-policy.md` define que novas regras de dominio/aplicacao nao podem nascer em `window`.
- `docs/global-api-reduction-diagnostic.md` audita as 58 APIs globais top-level e suas duplicacoes conhecidas.
- `src/legacy/bridgeRegistry.js` registra bridges canonicas e falha em teste/dev quando ha sobrescrita incompativel.
- `installGlobalBridge()` passou a instalar bridges de dominio/core pelo registry, mantendo idempotencia.
- `window.financeApp.installLegacyEventBindings` foi removido por ausencia de consumidor real; `window.financeEvents` permanece.
- O inventario top-level continua em 58 APIs globais, sem aumento.

## Atualizacao da idempotencia persistente

Em 22/08/2026, metadata operacional e idempotencia persistente foram padronizadas sem alterar calculos financeiros, UI ampla ou fluxos de Firebase real.

- `operationMetadata.js` centraliza origem, autoria, schema, correlacao e chaves.
- `idempotency.js` cria fingerprint deterministico e receipt sem payload bruto.
- `IdempotencyRepository` ganhou implementacoes in-memory e Firebase Web.
- Firestore Rules protegem `users/{uid}/idempotency_receipts/{receiptId}`.
- `ApplicationCommandGateway` reserva antes do use case, completa apos sucesso e marca falha em erro.
- `CreateExpenseCommand` e o piloto: replay nao duplica saida nem auditoria.
- Series propagam a mesma metadata da operacao inteira.
- Nenhum WhatsApp, webhook, telefone, Admin SDK, deploy, push ou migracao real foi implementado.

## Atualizacao da idempotencia de importacoes

Em 22/08/2026, foi criada a fronteira canonica de importacoes financeiras em `src/application/imports/importBatchUseCases.js`.

- `PrepareImportBatch` calcula `ImportBatch`, `ImportCandidate`, fingerprints de arquivo/linha e classifica `ready`, `invalid`, `duplicate_in_file`, `already_imported`, `legacy_match` e `conflict` sem escrita financeira.
- `CommitImportBatch` reserva receipts de batch e linha, persiste somente candidatos `ready` via `FinanceRecordRepository.createMany` e audita `IMPORT_COMMITTED`/`IMPORT_FAILED`.
- `file_fingerprint` depende do conteudo canonico, nao do nome do arquivo.
- Identidade externa igual com payload diferente vira conflito.
- `npm run import:dry-run` executa massa sintetica local com `wrote=false`.
- Politica, contrato e reversao estao documentados em `docs/import-idempotency-policy.md`, `docs/import-batch-contract.md` e `docs/import-reversal-plan.md`.
- Nenhum Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo, Admin SDK, colecao publica ou regra financeira foi alterado.

## Atualizacao XLSX no pipeline de importacoes

Em 22/08/2026, as importacoes XLSX locais de saidas e entradas foram conectadas ao pipeline idempotente.

- `spreadsheetImportParser.js` faz o parse puro das planilhas.
- `importPipelineRuntime.js` expoe uma bridge temporaria em `window.financeApp.importPipeline`.
- `part-03.js` preserva UI/DOM/relatorio legado, mas usa `PrepareImportBatch` e `CommitImportBatch` para preview e commit.
- Novos registros XLSX usam `source_channel=spreadsheet_import` e continuam mantendo `import_source=saidas_xlsx` ou `import_source=entradas_xlsx`.
- Assinaturas XLSX legadas seguem reconhecidas como `legacy_match`.
- `npm run import:xlsx-dry-run` cobre localmente duplicidade, invalidas, legado, conflito e commit atomico.
- Nenhuma regra financeira, interface ampla, Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi alterado.

## Atualizacao da materializacao percentual

Em 22/08/2026, a materializacao de `percentage_rule` foi separada do ciclo de renderizacao.

- `CalculatePercentageRuleOccurrence` centraliza calculo puro e sem DOM/window.
- `MaterializePercentageRulesForCompetence` cria ocorrencias faltantes com occurrence key, ID deterministico, idempotencia e `createIfAbsent`.
- `financeApp.percentageRuleMaterializationRunner` expoe runner local reutilizavel por futuro backend confiavel.
- `schedulePercentageExitMaterialization` deixou de gravar; renderizacao/dashboard/filtros permanecem read-only.
- Ocorrencias existentes, pagas, arquivadas, editadas ou divergentes sao preservadas.
- Excluir regra nao apaga historico financeiro derivado.
- `npm run percentage-rules:dry-run` usa fixtures sinteticas e retorna `wrote=false`.
- Politica e reconciliacao estao em `docs/percentage-rule-materialization-policy.md` e `docs/percentage-rule-reconciliation-plan.md`.

## Atualizacao de auditoria e rastreabilidade

Em 22/08/2026, a auditoria operacional foi padronizada em formato canonico sem alterar regras financeiras, interface ampla, Firebase real ou canais externos.

Fluxo canonico:

`Use case -> AuditTrailService -> AuditRepository -> users/{uid}/audit_logs/{logId}`

`AuditEvent` padroniza `event_type`, `category`, `actor`, `owner_uid`, `source_channel`, `operation`, `entity`, `correlation_id`, snapshots `before/after`, `result_status`, versao de schema e aliases legados. Auditoria fica separada dos registros financeiros e nao participa de calculos.

Falhas de auditoria apos mutacao financeira sao warnings observaveis, sem rollback falso. Logs sao append-only nas Rules; update/delete sao negados para todos no cliente. Como a auditoria ainda e client-side, ela serve para rastreabilidade operacional e regressao local, mas evidencia inviolavel exige backend/Admin SDK futuro.

## Atualizacao de backup e recuperacao segura

Em 23/08/2026, foi adicionada uma fronteira local de backup/restore em `src/application/backup/financeBackupUseCases.js`.

- `CreateFinanceBackupSnapshot` exporta `FinanceBackupSnapshot` com registros do owner, referencias pessoais, configuracoes locais, regras percentuais, historico salarial e controle de horas.
- `ValidateFinanceBackupSnapshot` valida versao, schema, checksum, duplicidades, tipos conhecidos, referencias e campos proibidos.
- `PrepareFinanceRestore` gera plano sem escrita e separa `new`, `identical`, `conflict`, `incompatible`, `orphaned` e `skipped_operational`.
- `CommitFinanceRestore` cria snapshot pre-restore e grava somente registros financeiros `new`; conflitos e incompatibilidades bloqueiam o commit.
- `PrepareFinanceRollback` e `CommitFinanceRollback` usam correlacao do restore para remover apenas registros criados por aquela operacao e preservar dados externos.
- Auditoria canonica foi estendida com eventos `BACKUP_*` e `RESTORE_*`, sempre com resumo, checksum truncado e correlacao, nunca com o backup completo.
- `npm run backup:dry-run` usa apenas massa sintetica e repositorios em memoria.
- Nenhum Firebase real, deploy, push, interface, Rules, calculo financeiro, telefone, WhatsApp, provider externo ou Admin SDK foi implementado.

Referencias: `docs/backup-restore-policy.md`, `docs/backup-format-reference.md`, `docs/backup-versioning-policy.md`, `docs/restore-conflict-policy.md` e `docs/disaster-recovery-future-plan.md`.

## Atualizacao de performance e acesso a dados

Em 23/08/2026, o carregamento inicial e os contratos de acesso foram otimizados sem alterar regras financeiras, interface, Firebase Rules ou dados reais.

- Firebase Web SDK saiu do bootstrap HTML e passou a ficar em chunk lazy.
- Helpers de auditoria financeira usados pelo dominio foram extraidos para modulo puro em `src/domain/audit/financeRecordAudit.js`.
- Repositorios Firebase em web mode passaram a carregar sob demanda pela composicao de dependencias.
- `FinanceRecordRepository`, usuarios e auditoria em memoria ganharam contrato de paginacao por `limit`/`cursor`.
- `InMemoryFinanceRecordSubscriptionRepository` ganhou contagem de listeners ativos e encerramento por predicado para testes de vazamento.
- Budgets e benchmarks locais foram adicionados em scripts npm.
- Documentos de referencia: `docs/performance-optimization-policy.md`, `docs/performance-baseline.md`, `docs/performance-budget.md`, `docs/bundle-analysis.md`, `docs/firestore-query-index-plan.md`, `docs/subscription-lifecycle-policy.md` e `docs/cache-invalidation-policy.md`.

## Atualizacao corretiva de paginacao Firestore

Em 23/08/2026, a ressalva de paginacao hibrida foi corrigida para os repositorios historicos com acesso direto ao Firestore, sem alterar regras financeiras, interface, Firebase real ou deploy.

- `FirebaseAuditRepository.list` passou a consultar `users/{uid}/audit_logs` com filtros, `orderBy`, `startAfter` e `limit`.
- `FirebaseWebIdempotencyRepository.list` passou a consultar `users/{uid}/idempotency_receipts` com filtros, `orderBy`, `startAfter` e `limit`.
- `FirebaseUserProfileRepository.listUsers` passou a consultar `users` com `orderBy`, `startAfter` e `limit` quando `db` esta disponivel.
- Cursores foram padronizados como tokens opacos por `encodePageCursor`/`decodePageCursor`.
- Dashboard e KPIs continuam usando dataset completo autorizado para preservar totais, percentuais e graficos.
- `import_batches` nao foi migrado porque nao existe como colecao persistida nesta arquitetura.
- Evidencias: `docs/firestore-pagination-verification.md`, `docs/performance-before-after.md`, `tests/firestore/firestore-pagination-emulator.test.js`, `tests/architecture/firestore-pagination-contract.test.js`, `tests/application/performance/dashboardDatasetIntegrity.test.js` e `tests/application/performance/subscriptionLifecycleRuntime.test.js`.

## Atualizacao de resiliencia e tratamento de erros

Em 30/08/2026, foi adicionada uma camada local de resiliencia sem alterar regras financeiras, interface funcional, Firebase Rules, Firebase real, deploy ou canais externos.

- `ApplicationError` passou a representar erros canonicos serializaveis por categoria, severidade, codigo, mensagem segura, correlacao e detalhes sanitizados.
- Normalizadores cobrem erros de aplicacao, repositorio, Firebase, rede/offline e lazy load.
- `RetryPolicy` diferencia leitura, mutacao e lazy load; mutacao sem `idempotencyKey` nao recebe retry automatico.
- `executeWithResilience` preserva `correlationId` e `idempotencyKey`, aplica retry limitado e retorna resultado estruturado.
- `ConnectivityService` concentra online/offline no adapter browser; camadas de dominio/aplicacao nao acessam `navigator`.
- `AsyncViewState` foi criado para pilotos de dashboard, importacao e auditoria/listagem paginada.
- `ErrorReporter` local registra falhas sanitizadas em memoria, sem provider externo e sem colecao Firestore.
- Lazy load de Firebase/modulos pesados passa a normalizar falha como `LAZY_LOAD_FAILED`.
- Auditoria e telemetry permanecem separadas: `AuditTrail` registra rastreabilidade de negocio/seguranca; `ErrorReporter` registra diagnostico tecnico.

Referencias: `docs/error-resilience-policy.md`, `docs/error-resilience-diagnostic.md`, `docs/application-error-reference.md`, `docs/retry-policy.md`, `docs/connectivity-policy.md` e `docs/error-observability-policy.md`.

## Atualizacao de reconciliacao pos-commit

Em 01/09/2026, foi adicionada uma camada local para reconciliar mutacoes cujo commit foi concluido, mas cuja resposta foi perdida antes de chegar ao chamador.

- `MutationAttemptContext` cria `attemptId`, `idempotencyKey`, `correlationId` e fingerprint estavel sem guardar payload bruto.
- `ApplicationCommandGateway` possui seam injetavel `afterMutationBeforeApplicationResult` para testar perda de resposta depois de `IdempotencyRepository.complete`.
- Resultado pos-commit perdido retorna `POST_COMMIT_RESPONSE_LOST`, `status=uncertain` e `mutationOutcome=uncertain`, sem marcar receipt concluido como failed.
- `ReconcileMutationAttempt` consulta receipt por owner, comando, source channel, chave e fingerprint; nunca cria entidade nova.
- Pilotos web para entrada e saida preservam rascunho quando o estado fica incerto e nao adicionam nova API global de topo.
- Testes locais cobrem `CreateExpense`, `CreateIncome`, `CreateHourEntry`, parcelamento, recorrencia, importacao, payload alterado, mutacao sem chave, Playwright e receipts no Firestore Emulator.
- Nao houve deploy, push, Firebase real, WhatsApp, telefone, Admin SDK, fila offline ou alteracao de regra financeira.

Referencias: `docs/post-commit-reconciliation-diagnostic.md`, `docs/post-commit-reconciliation-policy.md` e `docs/mutation-attempt-contract.md`.

## Atualizacao de modernizacao do CRUD financeiro

Em 02/09/2026, o CRUD financeiro principal recebeu uma bridge modular sem nova API global de topo.

- Controllers ES Modules em `src/ui/records/expenseFormController.js` e `src/ui/records/incomeFormController.js` montam comandos canonicos para o `ApplicationCommandGateway`.
- `recordMutationPresenter` traduz resultados para estados de UI e feedback sem acessar Firebase ou `window`.
- `mutationAttemptStore` preserva tentativa idempotente segura somente com metadados e fingerprint.
- `financialCrudControllerInstaller` instala a bridge em `window.financeApp.financialCrud`.
- `part-03.js` permanece como casca de compatibilidade; parcelamento, recorrencia, edicao de entrada e reversoes visuais continuam protegidas por fallback legado quando necessario.

Referencias: `docs/financial-crud-modernization-diagnostic.md` e `docs/financial-crud-modernization-policy.md`.

## Atualizacao de Dashboard e camada de leitura

Em 02/09/2026, foi adicionada uma camada canonica de read models para Dashboard, Saidas e Entradas, sem alterar regras financeiras, interface, Firestore Rules, Firebase real ou canais externos.

- `dashboardReadModel` centraliza filtros, KPIs, agregacoes, bases de entradas/saidas e view models de graficos.
- `dashboardFilters` concentra filtros puros por competencia, periodo, pessoa, tipo, status, macro, categoria, ciclo e arquivamento.
- `dashboardChartData` separa preparacao de dados de graficos do adapter Chart.js.
- `expenseListReadModel` e `incomeListReadModel` fornecem filtros, sort, paginacao visual e detalhe por `id`.
- `dashboardController` e `dashboardPresenter` criam uma fronteira moderna com `AsyncViewState` e lifecycle de subscriptions por injecao.
- `dashboardData.js` permanece adapter de compatibilidade para DOM e bridges globais legadas.

Nenhuma API global nova foi adicionada. Scripts classicos e eval permanecem em 33 porque consumidores reais ainda dependem de `part-03.js`, `part-16.js` e `part-29.js`.

## Atualizacao de Controle de Horas e UI moderna

Em 02/09/2026, foi adicionada uma fronteira moderna local para leitura e orquestracao da UI de Controle de Horas, sem alterar regras financeiras, interface ativa, Firestore Rules, Firebase real ou canais externos.

- `hourControlFilters` concentra filtros puros por competencia, periodo, pessoa, status, tipo, busca e arquivamento.
- `hourControlReadModel` monta entradas normalizadas, resumo, banco de horas, totais mensais, salario vigente e metadados sem DOM, `window`, Firebase ou `dataSdk`.
- O resumo reutiliza `buildHourPeriodSummary`; salario vigente reutiliza `ResolveEffectiveSalary`; a UI nao recria formulas de jornada, HE, banco, DSR ou tributos.
- `hourControlController` e `hourControlPresenter` criam a pista moderna com `AsyncViewState`, subscriptions por injecao e comandos `CreateHourEntryCommand`/`UpdateHourEntryCommand`.
- `part-06.js` permanece no loader classico porque ainda contem o formulario real, handlers globais, persistencia legada e criacao da entrada financeira derivada de hora extra.
- `npm run hour-control-modernization:check` e `npm run hour-control:benchmark` foram adicionados para validar limites estruturais e desempenho local.

Nenhuma API global nova foi adicionada. Scripts classicos e eval permanecem em 33; APIs globais inventariadas permanecem em 50.

## Atualizacao corretiva da interface ativa de Controle de Horas

Em 02/09/2026, apos a revisao do commit `9cb8ba7`, a tela ativa de Controle de Horas passou a instalar `src/ui/hours/hourControlActiveUi.js` depois de `loadLegacyClassicScripts(globalThis)`. Essa instalacao preserva as bridges globais existentes, mas redireciona listagem, criacao e edicao para `hourControlController`, `hourControlPresenter`, `hourControlReadModel` e `ApplicationCommandGateway`.

O caminho ativo agora usa `CreateHourEntryCommand` e `UpdateHourEntryCommand`; a UI ativa nao chama Firebase direto nem `window.dataSdk.create/update`. Testes Playwright locais cobrem criacao, edicao, re-renderizacao, ausencia de duplicidade de grupo, erro e resultado incerto com mocks locais. Scripts classicos de Controle de Horas continuam carregados por compatibilidade e nao estao autorizados para remocao sem nova analise de consumidores e regressao especifica.

## Atualizacao de governanca de bundle 5.4B

Em 03/09/2026, foi revertida a elevacao temporaria do budget de Entry JS de `422 KiB` para `420 KiB`, restaurando o baseline aprovado de `430080` bytes. A correcao criou margem por code splitting seguro, sem alterar regras financeiras, Dashboard funcional, autenticacao, Firestore Rules, importacao, backup, recorrencias, parcelamentos, tributos ou canais externos.

- `src/ui/hours/hourControlActiveUi.js`, `hourControlController`, `hourControlPresenter` e `hourControlReadModel` carregam sob demanda ao navegar para `controle-horas`.
- `src/ui/records/parcelamentosRenderer.js` carrega sob demanda ao navegar para `parcelamentos`.
- `scripts/bundle-budget.mjs` falha se o limite de Entry JS ultrapassar `docs/bundle-budget-baseline.json`, se a UI ativa de Controle de Horas voltar a import eager, se evidencia do runtime lazy aparecer no entry ou se Firebase voltar ao bootstrap.
- Entry final medido: `411442` bytes; headroom final: `18638` bytes (`4.33%`).
- Nenhuma API global nova foi adicionada; scripts classicos/eval permanecem limitados a `33`.

## Atualizacao de modernizacao do Planner financeiro

Em 03/09/2026, foi adicionada uma fronteira moderna local para o Planner financeiro, preservando o legado carregado e sem alterar regras financeiras, Firestore Rules, Firebase real, autenticacao, importacao, backup, parcelamentos, recorrencias, tributos, controle de horas ou canais externos.

- `plannerFilters` concentra filtros puros por periodo, pessoa, tipo, status, macro, categoria e arquivamento.
- `plannerReadModel` monta eventos de Planner, saidas, entradas e controle de horas ja persistidos, com agrupamento por dia, semana e mes.
- O read model identifica parcelamentos e recorrencias somente por metadados persistidos; ele nao recalcula parcelas, recorrencias, impostos, DSR, H.E. ou banco de horas.
- `plannerController`, `plannerPresenter` e `plannerActiveUi` conectam a tela ativa por lazy load apos `loadLegacyClassicScripts(globalThis)`.
- As bridges globais existentes do Planner permanecem preservadas: `openPlannerModal`, `closePlannerModal`, `renderPlannerModal`, `savePlannerEvent`, `deletePlannerEvent`, `shiftPlannerMonth` e `selectPlannerDate`.
- Acoes financeiras a partir do Planner delegam para a interface de acoes injetada pela composicao da aplicacao por ID real do registro.
- Eventos manuais do Planner continuam no `localStorage`, agora em chaves V2 escopadas por owner para proteger feriados/DSR na troca de usuario.

## Atualizacao de isolamento do Planner - 04/09/2026

O Planner passa a ter `src/application/planner/plannerLocalEventStore.js` como fronteira pura para eventos locais e feriados customizados. Toda leitura/escrita autenticada exige `ownerUid`, usa chaves V2 com hash estavel do owner e preserva as chaves V1 apenas como legado nao atribuido para diagnostico/fallback.

O controller moderno nao acessa mais `window.financeApp.financialCrud` diretamente. As acoes de saida sao recebidas por injecao via composition root em `src/app.js`, que adapta a bridge web existente sem contaminar `src/ui/planner/plannerController.js` e `src/ui/planner/plannerActiveUi.js`.

Na troca, logout, usuario inativo ou conta pendente, o fluxo de autenticacao aciona reset visual do Planner. Os consumidores legados de DSR passam a consultar feriados/eventos do owner atual por `financeApp.plannerStorage`, evitando misturar feriados locais entre usuarios no mesmo navegador.
- `part-26.js` e `part-27.js` permanecem carregados por compatibilidade e nao estao autorizados para remocao sem cobertura especifica.

Referencias: `docs/planner-modernization-diagnostic.md` e `docs/planner-modernization-policy.md`.

## Atualizacao de modernizacao de Configuracoes e referencias

Em 04/09/2026, a tela ativa de Configuracoes recebeu uma fronteira moderna local para leitura, apresentacao e manutencao de dados de referencia, sem alterar regras financeiras, Firestore Rules, autenticacao, importacao, backup, parcelamentos, recorrencias, tributos, controle de horas, Planner ou canais externos.

- `settingsReadModel` separa pessoas, referencias pessoais, referencias globais compartilhadas, configuracoes locais e configuracoes administrativas sem DOM, `window`, Firebase ou `dataSdk`.
- `settingsController`, `settingsPresenter` e `settingsActiveUi` conectam a tela existente por lazy load apos `loadLegacyClassicScripts(globalThis)`.
- As bridges globais existentes de Configuracoes permanecem preservadas: `renderConfiguracoes`, `addPerson`, `savePerson`, `addMacroCategory`, `saveMacroCategory`, `openCategoryForm`, `openEditCategory`, `closeCategoryForm` e `saveCategory`.
- Referencias pessoais continuam escopadas por owner; referencias globais continuam somente como leitura para usuario comum e manutencao administrativa quando a autoridade ja foi concedida pela aplicacao.
- Parametros tributarios, regras percentuais, tipos de hora extra, importacao e historico permanecem com renderizadores/fluxos legados complementares; a UI moderna nao recalcula impostos, percentuais, H.E., DSR ou materializacoes.
- `scripts/settings-modernization-check.mjs` e `scripts/settings-benchmark.mjs` validam guardrails estruturais, budget e desempenho local.

`part-03.js`, `part-09.js`, `part-16.js` e `part-29.js` permanecem carregados por compatibilidade. Nenhum desses scripts esta autorizado para remocao sem busca completa de consumidores, testes de regressao especificos e preservacao das bridges globais.

## Atualizacao corretiva de Configuracoes 5.6A

Em 05/09/2026, a composicao web de Configuracoes foi retirada do bootstrap para recuperar headroom real e reforcar governanca de escopo.

- `src/app.js` preserva apenas loader dinamico, fallback e decisao de rota para `configuracoes`.
- `src/ui/settings/settingsWebAdapter.js` concentra leitura, actions e renderizadores suplementares da tela em chunk lazy.
- `src/application/settings/referenceWriteScope.js` define contrato puro para resolver escopo de escrita.
- Usuario comum pode criar apenas `personal`; tentativa `global` e rejeitada com `SETTINGS_SHARED_REFERENCE_FORBIDDEN`, sem conversao silenciosa.
- Admin cria `global` somente com escolha explicita; escopo omitido resolve para `personal`.
- Entry medido: `420552` bytes contra budget `430080`, headroom `9528` bytes (`2.22%`).
- APIs globais permanecem em `50`; scripts classicos/eval permanecem em `33/33`.

Nao houve alteracao em regras financeiras, autenticacao, Firestore Rules, importacao, Planner, Controle de Horas, Dashboard, tributos, parcelamentos, recorrencias, materializacao percentual, backup/restore, WhatsApp, webhook, provider externo, telefone ou Admin SDK.

## Atualizacao de modernizacao da Administracao de Usuarios

Em 05/09/2026, a Administracao de Usuarios recebeu uma fronteira moderna local carregada pelo caminho lazy de Configuracoes, sem alterar regras financeiras, Firestore Rules, Firebase real, Dashboard, Entradas, Saidas, Parcelamentos, Controle de Horas, Planner, Importacao, Backup/Restore, tributos, materializacao percentual ou canais externos.

- `userAdminPermissions` resolve permissoes visuais a partir de perfil e claims ja carregados pelo fluxo de autenticacao.
- `userAdminReadModel` monta usuarios, resumo, filtros, paginacao e acoes sem DOM, `window`, Firebase ou `dataSdk`.
- `userAdminController`, `userAdminPresenter` e `userAdminActiveUi` preservam o painel existente e suas bridges globais.
- `userAdminSdk.listUsers(query)` aceita `limit`, `cursor`, `status` e `role`, mantendo o contrato legado `listUsers()`.
- `financeApp.authContext` expoe o contexto autenticado ja resolvido pelo legado para composicao local, sem criar nova API global top-level.

`part-28.js` permanece carregado por compatibilidade de autenticacao, criacao de perfil, avisos de conta pendente/inativa, logout e bridges legadas. Nenhum trecho dessa area esta autorizado para remocao sem testes de regressao especificos, analise de consumidores e preservacao das bridges globais.

## Atualizacao de queries Admin - 05/09/2026

A lacuna de consulta administrativa foi fechada para filtros exatos: `status`, `role` e `status + role` usam query Firestore server-side com `limit + 1`, `startAfter`, `email asc` e tie-break por documentId. `firestore.indexes.json` declara apenas os indices compostos comprovados para `users`.

Busca textual por nome/email nao foi promovida a busca global. A UI informa "Buscar na pagina" e filtra apenas os itens carregados. Nao ha Algolia, Elastic, Typesense, Meilisearch, backend, Admin SDK, WhatsApp, webhook, telefone, deploy ou Firebase real.

## Atualizacao de modernizacao da Importacao financeira

Em 06/09/2026, a tela ativa de Importacao recebeu uma fronteira moderna local para planilhas XLSX, sem alterar parser financeiro canonico, regras financeiras, Firestore Rules, autenticacao, Dashboard, Entradas, Saidas, Parcelamentos, Controle de Horas, Planner, Configuracoes, Administracao de Usuarios, backup/restore, tributos, materializacao percentual ou canais externos.

- `src/app.js` instala `installImportacaoLazyLoader(globalThis)` e deixa a UI ativa de Importacao fora do bootstrap.
- `src/ui/imports/importActiveUi.js` compoe presenter, controller, repositorios do pipeline e parser XLSX lazy.
- `src/ui/imports/importController.js` chama `PrepareImportBatch`, preserva tentativa/batch em erro, protege clique duplo e delega commit a `CommitImportBatch`.
- `src/application/readModels/importPreviewReadModel.js` agrupa candidatos prontos, invalidos, duplicados, conflitantes e ignorados sem DOM, `window`, Firebase ou persistencia.
- `src/ui/imports/importPresenter.js` renderiza upload, resumo, tabs de preview, estados de erro/offline/loading e resultado de commit.
- `src/application/imports/importPipelineRuntime.js` manteve a bridge de pipeline, mas passou a carregar o parser XLSX sob demanda.

`src/ui/importacao.js`, `part-03.js` e `part-08.js` continuam preservados como compatibilidade da importacao bancaria, historico e consumidores legados. Nenhum script classico desta area esta autorizado para remocao sem busca completa de consumidores, regressao especifica, smoke e bridge temporaria.

Metricas locais da etapa: Entry `371836` bytes contra budget `430080`, headroom `58244` bytes (`13.54%`), APIs globais `50`, scripts classicos/eval `33/33`. Nao houve Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo ou Admin SDK.
## Atualizacao de modernizacao da UI de Backup e Restore

Em 08/09/2026, a tela de Configuracoes recebeu uma fronteira moderna local para Backup e Restore, sem alterar regras financeiras, Firestore Rules, autenticacao, Dashboard, Entradas, Saidas, Parcelamentos, Controle de Horas, Planner, Configuracoes, Administracao de Usuarios, Importacao, tributos, materializacao percentual ou canais externos.

- `backupPreviewReadModel` monta resumo seguro de snapshot sem DOM, `window`, Firebase, `dataSdk` ou persistencia.
- `restorePreviewReadModel` monta preview de restore dry-run, conflitos e warnings sem executar escrita.
- `backupController` chama `CreateFinanceBackupSnapshot`, `ValidateFinanceBackupSnapshot` e `PrepareFinanceRestore` por dependencias injetadas.
- `backupPresenter` renderiza a area ativa em Configuracoes e mantem restore real indisponivel.
- `backupDownloadAdapter` isola Blob, URL e clique de download, com nome de arquivo sem UID, email, telefone ou WhatsApp.
- `loadBackupActiveUi` carrega a UI sob demanda pelo caminho lazy de Configuracoes.

`CommitFinanceRestore`, rollback e qualquer restore real permanecem fora da UI client-side. Nenhuma API global top-level nova foi adicionada; `financeApp.backupActiveUi` e uma propriedade interna da bridge existente. Metricas locais da etapa: Entry `371926` bytes contra budget `430080`, headroom `58154` bytes (`13.52%`), APIs globais `50`, scripts classicos/eval `33/33`. Nao houve Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo ou Admin SDK.

## Atualizacao de modernizacao da exportacao PDF

Em 08/09/2026, a exportacao ativa do Relatorio Financeiro Gerencial recebeu uma fronteira moderna local, sem alterar regras financeiras, Firestore Rules, autenticacao, Dashboard, Entradas, Saidas, Parcelamentos, Controle de Horas, Planner, Configuracoes, Administracao de Usuarios, Importacao, Backup/Restore, tributos, materializacao percentual ou canais externos.

- `financialReportReadModel` monta titulo, periodo, resumo, secoes, tabelas, charts e metadata sem DOM, `window`, Firebase, `dataSdk`, jsPDF ou autotable.
- Os builders `buildFinancialReportSummary`, `buildFinancialReportTables`, `buildFinancialReportSections` e `buildReportFilename` isolam estrutura de relatorio e filename seguro.
- `reportExportController` obtem dados por read source injetado, chama o read model, carrega o adapter PDF sob demanda e controla loading/success/empty/error.
- `reportExportPresenter` mostra status discreto do relatorio sem expor stack tecnica.
- `pdfAdapter` recebe modelo pronto e apenas monta/download o PDF via biblioteca lazy.
- `reportExportActiveUi` preserva a bridge global existente `exportPDF`, sem criar nova API global top-level.

Metricas locais da etapa: Entry `373464` bytes contra budget `430080`, headroom `56616` bytes (`13.16%`), APIs globais `50`, scripts classicos/eval `33/33`. Nao houve Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo ou Admin SDK.

## Atualizacao de saida do loader legado - 08/09/2026

O primeiro lote seguro de encerramento da Fase 5 removeu do carregamento classico os placeholders aposentados `part-21.js`, `part-22.js`, `part-23.js`, `part-24.js`, `part-25.js`, `part-30.js` e `part-31.js`. Os arquivos permanecem no repositorio para rastreabilidade, mas nao sao mais importados como `?raw` nem executados por `eval`.

Metricas locais da etapa: Entry `372911` bytes contra budget `430080`, headroom `57169` bytes (`13.29%`), APIs globais `50`, scripts classicos/eval `26/26`, bytes legados carregados `776052`. Nao houve Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo ou Admin SDK.

O grafo de consumidores esta em `docs/legacy-consumer-graph.md`. O diagnostico completo dos 33 scripts esta em `docs/legacy-loader-exit-diagnostic.md`, e a politica de continuidade esta em `docs/legacy-loader-exit-policy.md`.

## Atualizacao de bridges e monitor do loader legado - 08/09/2026

Resultado medido: scripts classicos/eval `26/26 -> 24/24`, bytes carregados pelo loader `776052 -> 754753`, APIs globais `50 -> 50`. `src/legacy-globals.js` foi removido do caminho classic/eval porque `installGlobalBridge(globalThis)` instala as bridges de dominio/core por ES Module antes do loader remanescente e e reaplicado depois do pacote classico para restaurar bridges canonicas sobrescritas por declaracoes globais legadas. `src/services/performanceMonitor.global.js` foi migrado para `src/services/performanceMonitor.js`, com instalacao idempotente e bridge `window.financePerformance`. `libraryLoader.global.js` e `legacy-ui.js` permanecem no loader por consumidores classicos reais. O entry ficou em `372910` bytes contra budget fixo de `430080`.

## Atualizacao do loader de bibliotecas legado - 08/09/2026

Resultado medido: scripts classicos/eval `24/24 -> 23/23`, bytes carregados pelo loader `754753 -> 751896`, APIs globais `50 -> 50`. `src/services/libraryLoader.global.js` foi removido do caminho classic/eval e substituido por `src/services/libraryLoader.js` com bridge explicita em `src/legacy/libraryLoaderBridge.js`. XLSX, jsPDF/autotable e PDFJS continuam lazy e usam as mesmas URLs/allowlist existentes. Chart.js e Lucide continuam por ES import local em `src/services/localVisualLibraries.js`. `legacy-ui.js` permaneceu no loader por consumidores classicos reais; nenhuma regra financeira, auth, Firestore Rule, UI visual, importacao, PDF, horas, parcelamentos, recorrencias, backup/restore ou materializacao percentual foi alterada.

## Atualizacao de performance do loader - 09/09/2026

A regressao de bootstrap `203.899ms -> 248.914ms` foi investigada em `docs/bootstrap-regression-diagnostic.md`. A bridge de bibliotecas agora e proxy lazy e nao importa `src/services/libraryLoader.js` durante o bootstrap. O loader canonico permanece ES Module, carregado somente no primeiro uso real de XLSX/PDF/PDFJS; `bootstrap:check` protege esse contrato. O criterio historico de `loadMs <= 224.3ms` ainda nao foi atingido no Vite local por variacao de `document-load` e volume legado, entao nenhum novo lote de migracao foi autorizado.

## Atualizacao de decomposicao da UI legada - 11/09/2026

`src/ui/legacy-ui.js` deixou de ser carregado como texto raw pelo classic loader. A instalacao de `window.financeUI` agora ocorre por ES Module (`installLegacyUiBridge`) antes dos scripts classicos. A bridge segue necessaria para consumidores classicos ainda nao migrados.

## Atualizacao de consumidores `financeUI` - 12/09/2026

`part-03.js` e `part-29.js` nao consomem mais `window.financeUI` diretamente. O bootstrap legado instala `window.financeApp.financeUiAdapters` por ES Module antes dos scripts classicos, e esses dois scripts usam o adapter somente para chamadas visuais: toast, overlay, sidebar, tabs, lista, empty state e totalizador.

Fronteiras preservadas:

- nenhuma regra financeira foi movida;
- nenhuma autenticacao, Firestore Rule, Firebase real, importacao, backup/restore, PDF, tributo, parcelamento, recorrencia, horas ou materializacao percentual foi alterada;
- naquele lote, `window.financeUI` ainda permanecia por consumidores runtime em `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos;
- `classic/eval` permanece em `22/22`;
- APIs globais permanecem em `50`.

Resultado estrutural: scripts classicos/eval `23/23 -> 22/22`, bytes do loader `751896 -> 746720`, APIs globais `50 -> 50`. Fronteiras preservadas: nenhum modulo de `src/domain` ou `src/application` importa UI legada; nenhuma regra financeira, autenticacao, Firestore Rules, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, horas ou materializacao percentual foi alterada.

## Atualizacao de consumidores modernos `financeUI` - 12/09/2026

Os modulos modernos `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` deixaram de depender de `window.financeUI` ou `window.financeApp.financeUiAdapters`. Toast e navegacao nesses caminhos usam imports ES explicitos ou injecao local.

`src/legacy/inline/part-07.js` deixou de chamar `window.financeUI` diretamente, mas continua no pacote classico e usa o adapter visual temporario `window.financeApp.financeUiAdapters` apenas para DOM/lista/meta. Nenhum calculo de horas, banco de horas, persistencia, auth, Firestore Rule ou regra financeira foi movido.

Estado estrutural daquele gate: `modernFinanceUiConsumers=[]`, `part07FinanceUiCalls=0`, `part08FinanceUiCalls=9`, `part14FinanceUiCalls=4`, consumidores remanescentes somente em `part-08.js` e `part-14.js`, `classic/eval=22/22`, APIs globais `50`, novo `eval=0`, `new Function=0`.

## Atualizacao de consumidores criticos `financeUI` - 12/09/2026

As 13 chamadas remanescentes em `part-08.js` e `part-14.js` foram caracterizadas. O lote seguro removeu a dependencia da bridge em 12 chamadas de apresentacao de Configuracoes (`setHtml`/`setHidden`) usando DOM local equivalente e teste Playwright do fallback legado.

Estado do gate apos a etapa de navegacao: `modernGlobalUiConsumers=[]`, `part08FinanceUiCalls=0`, `part14FinanceUiCalls=0`, `navigationBridgeConsumers=[]`, `directFinanceUiConsumers=[]`. `remainingConsumers` representa consumidores runtime diretos e indiretos conhecidos, e aponta `src/legacy/inline/part-03.js`, `src/legacy/inline/part-07.js` e `src/legacy/inline/part-29.js` por uso de `window.financeApp.financeUiAdapters`.

## Atualizacao 5.20 - aposentadoria de `window.financeUI`

Em 12/09/2026, a exposicao publica `window.financeUI` deixou de ser instalada. `src/ui/legacy-ui.js` continua sendo a implementacao ES canonica dos helpers visuais, mas `installLegacyUiBridge(target)` passa a instalar somente `window.financeApp.financeUiAdapters`.

O checker estrutural passou a reportar `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `removedGlobalSurface=["window.financeUI"]` e `addedGlobalSurface=[]`. Os consumidores runtime remanescentes sao `part-03.js`, `part-07.js` e `part-29.js` via adapters aninhados. Nenhuma regra financeira, autenticacao, Firestore Rule, persistencia, payload, importacao, backup/restore, PDF, horas, parcelamentos, recorrencias, tributos ou materializacao percentual foi alterada.

## Atualizacao 6.0 - checkpoint E2E local com emuladores

Em 12/09/2026, foi adicionado um checkpoint de validacao local em `docs/project-validation-checkpoint.md` e uma jornada E2E emulada em `tests/playwright/integration-local-finance.spec.js`.

O app ganhou uma rota de infraestrutura opt-in para Firebase Emulator em `src/services/firebase.js`, ativada somente com `VITE_FINANCE_USE_FIREBASE_EMULATORS=true` e `VITE_FIREBASE_PROJECT_ID` iniciado por `demo-`. Sem essas variaveis, o comportamento padrao permanece usando a configuracao Firebase existente.

A jornada validada usa Auth Emulator e Firestore Emulator, abre o app em Vite local, cria uma saida pela UI real, confirma persistencia no owner correto, troca para outro usuario no mesmo navegador sem vazamento, e retorna ao usuario original. O teste tambem confirma que `window.financeUI` segue ausente no bootstrap real.

Nenhuma regra financeira, regra de interface, Firestore Rule, deploy, push, pull, fetch, Firebase real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi usado nesta etapa.
