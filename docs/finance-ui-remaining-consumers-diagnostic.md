# Diagnostico de consumidores restantes `financeUI`

Executado em: 12/09/2026

## Escopo

Foram mapeados os consumidores restantes de `window.financeUI` apos a migracao de `part-03.js` e `part-29.js`. Nenhuma regra financeira, formula, autenticacao, Firestore Rule, importacao, backup/restore, PDF, tributos, parcelamentos, recorrencias, horas ou materializacao percentual foi alterada neste diagnostico.

## Consumidores antes

| Arquivo | Chamadas | Funcoes | Classe | Regra financeira? | Decisao |
| --- | ---: | --- | --- | --- | --- |
| `src/ui/importacao.js` | 2 | `showToast` | TOAST | Nao | Remover fallback para `financeUI`; usar toast ES moderno. |
| `src/ui/monthDetail/monthDetailEvents.js` | 1 | `activateTab` | NAVEGACAO / TAB | Nao | Remover fallback global; usar helper ES de tabs quando `switchTab` nao existir. |
| `src/ui/records/financialCrudControllerInstaller.js` | 1 | `showToast` | TOAST | Nao | Remover fallback para `financeUI`; usar injecao/import ES. |
| `src/legacy/inline/part-07.js` | 5 | `setHtml`, `setHidden`, `setText`, `renderListState` | DOM PURO / LISTA | Nao nas chamadas; o arquivo contem calculos ja existentes fora do adapter | Migrar chamadas visuais para `window.financeApp.financeUiAdapters`. |
| `src/legacy/inline/part-08.js` | 9 | `setHtml`, `setHidden`, `activateTab` | DOM / NAVEGACAO | Sim, arquivo critico de configuracoes, salarios e referencias | Nao migrar nesta etapa. |
| `src/legacy/inline/part-14.js` | 4 | `setHtml`, `setHidden` | DOM | Sim, arquivo critico de pessoas/salarios/entrada | Nao migrar nesta etapa. |

## Detalhamento por arquivo

### `src/ui/importacao.js`

- Fluxo: feedback visual de preview, erro, aplicacao em lote, commit e remocao de importacoes.
- DOM afetado: toast visual.
- Equivalente ES: `src/ui/toast.js:showToast`.
- Precisa adapter global: nao.
- Risco: baixo, desde que pipeline `PrepareImportBatch`/`CommitImportBatch`, fingerprints e idempotencia nao sejam alterados.

### `src/ui/monthDetail/monthDetailEvents.js`

- Fluxo: abertura da aba de detalhe mensal quando `target.switchTab` nao esta disponivel.
- DOM afetado: `#main-tabs button` e `#view-mes-detalhe`.
- Equivalente ES: helper novo de navegacao visual por import ES.
- Precisa adapter global: nao.
- Risco: baixo/medio, por ser fallback de navegacao; deve preservar IDs e classes.

### `src/ui/records/financialCrudControllerInstaller.js`

- Fluxo: presenter de mutacoes financeiras modernas.
- DOM afetado: toast visual.
- Equivalente ES: `src/ui/toast.js:showToast` ou helper injetado por `options.showToast`.
- Precisa adapter global: nao.
- Risco: baixo, desde que `ApplicationCommandGateway`, tentativa idempotente e reconciliacao continuem inalterados.

### `src/legacy/inline/part-07.js`

- Fluxo: renderizacao de Controle de Horas e Entradas consolidadas no legado.
- DOM afetado: `#controle-horas-list`, `#controle-horas-saldos`, `#controle-horas-empty`, `#controle-horas-meta`, `#entradas-list`, `#entradas-empty`, `#entradas-meta`.
- Equivalente ES: adapter visual ja instalado em `window.financeApp.financeUiAdapters`.
- Precisa adapter global: sim, porque `part-07.js` continua script classico/eval.
- Regra financeira: os calculos continuam no proprio arquivo legado; somente DOM/lista/meta devem ser redirecionados.
- Risco: medio, por estar perto de horas/entradas; mitigado por nao mover calculos.

### `src/legacy/inline/part-08.js`

- Chamadas atuais: listas de pessoas/macros e `activateTab`.
- Risco: alto. O arquivo participa de configuracoes, referencias, salarios, tipo de recebimento e navegacao classica.
- Decisao: bloquear nesta etapa. Precisa lote especifico com cobertura de configuracoes, pessoas, macros, salarios, recebimento quinzenal e referencias globais/pessoais.

### `src/legacy/inline/part-14.js`

- Chamadas atuais: lista/empty state de pessoas.
- Risco: alto. O arquivo foi classificado como financeiro/dominio critico e cruza pessoas/salarios/entrada.
- Decisao: bloquear nesta etapa. Precisa lote especifico com cobertura de entradas, pessoas, salario vigente e regressao de folha.

## Objetivo da etapa

Depois da migracao, a meta estrutural e:

- `modernFinanceUiConsumers = 0`;
- `part07FinanceUiCalls = 0`, se a migracao visual for segura;
- consumidores restantes limitados a `part-08.js` e `part-14.js`;
- `window.financeUI` mantida enquanto esses consumidores classicos existirem.

## Atualizacao consumidores criticos - 12/09/2026

As chamadas puramente visuais de `setHtml`/`setHidden` em `part-08.js` e `part-14.js` foram caracterizadas e migradas para DOM local equivalente, sem trocar por outro namespace global.

Resultado atual:

- `part-08.js`: `9 -> 0` chamadas diretas a `window.financeUI`;
- `part-14.js`: `4 -> 0` chamadas diretas a `window.financeUI`;
- chamada remanescente em arquivos criticos: nenhuma;
- `financeUiAdapters` nao recebeu consumidor novo nesta etapa;
- Atualizacao 5.20: `window.financeUI` nao e mais instalada; `window.financeApp.financeUiAdapters` permanece por compatibilidade com consumidores classicos remanescentes.

## Atualizacao navegacao - 12/09/2026

`part-08.js:switchTab` deixou de chamar `window.financeUI.activateTab(tab)` e tambem nao chama `window.financeApp.financeUiAdapters.activateTab(tab)`. A ativacao visual agora passa por `src/ui/navigation/navigationCoordinator.js`, que delega para `src/ui/navigationTabs.js:activateTab`.

O checker atual retorna `navigationBridgeConsumers=[]`, `part08FinanceUiCalls=0`, `part14FinanceUiCalls=0` e `directFinanceUiConsumers=[]`. `remainingConsumers` agora lista consumidores runtime diretos e indiretos conhecidos, permanecendo com `part-03`, `part-07` e `part-29` por uso de `window.financeApp.financeUiAdapters`.
