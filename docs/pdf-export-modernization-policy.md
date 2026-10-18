# Politica de Modernizacao da Exportacao PDF

Data: 2026-09-08

## Escopo desta etapa

A exportacao ativa do Relatorio Financeiro Gerencial passa a usar uma fronteira modular:

- `FinancialReportReadModel` puro para montar o modelo canonico do relatorio;
- builders puros para resumo, secoes, tabelas e filename;
- controller de exportacao com `AsyncViewState`;
- presenter de status/erro/sucesso;
- adapter PDF separado do negocio;
- active UI carregada por lazy loading e ligada a bridge legada `exportPDF`.

## Guardrails

- O report model nao acessa DOM, `window`, Firebase, `dataSdk`, jsPDF ou autotable.
- O controller nao acessa Firebase, `dataSdk` ou `window.financeApp` como regra de negocio.
- O adapter PDF recebe o report model pronto e nao filtra, nao calcula totais, nao consulta dados e nao resolve owner.
- jsPDF/autotable continuam carregados sob demanda por `ensurePdfLibraries`.
- A bridge global `exportPDF` permanece por compatibilidade; nenhuma nova API global top-level e adicionada.
- Filename nao pode conter UID, email, telefone, WhatsApp, token ou segredo.
- Campos sensiveis e metadados tecnicos desnecessarios nao entram nas tabelas exportaveis.
- Troca de usuario limpa estado quando o owner muda e o report model escopa dados por owner.

## Conteudo permitido

O PDF pode exportar somente dados financeiros ja visiveis no recorte atual:

- data;
- tipo;
- pessoa;
- categoria;
- descricao;
- valor;
- status;
- competencia;
- resumo financeiro vindo dos selectors/read models canonicos.

Nao exportar senha, token, authorization, cookie, private key, idempotency receipt, audit payload bruto, telefone, WhatsApp, owner UID tecnico, email tecnico ou metadata interna.

## Restore, backend e canais externos

Esta etapa nao cria backend, WhatsApp, webhook, provider externo, telefone, Admin SDK, deploy ou Firebase real. Um backend futuro pode reutilizar o report model puro, mas deve resolver identidade, autorizacao, persistencia e storage por contrato server-side proprio.
