# Congelamento de Comportamento

Este documento define o comportamento que deve ser preservado durante a modularizacao do sistema. Antes de qualquer refatoracao estrutural, use esta checklist para validar que os fluxos atuais continuam funcionando.

## Objetivo

- Preservar todas as funcionalidades existentes.
- Impedir alteracao acidental de regras financeiras, fluxos Firebase, importacoes, exportacoes e navegacao.
- Definir quais funcoes publicas e contratos globais nao devem mudar de assinatura ate serem migrados com compatibilidade.

## Regra de Migracao

Durante a modularizacao, qualquer funcao usada por HTML inline (`onclick`, `onchange`, `oninput`, `onsubmit`) ou exposta em `window` deve continuar disponivel com o mesmo nome, mesmos parametros aceitos e mesmo efeito visual/funcional.

Se uma funcao for movida para `src/`, ela deve ser reexportada temporariamente em `window` ate que o handler inline correspondente seja removido.

Exemplo:

```js
import { exportPDF } from './ui/pdf.js';

window.exportPDF = exportPDF;
```

## Checklist Funcional Manual

Execute esta checklist antes e depois de cada etapa grande de refatoracao.

### 1. Autenticacao e Sessao

- [ ] A tela de login aparece quando nao ha usuario autenticado.
- [ ] `toggleAuthMode()` alterna entre login e criacao de conta.
- [ ] Login com email/senha valido abre o app.
- [ ] Erro de login aparece no bloco `auth-error`.
- [ ] Criacao de conta valida senha e confirmacao.
- [ ] Logout encerra a sessao e volta para a tela de login.
- [ ] Email do usuario logado aparece no cabecalho.
- [ ] Usuario admin ve painel de gerenciamento de usuarios.
- [ ] Usuario padrao nao ve controles exclusivos de admin.
- [ ] Troca de usuario limpa dados do usuario anterior e carrega os dados do usuario atual.

Funcoes/contratos envolvidos:

- `handleAuthSubmit(event)`
- `toggleAuthMode()`
- `logout()`
- `applyAuthState(authPayload)`
- `applyRoleVisibility()`
- `refreshManagedUsers()`
- `setManagedUserRole(uid, role)`
- `toggleManagedUserStatus(uid)`
- `window.authSdk`
- `window.userAdminSdk`

### 2. Navegacao Principal

- [ ] Sidebar abre e fecha pelo botao de menu.
- [ ] Overlay da sidebar fecha o menu.
- [ ] Abas navegam corretamente: Dashboard, Saidas, Entradas, Controle de Horas, Configuracoes.
- [ ] Botao voltar retorna para a aba anterior quando aplicavel.
- [ ] Botao da carteira volta ao dashboard.
- [ ] Titulo do app atualiza conforme a aba ativa.
- [ ] Aba ativa fica visualmente destacada.
- [ ] Navegacao nao perde filtros ja preenchidos sem acao explicita do usuario.

Funcoes/contratos envolvidos:

- `toggleSidebar()`
- `switchTab(tab, options = {})`
- `goBackTab()`
- `goToDashboardHome()`
- `renderCurrentTab()`
- `renderAll()`

### 3. Dashboard e Filtros

- [ ] Dashboard abre no mes atual na primeira renderizacao.
- [ ] Filtro de competencia inicial/final muda todos os cards, graficos e listas.
- [ ] Botao mes anterior desloca o intervalo corretamente.
- [ ] Botao proximo mes desloca o intervalo corretamente.
- [ ] Filtro por pessoa altera entradas, saidas, saldos e graficos.
- [ ] Filtro por macro altera saidas e graficos.
- [ ] Filtro por ciclo altera entradas/saidas conforme ciclo.
- [ ] Chips de filtros ativos aparecem e podem ser limpos individualmente.
- [ ] Botao limpar filtros restaura o estado esperado.
- [ ] Cards de resumo focam entradas, saidas, em aberto e saldo.
- [ ] Detalhes abrem listas corretas ao clicar nos cards/graficos.
- [ ] Graficos continuam renderizando com dados e estado vazio.
- [ ] Modal de detalhes do dashboard abre, atualiza e fecha corretamente.
- [ ] Planejador abre e salva eventos sem afetar calculos indevidamente.

Funcoes/contratos envolvidos:

- `renderDashboard()`
- `getDashboardBaseSaidas()`
- `getDashboardBaseEntradas()`
- `getDashboardEntradasSummary()`
- `getDashboardPersonBalances()`
- `getDashboardAggregations()`
- `renderDashboardSummaryFromBase(aggregations)`
- `renderDashboardChartsFromAggregations(aggregations)`
- `renderDashboardRecentListFromBase(aggregations)`
- `renderTrendChartByDashboardFilter()`
- `clearDashboardFilters()`
- `clearDashboardFilter(key)`
- `shiftDashboardCompetenceRange(delta)`
- `setFocusedCard(card)`
- `openDashboardDetail(mode)`
- `openDashboardSaidasDetail(title, records)`
- `closeDashboardExpenseCategoryModal()`
- `openPlannerModal()`
- `renderPlannerModal()`
- `savePlannerEvent()`
- `deletePlannerEvent(id)`

### 4. Saidas

- [ ] Aba Saidas lista registros ativos por padrao.
- [ ] Filtros Ativos/Arquivados/Todos funcionam.
- [ ] Filtro por forma/status de pagamento funciona.
- [ ] Busca filtra por pessoa, categoria, descricao e campos relevantes.
- [ ] Botao carregar mais aumenta a quantidade exibida.
- [ ] Criar nova saida abre formulario com tipo correto.
- [ ] Campos especificos de saida aparecem corretamente.
- [ ] Ciclo Inicio do Mes/Quinzena e preservado.
- [ ] Parcelamento cria registros esperados.
- [ ] Edicao de saida preenche formulario com dados atuais.
- [ ] Cancelar edicao volta ao modo de novo registro.
- [ ] Marcar como pago/em aberto atualiza status e `paid_at`.
- [ ] Arquivar/desarquivar registro atualiza lista e resumo.
- [ ] Excluir saida exige confirmacao.

Funcoes/contratos envolvidos:

- `renderSaidas()`
- `getListRecords(tab)`
- `setListArchiveFilter(tab, mode)`
- `setSaidasPaymentFilter(value)`
- `setListSearchFilter(tab, value)`
- `clearListDetailFilter(tab)`
- `loadMoreRecords(tab)`
- `openNewRecordFlow(type = 'saida')`
- `handleSubmit(event)`
- `openEditRecord(record)`
- `cancelRecordEditing(skipReset = false)`
- `togglePago(record)`
- `toggleArchiveRecord(record)`
- `askDelete(record)`
- `confirmDelete()`
- `cancelDelete()`

### 5. Entradas

- [ ] Aba Entradas lista entradas/consolidacoes do mes filtrado.
- [ ] Filtro de competencia da aba altera a lista.
- [ ] Busca filtra entradas relevantes.
- [ ] Criar nova entrada abre formulario com tipo correto.
- [ ] Campos especificos de entrada aparecem corretamente.
- [ ] Ciclo Inicio do Mes/Quinzena e preservado.
- [ ] Tipo de ganho altera campos de hora extra/desconto quando aplicavel.
- [ ] Detalhe de entrada abre consolidado com salario, hora extra, descontos, INSS, IRRF e liquido.
- [ ] Ajuste de desconto por entrada salva e reflete no consolidado.
- [ ] Salario vigente por pessoa/competencia continua correto.
- [ ] Historico salarial abre, salva novo salario e atualiza vigencia.

Funcoes/contratos envolvidos:

- `renderEntradas()`
- `getEntradasCycleFilterValue()`
- `mapEntradaToCycleView(entry, cycleFilter)`
- `openEntryDetailModal(...)`
- `closeEntryDetailModal()`
- `consolidarEntradaMensal(person, competencia)`
- `saveEntryDiscountAdjustmentByEntry(person, competencia, cycle)`
- `openSalaryHistoryModal(...)`
- `closeSalaryHistoryModal()`
- `saveSalaryHistoryRecord()`
- `getSalarioVigente(personName, competence)`

### 6. Controle de Horas

- [ ] Aba Controle de Horas lista lancamentos agrupados por pessoa/competencia.
- [ ] Busca filtra por pessoa ou competencia.
- [ ] Filtro de competencia altera a lista.
- [ ] Filtro de ciclo Inicio do Mes/Quinzena funciona.
- [ ] Novo lancamento abre modal.
- [ ] Pessoa, competencia e data atualizam os campos calculados.
- [ ] Tipo Hora Extra exibe percentual e valor financeiro.
- [ ] Tipo Banco de Horas exibe natureza debito/credito.
- [ ] Horario inicial/final e intervalo calculam horas corretamente.
- [ ] Salvar cria registro correto.
- [ ] Quando aplicavel, entrada financeira derivada da hora extra e criada.
- [ ] Detalhe abre registros do grupo.
- [ ] Excluir lancamento remove registro e atualiza consolidados.

