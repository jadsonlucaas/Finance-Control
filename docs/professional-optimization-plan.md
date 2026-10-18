# Plano De Evolucao Profissional

## Principio Central

Evoluir sem perder nada. Toda alteracao deve ser pequena o suficiente para ser validada, mas conectada a uma arquitetura final clara.

## Fase A - Base De Seguranca

Status: iniciada.

- Manter inventario de globais atualizado.
- Manter smoke como contrato de comportamento.
- Sanear dados antes da persistencia.
- Registrar decisoes tecnicas em `docs/`.
- Medir build e chunks a cada rodada.

## Fase B - Decompor O Legado De Maior Risco

Prioridade maxima: `src/legacy/inline/part-03.js`.

Ordem recomendada:

1. helpers de formulario;
2. CRUD de lancamentos;
3. configuracoes de pessoa/macro/categoria;
4. importacao de saidas/entradas;
5. controle de horas;
6. detalhes de entrada;
7. renderizadores antigos substituidos por modulos `src/ui`.

Regra: cada bloco migrado precisa manter exposicao global temporaria ate os chamadores serem convertidos.

## Fase C - Dominio E Contratos

- Criar schema versionado de `finance_record`.
- Centralizar normalizacao de registros.
- Mover calculos remanescentes para `src/domain`.
- Remover dependencias de DOM em regras de negocio.
- Criar testes para edge cases de salario, quinzena, DSR, banco de horas, importacao e regras percentuais.

## Fase D - Services E Back-End/Firebase

- Trocar imports remotos do Firebase por dependencia local.
- Documentar colecoes, campos, indices e regras de seguranca.
- Criar camada de repository por tipo de dado quando o legado permitir.
- Adicionar logs tecnicos de operacoes criticas.
- Padronizar erros de persistencia.

## Fase E - Performance

- Lazy load de PDF e importacao.
- Lazy load de telas administrativas.
- Memoizacao de filtros grandes.
- Renderizacao incremental em listas longas.
- Paginacao/virtualizacao para listas de lancamentos se a base crescer.
- Remover avaliacao global classica quando todos os scripts virarem modulos.

## Fase F - UX/UI

- Padronizar componentes de formulario, modal, tabela/lista e feedback.
- Revisar responsividade por tela.
- Melhorar estados vazios e carregamento.
- Garantir foco/acessibilidade em modais.
- Evitar layout shift em cards, graficos e listas.

## Fase G - Remocao Controlada De Compatibilidade

Somente depois de testes verdes:

- remover funcoes globais nao usadas;
- remover `classicScripts.js`;
- remover `src/legacy/inline`;
- manter apenas bridges publicas necessarias.

## Checklist Por Mudanca

- Identificar dono da regra atual.
- Adicionar ou confirmar teste.
- Migrar mantendo compatibilidade global.
- Rodar `npm.cmd test`.
- Rodar `npm.cmd run build`.
- Rodar `npm.cmd run smoke`.
- Atualizar documentacao.
