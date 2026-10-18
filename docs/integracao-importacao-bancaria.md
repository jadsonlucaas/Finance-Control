# Integracao de Importacao Bancaria

## Objetivo

Adicionar uma aba dedicada de importacao bancaria ao `finance control_new` sem alterar a logica que hoje ja funciona em:

- `Dashboard`
- `Saidas`
- `Entradas`
- `Controle de Horas`
- `Configuracoes`

A integracao deve transformar extratos em registros compativeis com o schema atual do app, em vez de criar um fluxo paralelo.

## Principio de arquitetura

O sistema deve ter duas origens legitimas de dados financeiros:

- lancamento manual
- importacao bancaria

As duas origens devem coexistir no mesmo modelo de dados e no mesmo dashboard.

Ou seja:

- o importador nao substitui o cadastro manual;
- o cadastro manual nao perde relevancia;
- ambos devem persistir no mesmo repositorio;
- ambos devem aparecer juntos em `Saidas`, `Entradas`, filtros, relatorios e dashboard;
- a diferenca entre eles deve ficar em metadados de origem, e nao em fluxos separados de negocio.

O app principal ja possui um contrato claro para dados financeiros:

- `type: "saida"`
- `macro_category`
- `subcategory`
- `description`
- `amount`
- `status`
- `occurred_date`
- `due_date`
- `competence`
- `person`
- `category_id`
- `category_name`
- `category_color`
- `category_icon`
- `import_source`
- `import_signature`
- `import_core_signature`

Por isso, a melhor integracao nao e incorporar o projeto de importacao como um segundo sistema. A melhor integracao e:

1. Ler o arquivo do banco.
2. Normalizar cada movimentacao para um modelo intermediario.
3. Resolver categoria usando as categorias oficiais do Finance Control.
4. Mostrar preview e conflitos.
5. Persistir no mesmo repositorio Firestore que o dashboard ja consome, lado a lado com os lancamentos manuais.

## Fonte unica, origem dupla

A recomendacao tecnica e manter:

- uma unica fonte de verdade para leitura do sistema
- duas formas de entrada de dados

Na pratica:

- a fonte de verdade continua sendo `allRecords` e o repositorio atual;
- o usuario pode criar um registro manualmente;
- o usuario pode importar um registro de extrato;
- ambos viram records compativeis com o schema atual;
- ambos alimentam as mesmas agregacoes.

Campos de rastreabilidade recomendados:

- `source_mode`: `manual` ou `import` no contrato canonico; registros legados com `imported` continuam reconhecidos na visualizacao historica.
- `import_source`: ex. `bank:bradesco`
- `import_batch_id`: identificador do lote
- `import_signature`
- `import_core_signature`
- `owner_uid`
- `owner_email`

Para lancamentos manuais:

- `source_mode = manual`
- `import_source = ''`

Para lancamentos importados:

- `source_mode = import`
- `import_source` preenchido
- `owner_uid` e `owner_email` sempre vinculados ao usuario autenticado

## Isolamento por usuario

Toda a experiencia de importacao precisa ser isolada por usuario autenticado.

Isso significa:

- um usuario so pode ler os proprios registros importados;
- um usuario so pode remover os proprios lotes de importacao;
- categorias, pessoas e historicos usados pela aba devem respeitar o escopo do usuario atual;
- nenhum preview, assinatura, lote ou reconciliacao pode afetar os dados de outra conta.

Na pratica:

- a leitura continua vindo da colecao do usuario em `users/{uid}/finance_records`;
- a importacao grava registros com `owner_uid` e `owner_email`;
- o historico da aba `Importacao` deve listar apenas lotes do usuario atual;
- a remocao seletiva por item ou por lote deve ocorrer apenas dentro do escopo do `uid` autenticado.

## Regra principal de negocio

Importacao bancaria deve alimentar apenas `Saidas`.

Motivo:

- o dashboard atual de gastos e distribuicoes ja e baseado em `saida`;
- o detalhamento por categoria e subcategoria ja esta maduro;
- o risco de regressao e menor;
- a maior parte dos extratos bancarios de conta corrente mistura transferencias, compras, tarifas e pagamentos, que operacionalmente se encaixam melhor como saidas revisaveis.

Entradas nao devem ser criadas pelo importador bancario porque no `finance control_new` elas ja possuem fluxo automatico proprio e consolidacao especifica.

Na pratica:

- importacao bancaria grava somente `type: "saida"`
- fluxo automatico atual continua sendo a unica origem de `entradas`
- lancamento manual continua disponivel para ajustes operacionais
- dashboard segue consumindo `entradas` automaticas + `saidas` manuais/importadas

Lancamentos manuais continuam sendo usados normalmente para:

- ajustes finos
- despesas que nao passam por conta bancária
- correcao de classificacao
- registros operacionais que o extrato nao representa bem
- complementos apos importacao

Entradas bancarias podem entrar em uma segunda fase, com tratamento proprio para:

- salario
- transferencia recebida
- reembolso
- rendimento

Esses cenarios podem ate aparecer no extrato bancario, mas nao devem virar `entrada` automaticamente dentro deste projeto, para nao conflitar com a logica financeira ja existente.

## Mapeamento recomendado

### Movimento importado -> record do app

- `data do extrato` -> `occurred_date`
- `competencia inferida` -> `competence`
- `descricao original` -> `description`
- `valor absoluto` -> `amount`
- `tipo debito` -> `type: "saida"`
- `status inicial` -> `Pago` quando ja debitado; `Em aberto` apenas em casos especificos
- `metodo de pagamento` -> `payment_method` quando o banco ou parser conseguir inferir
- `banco selecionado` -> `import_source`, por exemplo `bank:bradesco`
- `assinatura do registro` -> `import_signature` e `import_core_signature`
- `origem` -> `source_mode: "import"`