Funcoes/contratos envolvidos:

- `renderControleHoras()`
- `openHourControlModal()`
- `closeHourControlModal()`
- `handleHourControlTypeChange()`
- `updateHourControlCalculatedFields()`
- `saveHourControlRecord()`
- `openHourDetailModal(...)`
- `closeHourDetailModal()`
- `deleteHourControlRecord(recordId, groupKey)`
- `setControleHorasCycleFilter(value)`
- `calcularHoras(...)`
- `calcularHoraExtra(...)`
- `calcularBancoHoras(...)`
- `calcularSaldoBanco(...)`

### 7. Pessoas, Categorias, Macros e Configuracoes

- [ ] Aba Configuracoes renderiza todas as secoes.
- [ ] Acordeoes de configuracoes abrem/fecham.
- [ ] Criar pessoa salva nome, salario e historico inicial quando aplicavel.
- [ ] Excluir pessoa exige confirmacao.
- [ ] Atualizar salario base reflete nas entradas.
- [ ] Tipo de recebimento da pessoa altera consolidacao.
- [ ] Criar macro salva e atualiza filtros.
- [ ] Excluir macro exige confirmacao.
- [ ] Criar/editar categoria personalizada salva cor/icone/macro.
- [ ] Tipos de H.E. podem ser criados, editados, ativados e inativados.
- [ ] Parametros de INSS/IRRF salvam e afetam calculos.
- [ ] Fontes de renda customizadas aparecem no formulario e podem ser removidas.
- [ ] Arquivar/reabrir periodo altera estado dos registros do periodo.

Funcoes/contratos envolvidos:

- `renderConfiguracoes()`
- `addPerson()`
- `savePerson()`
- `closeAddPersonModal()`
- `askDeletePerson(person)`
- `confirmDeletePerson()`
- `updatePersonBaseSalary(personId, value)`
- `updatePersonReceivingType(personId, value)`
- `addMacroCategory()`
- `saveMacroCategory()`
- `closeAddMacroModal()`
- `askDeleteMacro(macro)`
- `confirmDeleteMacro()`
- `openCategoryForm()`
- `openEditCategory(categoryId)`
- `saveCategory()`
- `closeCategoryForm()`
- `selectColor(color)`
- `openOvertimeTypeModal(typeId = null)`
- `saveOvertimeType()`
- `toggleOvertimeTypeStatus(typeId)`
- `saveTaxSettings()`
- `saveEntryIncomeSource()`
- `deleteEntryIncomeSource(sourceName)`
- `archiveRecordsByCompetence()`
- `restoreArchivedRecordsByCompetence()`

### 8. Importacao XLSX

- [ ] Importar Saidas exige arquivo selecionado.
- [ ] Leitor XLSX carrega sob demanda.
- [ ] Planilha valida importa registros esperados.
- [ ] Linhas invalidas aparecem no relatorio.
- [ ] Duplicidades sao detectadas quando importacao forcada esta desativada.
- [ ] Importacao forcada ignora bloqueio de duplicidade conforme comportamento atual.
- [ ] Capacidade maxima de registros e respeitada.
- [ ] Relatorio de importacao pode ser limpo.
- [ ] Remover importacao de saidas remove registros importados pela origem esperada.
- [ ] Remover todas as saidas exige cuidado e atualiza a lista.
- [ ] Importar Entradas exige arquivo selecionado.
- [ ] Entradas por competencia, valores, descricao e pessoa sao mapeadas corretamente.
- [ ] Relatorio de entradas importadas pode ser limpo.

Funcoes/contratos envolvidos:

- `ensureSpreadsheetLibrary()`
- `readSaidasWorkbookFromInput()`
- `readEntradasWorkbookFromInput()`
- `importSaidasSpreadsheet(forceImport = false)`
- `importEntradasSpreadsheet(forceImport = false)`
- `removeSaidasSpreadsheet()`
- `removeAllSaidas()`
- `clearImportReport()`
- `clearEntradasImportReport()`
- `renderImportReport()`
- `renderEntradasImportReport()`
- `mapSpreadsheetRows(rows)`
- `mapEntradasSpreadsheetRows(rows)`

