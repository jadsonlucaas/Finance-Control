# Politica de modernizacao do Planner financeiro

Data: 03/09/2026

## Objetivo

O Planner financeiro deve ser uma camada de leitura e orquestracao visual. Ele organiza eventos por data, competencia, pessoa, tipo, status, macro e categoria, consumindo registros ja persistidos e eventos locais do Planner.

## Autoridade de regras

O Planner nao e autoridade para criar ou recalcular regras financeiras.

- Parcelamentos continuam sob autoridade de `CreateInstallmentSeries` e das regras documentadas em `docs/installment-policy.md`.
- Recorrencias continuam sob autoridade de `CreateRecurrenceSeries` e das regras documentadas em `docs/recurrence-policy.md`.
- Controle de horas, hora extra, banco de horas e DSR continuam sob os motores e read models existentes.
- Tributos, entradas consolidadas e percentuais continuam fora do Planner.

## Leituras permitidas

Leituras permitidas:

- registros financeiros persistidos recebidos por repositorio, cache local ja carregado ou fonte injetada;
- eventos locais do Planner por owner via `finance-control-planner-events-v2:{ownerHash}`;
- feriados customizados por owner via `finance-control-custom-holidays-v2:{ownerHash}`;
- registros persistidos de controle de horas ja existentes;
- metadados de parcelamento e recorrencia ja gravados no registro.

O Planner nao deve ler Firebase direto, `dataSdk` direto, Admin SDK, webhook ou qualquer canal externo.

As chaves V1 globais permanecem somente como legado nao atribuido. Elas nao podem ser migradas automaticamente para o usuario logado, porque nao carregam owner e podem misturar dados de pessoas diferentes no mesmo navegador.

## Mutacoes permitidas

Eventos manuais do Planner podem continuar usando `localStorage` enquanto nao houver caso de uso dedicado, desde que o armazenamento seja escopado por owner autenticado.

Mutacoes financeiras feitas a partir do Planner devem delegar para a interface de acoes injetada pela composicao da aplicacao por ID real do registro. O Planner nao deve montar writes proprios para Firestore, `dataSdk` ou colecoes remotas, nem depender diretamente de `window.financeApp.financialCrud`.

## Identificacao

Detalhes e acoes devem usar IDs reais:

- `saida:{id}` para saidas persistidas;
- `entrada:{id}` para entradas persistidas;
- `planner:{id}` para eventos locais;
- `hour:{id}` para controle de horas persistido.

Nao e permitido localizar registros financeiros por combinacao de descricao, data e valor.

## Bundle e globals

O Planner moderno deve carregar sob demanda apos o legacy loader.

Limites vigentes:

- Entry JS final <= `430080` bytes.
- Preferencia operacional: Entry JS <= `415000` bytes.
- APIs globais inventariadas <= `50`.
- Scripts classicos/eval <= `33`.
- Nenhum novo `eval`.

As bridges globais legadas do Planner (`openPlannerModal`, `renderPlannerModal`, `savePlannerEvent`, `deletePlannerEvent`, `shiftPlannerMonth`, `selectPlannerDate`, `closePlannerModal`) devem permanecer enquanto existirem consumidores legados.

## Testes obrigatorios antes de remocao legada

Antes de remover `part-26.js` ou `part-27.js`, criar cobertura especifica para:

- abertura do Planner;
- cadastro e exclusao de evento local;
- feriados refletidos no fluxo de DSR;
- eventos de controle de horas derivados;
- registros financeiros persistidos no calendario;
- detalhe por ID real;
- acoes financeiras delegadas ao gateway/CRUD;
- troca de usuario sem vazamento de cache local;
- feriados customizados escopados por owner no DSR;
- Playwright local em `http://127.0.0.1:5173`;
- smoke e inventario de globais aprovados.

## Proibicoes

- Nao recalcular parcelas.
- Nao recalcular recorrencias.
- Nao recalcular impostos.
- Nao recalcular hora extra, banco de horas ou DSR.
- Nao chamar Firebase direto.
- Nao chamar `dataSdk` direto.
- Nao criar novas APIs globais sem inventario e justificativa.
- Nao publicar, fazer deploy ou tocar Firebase real durante validacao local.
