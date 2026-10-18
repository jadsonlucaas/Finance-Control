# Diagnostico da exportacao PDF atual

Data: 2026-09-08

## Relatorios existentes

Foi encontrado um relatorio PDF ativo de fato:

- Relatorio Financeiro Gerencial, acionado pelo botao `btn-export-pdf`.

Nao foi encontrado outro fluxo ativo de exportacao PDF gerencial fora do legado. A importacao bancaria usa PDF.js para leitura de arquivo Itau, mas isso e entrada de dados, nao geracao de relatorio.

## Disparo e handlers

- O botao `btn-export-pdf` e conectado em `src/ui/legacy-events.js`.
- O handler registra `audit('pdf.export', { tab })` e chama a global legada `exportPDF`.
- `exportPDF` esta declarada em `src/legacy/inline/part-03.js`.
- `exportPDF` permanece no inventario de globais como API critica.

Nao ha handler inline HTML direto para o botao de PDF.

## Dados, filtros e totais

O legado usa:

- `getFiltered()` para obter registros filtrados pela tela;
- `focusedDashboardCard` para exportar somente contas em aberto quando o card aberto esta focado;
- campos DOM `f-comp-start`, `f-comp-end`, `f-person`, `f-macro` e `f-cycle` para labels do relatorio;
- `getDashboardAggregations()` e `getDashboardBaseEntradas()` quando disponiveis;
- `window.financeFinancialSelectors.selectPdfFinancialReport` como fonte canonica dos totais do dashboard.

A selecao canonica ja existente esta em `src/application/selectors/financialSelectors.js`. Ela preserva totais oficiais de receitas, saidas pagas, em aberto, saldo realizado, saldo liquido/projetado e comprometimento.

## Calculos e montagem

Hoje `part-03.js` mistura no mesmo bloco:

- obtencao de dados;
- leitura de filtros no DOM;
- classificacao visual de despesas;
- montagem de insights gerenciais;
- formatacao de valores, horas e percentuais;
- desenho do PDF;
- chamada de jsPDF/autotable;
- download;
- toast final.

Os calculos financeiros principais nao devem ser refeitos pelo PDF. O novo caminho deve receber totais prontos de selectors/read models e montar apenas estrutura de relatorio e indicadores derivados de apresentacao.

## Bibliotecas PDF

`src/services/libraryLoader.global.js` carrega `jspdf` e `jspdf-autotable` sob demanda por `ensurePdfLibraries`.

O runtime `jsPDF` nao esta no entry segundo `npm run bundle:budget`. A modernizacao deve preservar esse comportamento e manter a biblioteca PDF fora do bootstrap.

## Acesso a Firebase/dataSdk/window

O bloco legado de PDF nao chama Firebase direto nem `dataSdk` diretamente, mas depende fortemente de globais:

- `exportPDF`
- `getFiltered`
- `getDashboardAggregations`
- `getDashboardBaseEntradas`
- `focusedDashboardCard`
- `allRecords`
- `buildHourPeriodSummary`
- `ensurePdfLibraries`
- `window.jspdf`
- `showToast`
- `financeFinancialSelectors`

O novo controller nao deve usar Firebase/dataSdk/window como regra de negocio. A composicao runtime pode adaptar globais existentes enquanto o legado continuar ativo.

## Dados pessoais e privacidade

O PDF atual exporta campos de lancamentos financeiros como data, tipo, pessoa, categoria, descricao, valor, status e competencia. Nao ha necessidade funcional de exportar UID tecnico, email, telefone, tokens, receipts de idempotencia, auditoria bruta ou metadata interna.

Riscos identificados:

- exportar dados de outro owner se a fonte de registros nao estiver escopada corretamente;
- filename atual usa data local, mas nao inclui PII tecnica;
- tabela detalhada pode carregar campos internos se futuros mapeadores usarem spread sem sanitizacao;
- erro de biblioteca PDF pode deixar o usuario sem feedback estruturado.

## Riscos de regressao

- Divergencia entre cards do Dashboard e totais do PDF.
- Duplicacao de filtros em uma segunda implementacao paralela.
- Entrada de `jsPDF` ou `autoTable` no bootstrap por import estatico.
- Perda da bridge global `exportPDF`, ainda consumida por smoke e eventos legados.
- Clique repetido gerando downloads concorrentes.
- Troca de usuario reaproveitando preview/modelo anterior.
- Exportacao de campos sensiveis ou metadata operacional.

## Caminho seguro

1. Criar `FinancialReportReadModel` puro usando selectors existentes.
2. Separar builders de resumo, secoes, tabelas e filename.
3. Criar adapter PDF isolado, responsavel apenas por layout/download e biblioteca lazy.
4. Criar controller/presenter modernos com `AsyncViewState`.
5. Instalar active UI lazy substituindo a implementacao de `exportPDF` por bridge compativel, sem adicionar nova global top-level.
6. Manter fallback legado somente como compatibilidade se o carregamento moderno falhar.
7. Cobrir equivalencia de totais, filtros, privacidade, owner isolation, erro e lazy loading.