### 9. Exportacao PDF

- [ ] Exportar PDF sem lancamentos mostra alerta.
- [ ] Bibliotecas PDF carregam sob demanda.
- [ ] PDF e gerado com filtros atuais.
- [ ] PDF respeita foco do dashboard quando estiver em contas em aberto.
- [ ] Tabelas e status aparecem no relatorio.
- [ ] Graficos do PDF renderizam quando Chart.js esta disponivel.
- [ ] Falha ao carregar biblioteca mostra erro amigavel.

Funcoes/contratos envolvidos:

- `ensurePdfLibraries()`
- `exportPDF()`
- `getPdfFilteredRecords()`
- `getPdfFilterLabels()`
- `buildPdfInsights(financialEntradas, saidas)`
- `renderPdfChart(config, width, height)`
- `pdfDrawStatusBadge(doc, cell, status)`

### 10. Regras Percentuais

- [ ] Painel de regras percentuais aparece em Configuracoes.
- [ ] Criar regra valida nome, percentual e categoria.
- [ ] Macro altera opcoes de categoria.
- [ ] Regras podem usar pessoa especifica ou todas as pessoas.
- [ ] Regras podem usar ciclo Inicio do Mes/Quinzena.
- [ ] Regra salva no Firebase via `dataSdk.upsert`.
- [ ] Regra local antiga migra para Firebase quando aplicavel.
- [ ] Regra gera saidas virtuais/persistidas esperadas no periodo.
- [ ] Regras nao duplicam saidas ja persistidas.
- [ ] Editar regra preserva identidade quando esperado.
- [ ] Excluir regra remove gerados vinculados quando aplicavel.
- [ ] Dashboard considera regras percentuais nos totais.

Funcoes/contratos envolvidos:

- `getSyncedPercentageExitRules()`
- `loadPercentageExitRules()`
- `normalizePercentageExitRule(rule)`
- `savePercentageExitRule()`
- `editPercentageExitRule(ruleId)`
- `deletePercentageExitRule(ruleId)`
- `cancelEditPercentageExitRule()`
- `syncPercentageRuleCategoryOptions()`
- `materializePercentageExitRulesForRange(start, end)`
- `schedulePercentageExitMaterialization(start, end)`
- `getPercentageRuleGeneratedRecords(options)`
- `buildPercentageExitRecord(rule, personName, competence, options)`
- `hasPersistedPercentageExitRecord(rule, personName, competence)`
- `dedupePercentageExitRecords(records)`
- `filterOrphanPercentageExitRecords(records)`

### 11. Firebase, Dados e Sincronizacao Local

- [ ] Ao logar, snapshots de registros do usuario sao assinados.
- [ ] Macros/categorias compartilhadas sao carregadas.
- [ ] Dados compartilhados e dados do usuario sao combinados sem duplicar macros/categorias.
- [ ] Criar registro usa `window.dataSdk.create`.
- [ ] Atualizar registro usa `window.dataSdk.update`.
- [ ] Excluir registro usa `window.dataSdk.delete`.
- [ ] `upsert` preserva ID quando necessario.
- [ ] Operacoes em lote suspendem renderizacao ao vivo e renderizam no fim.
- [ ] localStorage com prefixo `finance-control-` sincroniza com Firestore.
- [ ] Snapshot inicial de localStorage pode recarregar a pagina quando necessario.
- [ ] Logout remove subscriptions e limpa snapshots em memoria.
- [ ] Troca de usuario nao mistura registros entre contas.

Funcoes/contratos envolvidos:

- `window.dataSdk.init(dataHandler)`
- `window.dataSdk.create(data)`
- `window.dataSdk.update(data)`
- `window.dataSdk.upsert(data)`
- `window.dataSdk.delete(record)`
- `window.firebaseBatchDeleteRecords(uid, records, batchSize)`
- `dataHandler.onDataChanged(data)`
- `emitCombinedRecords(dataHandler)`
- `beginBulkOperation(type, total)`
- `updateBulkOperation(processed)`
- `flushDeferredSnapshot()`
- `endBulkOperation()`
- `window.cloudLocalStorageSync.set(key, value)`
- `window.cloudLocalStorageSync.remove(key)`
- `window.cloudLocalStorageSync.migrate()`
- `setLocalStorageFromCloud(key, value)`
- `removeLocalStorageFromCloud(key)`

