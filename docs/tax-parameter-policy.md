# Politica de parametros tributarios versionados

Atualizado em: 21/08/2026

## Objetivo

INSS, IRRF e salario liquido passam a ser calculados por um motor de dominio puro, com parametros versionados por competencia. O objetivo e remover duplicacao de faixas hardcoded entre modulo moderno, bridge global e scripts legados, sem alterar os valores financeiros atuais.

## Fonte dos parametros atuais

As tabelas carregadas no bootstrap sao classificadas como **legado sem fonte**. Elas reproduzem os valores hardcoded que ja existiam no app em runtime e nao devem ser tratadas como tabela oficial.

Versoes iniciais:

- `legacy-unverified-inss-app-baseline`
- `legacy-unverified-irrf-app-baseline`

Novas versoes ativas exigem `source_name`, vigencia e faixas validas. O app nao inventa valores oficiais.

## Modelo

Modulo principal: `src/domain/taxParameters.js`

Campos principais:

- `tax_type`: `inss` ou `irrf`
- `version`
- `valid_from`
- `valid_to`
- `status`: `draft`, `active` ou `archived`
- `source_name`
- `source_reference`
- `source_published_at`
- `brackets`
- `deductions`
- `ceiling_cents`
- `schema_version`

Regras do dominio:

- uma versao `active` nao pode sobrepor outra versao ativa do mesmo imposto;
- faixas devem estar ordenadas, sem sobreposicao e com primeira faixa iniciando em zero;
- parametros arquivados continuam referenciaveis em calculos historicos;
- ausencia de competencia e erro no motor puro; wrappers legados usam baseline de compatibilidade para preservar comportamento antigo.

## Motor de calculo

Modulo principal: `src/domain/taxEngine.js`

APIs puras:

- `CalculateINSS`
- `CalculateIRRF`
- `CalculateNetIncome`
- `resolveTaxParametersByCompetence`

APIs legadas preservadas:

- `calcularINSS`
- `calcularIRRF`
- `calcularLiquido`

As respostas estruturadas incluem versao do parametro, competencia, base em centavos, valor em centavos, valor em reais, warnings e memoria de calculo.

O INSS legado preservado e progressivo por faixa e limitado ao teto de `8475.55`, resultando em `988.10` no teto. Essa classificacao congela o comportamento da UI existente; nao valida fonte oficial.

## Base de calculo das entradas

Na consolidacao mensal, a base tributaria continua sendo apenas:

`salario + hora extra + DSR`

Outras receitas seguem visiveis separadamente e entram no liquido, mas nao entram na base de INSS/IRRF nem em percentuais derivados da renda do trabalho.

## Persistencia

`entrada` pode registrar:

- `inss_parameter_version`
- `irrf_parameter_version`
- `tax_calculated_at`
- `tax_calculation_schema_version`

A colecao `tax_parameters` fica reservada para parametros tributarios versionados. As Rules permitem leitura por usuario ativo e escrita somente por admin ativo com shape valido.

## Bridges globais

`src/legacy-globals.js` e `src/legacy/inline/part-04.js` continuam expondo as funcoes antigas em `window`, mas encaminham para `window.financeApp.taxEngine`. Nenhuma nova API global top-level foi adicionada.

## Limites desta etapa

- Nenhum valor oficial novo foi cadastrado.
- Nenhuma interface administrativa para manutencao de tabelas foi publicada.
- Nenhum dado historico foi migrado automaticamente.
- Nenhum Firebase real, deploy ou integracao externa foi usado.
