# Auditoria pesada do projeto

Data da auditoria: 2026-04-19

## Resumo executivo

O sistema evoluiu bastante em direção a uma arquitetura modular, mas ainda opera em um modelo híbrido: módulos novos em `src/core`, `src/domain`, `src/application`, `src/services`, `src/state` e `src/ui`, convivendo com uma camada legada extensa em `src/legacy/inline`. A funcionalidade principal está preservada, porém o maior risco técnico hoje é a ordem de sobrescrita de funções globais. Várias telas funcionam porque arquivos posteriores reatribuem funções declaradas em arquivos anteriores.

A falha vista em `#/mes-detalhe` vinha exatamente desse tipo de divergência: o dashboard já usa entradas consolidadas reais, enquanto o detalhe mensal ainda calculava "vai receber" olhando apenas para registros financeiros crus do mês. A tela foi ajustada para usar a mesma base consolidada que alimenta os cards.

## Correção aplicada nesta rodada

### Detalhe mensal desatualizado

Arquivo alterado: `src/legacy/inline/part-03.js`

Problema:
- `renderMonthlyDetailTab` calculava entradas usando `records.filter(type === 'entrada')`.
- Esse caminho ignora a consolidação de salário, quinzenal, hora extra, INSS, IRRF, descontos e ciclos.
- Resultado: os cards "Vai receber" em `#/mes-detalhe` podiam ficar em `R$ 0,00`, mesmo com entradas reais no dashboard.

Correção:
- Criados helpers locais:
  - `getMonthlyDetailEntradaValue`
  - `getMonthlyDetailEntradaLabel`
  - `getMonthlyDetailConsolidatedEntradas`
- O resumo mensal e a seção "Por pessoa" agora usam `getDashboardBaseEntradas()` quando disponível.
- Quando o módulo do dashboard ainda não estiver pronto, há fallback seguro usando `getPeopleRecords`, `consolidarEntradaMensal` e `mapEntradaToCycleView`.
- A lista de lançamentos do mês continua usando os registros filtrados originais, preservando a operação atual.

## Pontos fortes

- O domínio começou a ficar separado em módulos como `src/domain/dashboard.js`, `src/domain/entries.js`, `src/domain/taxes.js`, `src/domain/hours.js` e `src/domain/dsr.js`.
- Já existe `FinanceRepository`, providers de dados e camada de application para mutações de registros.
- O dashboard tem módulos dedicados para dados, cards, gráficos, eventos e renderer.
- Existem normalizadores, schemas e índices em memória, o que reduz risco de dados antigos quebrarem telas novas.
- O app já possui smoke tests cobrindo fluxos críticos, incluindo dashboard, gráficos, modais, PDF, entradas, saídas e horas.
- Firebase foi encapsulado progressivamente, reduzindo acoplamento direto com a UI.
- Há documentação de segurança e modelo de dados em `docs/firebase-security.md` e `docs/firestore-data-model.md`.

## Principais riscos técnicos

### 1. `part-03.js` ainda é o núcleo de risco

Inventário por tamanho:

| Arquivo | Linhas | Tamanho aproximado |
| --- | ---: | ---: |
| `part-03.js` | 5749 | 329 KB |
| `part-29.js` | 1584 | 97 KB |
| `part-16.js` | 463 | 31 KB |
| `part-31.js` | 455 | 28 KB |
| `part-30.js` | 431 | 26 KB |
| `part-20.js` | 392 | 26 KB |

O `part-03.js` ainda mistura:
- inicialização;
- estado global;
- formulário de lançamentos;
- dashboard legado;
- detalhe mensal;
- importações;
- PDF;
- configurações;
- CRUD;
- renderização de listas;
- helpers de domínio.

Esse arquivo deve continuar sendo quebrado em fatias pequenas. Alterações diretas nele ainda têm alto risco de regressão.

### 2. Sobrescrita de funções globais

Foram encontradas múltiplas reatribuições para funções centrais:

| Função | Arquivos envolvidos |
| --- | --- |
| `renderDashboard` | `part-21.js`, `part-22.js`, `part-23.js`, `part-24.js`, `part-29.js`, `part-30.js`, `part-31.js` |
| `renderEntradas` | `part-09.js`, `part-10.js`, `part-11.js`, `part-12.js`, `part-15.js`, `part-16.js`, `part-29.js` |
| `renderControleHoras` | `part-09.js`, `part-17.js`, `part-18.js`, `part-29.js` |
| `openEntryDetailModal` | `part-09.js`, `part-14.js`, `part-27.js` |
| `consolidarEntradaMensal` | `part-03.js`, `part-05.js`, `part-14.js`, `part-27.js` |
| `saveEntryDiscountAdjustmentByEntry` | `part-11.js`, `part-13.js`, `part-16.js` |

Risco:
- O comportamento real depende da ordem de carregamento.
- Uma migração pequena pode ativar uma versão antiga de uma função.
- Bugs aparecem como "desatualizado", "não puxa informação" ou "só funciona depois de abrir outra aba".

Recomendação:
- Criar módulos donos definitivos para cada função.
- Manter `window.*` apenas na bridge.
- Marcar wrappers legados como deprecated e remover um por vez com smoke test.

### 3. Funções que dão uma volta

Exemplos de voltas atuais:

- Dashboard:
  - filtro DOM -> `renderDashboard` -> agregações -> cards -> gráfico -> wrappers legados -> chart.
  - Alguns wrappers chamam versões anteriores para depois complementar DOM.

- Entradas:
  - `renderEntradas` já foi substituída várias vezes.
  - O detalhe de entrada passa por `consolidarEntradaMensal`, depois por ajustes de DSR, banco de horas, descontos manuais e ciclos.
  - A regra é válida, mas a orquestração deveria ficar em um service/use case único.

- Detalhe mensal:
  - Antes desta correção, a tela usava uma rota paralela de cálculo para entradas.
  - Isso gerou divergência com os cards do dashboard.

- Configurações e horas:
  - Há renderizações que dependem de abrir aba específica para registrar eventos/estado.
  - Isso indica inicialização tardia acoplada à tela.

Recomendação:
- Toda tela deve receber dados já prontos de uma camada de aplicação.
- A UI deve renderizar, não decidir a regra financeira.

### 4. HTML por string ainda é alto

Foram encontradas cerca de 150 ocorrências relacionadas a `innerHTML`, `insertAdjacentHTML` ou handlers/dados HTML dinâmicos em `src`.

Risco:
- Manutenção difícil.
- Maior chance de inconsistência visual.
- Maior cuidado necessário com sanitização de dados de usuário.

Prioridade de troca:
1. Listas de lançamentos.
2. Modais de detalhes.
3. Histórico de descontos.
4. Importações.
5. Configurações/admin.

### 5. Duplicação entre domínio e legado

Áreas com duplicidade conceitual:

- Consolidação de entradas:
  - `src/domain/entries.js`
  - `src/legacy/inline/part-03.js`
  - `src/legacy/inline/part-05.js`
  - `src/legacy/inline/part-14.js`
  - `src/legacy/inline/part-27.js`

- Dashboard:
  - `src/domain/dashboard.js`
  - `src/ui/dashboard/dashboardData.js`
  - wrappers em `part-21.js`, `part-22.js`, `part-23.js`, `part-24.js`, `part-29.js`, `part-30.js`, `part-31.js`

- Eventos:
  - `src/ui/legacy-events.js`
  - `src/ui/events/binder.js`
  - eventos inline/dinâmicos ainda gerados por alguns legados.

Recomendação:
- Eleger um "dono" por regra.
- Legado só deve delegar.
- Nunca manter duas fórmulas financeiras válidas para a mesma métrica.

## Gargalos de performance

### Dashboard no F5

Já existe cache quente em `dataSdk` e hidratação inicial em `part-03.js`. Mesmo assim, atrasos podem continuar por:
- Firebase/Auth ainda finalizando sessão;
- render inicial esperando todos os registros;
- charts e Lucide rodando junto com render principal;
- muitas reatribuições de `renderDashboard`;
- detalhes e listas renderizando HTML em lote.

Recomendação:
- Separar "primeira pintura" dos gráficos.
- Renderizar cards primeiro com cache.
- Atualizar gráficos em idle callback.
- Mostrar indicador discreto de "sincronizando" quando os dados vierem do cache.