## Funcoes Criticas Que Nao Devem Mudar Assinatura Ainda

Estas funcoes estao acopladas a handlers inline, sobrescritas internas, ou chamadas cruzadas. Durante a modularizacao, mantenha estes nomes em `window` ate remover o acoplamento de HTML.

### Navegacao e UI Global

- `toggleSidebar()`
- `switchTab(tab, options = {})`
- `goBackTab()`
- `goToDashboardHome()`
- `toggleTheme()`
- `showToast(msg, isError = false)`
- `renderAll()`
- `renderCurrentTab()`

### Formularios e Registros

- `openNewRecordFlow(type = 'saida')`
- `toggleFormFields()`
- `setFormCycle(value)`
- `togglePaidAt()`
- `toggleInstallments()`
- `handleEarningTypeChange()`
- `handleOvertimeTypeSelect()`
- `recalculateHourExtraValues()`
- `handleSubmit(event)`
- `openEditRecord(record)`
- `cancelRecordEditing(skipReset = false)`
- `askDelete(record)`
- `confirmDelete()`
- `cancelDelete()`

### Dashboard

- `renderDashboard()`
- `clearDashboardFilters()`
- `clearDashboardFilter(key)`
- `shiftDashboardCompetenceRange(delta)`
- `setFocusedCard(card)`
- `openDashboardDetail(mode)`
- `openDashboardSaidasDetail(title, records = [])`
- `getDashboardBaseSaidas()`
- `getDashboardBaseEntradas()`
- `getDashboardAggregations()`

### Listas

- `renderSaidas()`
- `renderEntradas()`
- `renderControleHoras()`
- `setListArchiveFilter(tab, mode)`
- `setSaidasPaymentFilter(value)`
- `setListSearchFilter(tab, value)`
- `loadMoreRecords(tab)`

### Configuracoes

- `renderConfiguracoes()`
- `addPerson()`
- `savePerson()`
- `updatePersonBaseSalary(personId, value)`
- `updatePersonReceivingType(personId, value)`
- `addMacroCategory()`
- `saveMacroCategory()`
- `openCategoryForm()`
- `saveCategory()`
- `openOvertimeTypeModal(typeId = null)`
- `saveOvertimeType()`
- `toggleOvertimeTypeStatus(typeId)`
- `saveTaxSettings()`

### Entradas e Horas

- `consolidarEntradaMensal(person, competencia)`
- `getSalarioVigente(personName, competence)`
- `openEntryDetailModal(...)`
- `openSalaryHistoryModal(...)`
- `saveSalaryHistoryRecord()`
- `openHourControlModal()`
- `saveHourControlRecord()`
- `openHourDetailModal(...)`
- `deleteHourControlRecord(recordId, groupKey)`
- `setControleHorasCycleFilter(value)`

### Importacao e Exportacao

- `exportPDF()`
- `importSaidasSpreadsheet(forceImport = false)`
- `importEntradasSpreadsheet(forceImport = false)`
- `removeSaidasSpreadsheet()`
- `removeAllSaidas()`

### Regras Percentuais

- `getSyncedPercentageExitRules()`
- `savePercentageExitRule()`
- `editPercentageExitRule(ruleId)`
- `deletePercentageExitRule(ruleId)`
- `syncPercentageRuleCategoryOptions()`
- `materializePercentageExitRulesForRange(start, end)`
- `schedulePercentageExitMaterialization(start, end)`

### SDKs Globais

- `window.dataSdk`
- `window.authSdk`
- `window.userAdminSdk`
- `window.cloudLocalStorageSync`
- `window.firebaseBatchDeleteRecords`

## Criterios de Aceite Para Proxima Etapa

Antes de extrair qualquer modulo:

- [ ] Este documento foi revisado.
- [ ] A checklist foi executada pelo menos uma vez no sistema atual.
- [ ] Qualquer comportamento observado diferente do esperado foi anotado antes da refatoracao.
- [ ] As funcoes criticas acima foram tratadas como contratos publicos temporarios.

## Proxima Etapa Recomendada

Criar a base minima de testes e iniciar pela extracao de funcoes puras:

- dinheiro e formatacao
- datas e competencias
- normalizacao de texto
- calculos de INSS/IRRF
- calculos de horas
- agregacoes puras do dashboard

Nao iniciar pelo dashboard visual, Firebase ou handlers inline. Esses pontos devem ficar para depois que os contratos principais estiverem protegidos.