### Lancamento manual -> record do app

O lancamento manual continua seguindo o fluxo atual do sistema, mas passa a explicitar a origem:

- `origem` -> `source_mode: "manual"`
- sem `import_batch_id`
- sem `import_signature`
- sem `import_core_signature`

Isso e importante para:

- auditoria
- filtros
- relatorio de produtividade
- remocao segura apenas do que veio por importacao
- preservar lancamentos manuais feitos apos uma importacao

### Categoria importada -> categoria oficial

O importador nao deve criar categorias novas automaticamente.

Ele deve:

1. tentar casar a descricao com categorias ja existentes;
2. sugerir a melhor categoria quando houver alta confianca;
3. deixar o usuario ajustar manualmente quando houver ambiguidade;
4. persistir `category_id`, `category_name`, `category_color`, `category_icon` junto do record.

Isso garante:

- coerencia visual;
- dashboards consistentes;
- filtros funcionando sem gambiarras;
- nenhuma duplicacao entre "categoria do importador" e "categoria do app".

## Como amarrar ao dashboard

Para o dashboard refletir corretamente o modelo hibrido, todo record manual ou importado de `saida` precisa preencher:

- `amount`
- `status`
- `competence`
- `macro_category`
- `subcategory`
- `description`
- `person` quando aplicavel

As `entradas` continuam chegando pelo fluxo automatico ja adotado no sistema e nao fazem parte do escopo da importacao bancaria.

Sem isso:

- o total pago x em aberto quebra;
- o grafico por categoria fica vazio ou errado;
- o detalhamento por subcategoria perde utilidade;
- a visao por pessoa fica incompleta;
- o filtro por periodo deixa lancamentos de fora.

## Fluxo profissional recomendado

### Fase 1

- Criar aba `Importacao` no visual do app.
- Documentar a arquitetura.
- Expor categorias e macros oficiais que serao usadas pelo importador.
- Formalizar a convivencia entre registros manuais e importados.

### Fase 2

- Criar motor de leitura no frontend:
  - Mercado Pago CSV
  - Bradesco CSV
  - Inter CSV
  - Itau PDF
- Normalizar tudo para um modelo unico:
  - `bank`
  - `date`
  - `description`
  - `amount`
  - `direction`
  - `reference`
 - filtrar e preparar persistencia apenas para movimentos que serao tratados como `saida`

### Fase 3

- Montar preview antes de salvar.
- Destacar:
  - duplicados detectados
  - categorias sugeridas
  - linhas sem categoria confiavel
  - possiveis transferencias internas

### Fase 4

- Persistir apenas registros aprovados.
- Salvar com `import_source`, `import_signature` e `import_core_signature`.
- Permitir remover:
  - uma importacao especifica
  - todos os registros de um banco em um periodo
  - sem tocar em registros manuais
 - sem gerar qualquer `entrada`

### Fase 5

- Tratar receitas bancarias com fluxo proprio.
- Implementar OCR opcional para PDF escaneado.
- Reconciliar transferencias internas para nao dobrar gasto.

## Melhorias recomendadas

### 1. Preview obrigatorio

Nao gravar direto no Firestore.

Motivo:

- evita poluicao do banco;
- melhora confianca;
- reduz retrabalho;
- permite ajuste de categoria em lote.

### 2. Deteccao de duplicidade em dois niveis

- `import_signature`: assinatura completa da linha importada
- `import_core_signature`: assinatura essencial por data, descricao normalizada, valor e banco

Isso ajuda quando o arquivo vem com pequenas variacoes textuais.

### 3. Tratar transferencia interna separadamente

PIX para conta propria, transferencia entre bancos e aporte para investimento nao devem distorcer o dashboard de consumo.

Melhor abordagem:

- classificar como categoria tecnica;
- permitir excluir do dashboard de despesas de consumo;
- ou marcar com uma flag futura como `is_internal_transfer`.

### 4. Faixa de confianca de categoria

Toda sugestao automatica deveria carregar:

- `high`
- `medium`
- `low`

Somente `high` deve entrar preselecionada sem revisao.

### 5. Historico de importacao

Criar um registro resumido por lote:

- banco
- arquivo
- data da importacao
- quantidade lida
- quantidade aprovada
- quantidade descartada
- quantidade duplicada

Isso simplifica suporte, auditoria e reversao.

### 6. Filtro por origem

Adicionar filtro opcional no app:

- todos
- manuais
- importados

Isso melhora:

- conferência
- auditoria
- revisão de lote
- confiança no fechamento mensal

### 7. Ignorar pipeline de entradas na importacao bancaria

Mesmo quando o extrato trouxer credito positivo, o importador nao deve criar `entrada`.

Melhor abordagem:

- classificar como informacao nao importavel para este fluxo
- exibir no preview como movimento ignorado ou neutro
- permitir futura analise manual, se necessario
- manter intacta a logica automatica de `entradas` do sistema

## Conclusao

A integracao correta nao e "colocar o importador dentro do projeto".

A integracao correta e usar o importador como uma das origens de dados de `saidas`, junto com o lancamento manual, mas fazer o `finance control_new` continuar sendo a unica verdade de:

- categorias
- macros
- saidas
- dashboard
- historico
- filtros

Com isso, o sistema ganha importacao bancaria profissional sem perder a estabilidade do que ja funciona.