### Análise mensal

O clique no gráfico já foi suavizado, mas ainda há custo em:
- montar lista de registros;
- recalcular resumo por pessoa/categoria;
- criar ícones em lote;
- renderizar linha por linha via string.

Recomendação:
- Cachear agregações por competência.
- Virtualizar a lista do detalhe mensal.
- Renderizar primeiro os cards e depois os registros.
- Evitar recalcular entradas consolidadas se o dashboard já calculou.

## Segurança

Pontos positivos:
- Há `firestore.rules`.
- Há documentação de regras e modelo de dados.
- Há `FinanceRepository` e providers, que ajudam a centralizar writes.

Riscos:
- A UI ainda expõe muitos fluxos por funções globais.
- Cache local contém dados financeiros sensíveis.
- Regras de negócio importantes ainda rodam no cliente.
- Importações e writes precisam continuar passando por normalização/validação antes do repository.

Recomendação:
- Auditar `firestore.rules` contra o modelo real.
- Bloquear alteração de `owner_uid` no Firestore.
- Garantir permissões por usuário/admin.
- Registrar logs críticos em `users/{uid}/audit_logs`.
- Adicionar expiração/limpeza para cache local sensível.

## Plano incremental sem regressão

1. Congelar fontes oficiais de cálculo:
   - Dashboard: `src/domain/dashboard.js` + `src/ui/dashboard/dashboardData.js`.
   - Entradas: módulo único de consolidação.
   - Horas: módulo único para saldo financeiro/banco.

2. Remover duplicações por delegação:
   - Em vez de apagar versões legadas de uma vez, trocar o corpo por chamada ao módulo oficial.
   - Rodar smoke após cada troca.

3. Transformar `part-03.js` em orquestrador fino:
   - Extrair detalhe mensal.
   - Extrair importação.
   - Extrair configurações.
   - Extrair PDF.
   - Extrair controle de horas.

4. Criar camada de selectors:
   - `selectDashboardTotals(filters)`.
   - `selectMonthlyDetail(competence, filters)`.
   - `selectEntryConsolidation(person, competence)`.
   - Isso evita cada tela recalcular por conta própria.

5. Reduzir `innerHTML` nas áreas sensíveis:
   - Criar pequenos renderers com `document.createElement`.
   - Começar por histórico de descontos e listas de detalhe.

6. Fortalecer testes:
   - Teste do detalhe mensal com entradas consolidadas.
   - Teste de divergência zero entre cards do dashboard e gráficos.
   - Teste de descontos cumulativos por ciclo.
   - Teste de banco de horas com edição/exclusão.

## Melhorias prioritárias recomendadas

Alta prioridade:
- Mover `renderMonthlyDetailTab` para `src/ui/monthDetail/monthDetailRenderer.js`.
- Criar `src/ui/monthDetail/monthDetailData.js` usando seletores oficiais.
- Eliminar wrappers múltiplos de `renderDashboard`.
- Remover versões antigas de `consolidarEntradaMensal`.
- Garantir que todo PDF use os mesmos selectors dos cards.

Média prioridade:
- Criar virtualização para listas grandes.
- Reduzir `lucide.createIcons()` global e chamar apenas em containers alterados.
- Cachear agregações por assinatura de filtros.
- Criar indicadores de cache/sincronização.

Baixa prioridade:
- Migrar templates grandes do HTML para componentes menores.
- Revisar nomenclaturas antigas depois que o comportamento estiver coberto por testes.

## Critério de sucesso técnico

O projeto estará em um patamar mais escalável quando:

- `part-03.js` tiver menos de 1000 linhas.
- Não houver múltiplas versões ativas para `renderDashboard`, `renderEntradas`, `renderControleHoras` e `consolidarEntradaMensal`.
- Todo total financeiro vier de selectors únicos.
- Build não depender de ordem de scripts clássicos para definir comportamento final.
- Smoke cobrir criar, editar, pagar, arquivar, excluir, importar, PDF, entradas, horas e detalhes.
- Dashboard e PDF apresentarem os mesmos números para o mesmo filtro.
