# Diagnostico de modernizacao de Configuracoes

Data: 04/09/2026

## Escopo analisado

Foram analisados `src/ui/templates/views/viewConfiguracoesTemplate.js`, `src/ui/configuracoes.js`, `src/legacy/inline/part-03.js`, `src/legacy/inline/part-09.js`, `src/legacy/inline/part-29.js`, `src/legacy/classicScripts.js`, `src/legacy/bridgeRegistry.js`, os documentos de referencia/autorizacao/repositorio e os testes de regressao existentes.

Esta etapa e somente localhost. Nao ha push, deploy, Firebase real, WhatsApp, webhook, provider externo, telefone ou Admin SDK.

## Secoes reais da tela

`view-configuracoes` contem as secoes ativas:

- Pessoas.
- Categorias Macro.
- Categorias Personalizadas.
- Configuracao de Tipos de H.E.
- Importar Saidas.
- Importar Entradas.
- Historico.

`part-09.js` injeta dinamicamente o painel "Parametros INSS e IRRF" no topo de Configuracoes quando a aba esta ativa.

## Fontes e escopos

Pessoas sao registros pessoais `type=pessoa` em `users/{uid}/finance_records`. Categorias Macro pessoais sao `type=macro` com `shared_scope=personal`; macros globais sao `shared_macros` com `shared_scope=global`. Categorias pessoais sao `type=categoria` com `shared_scope=personal`; categorias globais sao `shared_categories`.

Tipos de H.E. e parametros tributarios legados usam `localStorage` sincronizavel com prefixo `finance-control-*`. Regras percentuais sao registros pessoais `type=percentage_rule`, mas a tela de Configuracoes apenas lista referencias usadas por elas; a manutencao de regra percentual continua no fluxo existente.

## Mutacoes atuais

- `savePerson()` chama `window.financeRecordMutations.createRecord`.
- Atualizacao de salario base usa handlers legados ligados por `data-update-person-base-salary`.
- `saveMacroCategory()` chama `window.financeRecordMutations.createRecord`.
- `saveCategory()` chama `window.dataSdk.create` ou `window.dataSdk.update`.
- Exclusoes de macro/categoria/pessoa passam por handlers globais legados, com confirmacao.
- `saveTaxSettings()` grava `finance-control-tax-settings-v1` no `localStorage` e chama renderizacao.
- Importacoes e historico permanecem em fluxos proprios legados.

## Riscos

- UI moderna chamar `dataSdk`/Firebase diretamente e duplicar regras de permissao.
- Usuario comum enxergar botao capaz de tentar alterar `shared_*`.
- Misturar referencias pessoais e globais sem `reference_origin`.
- Localizar pessoa por nome em vez de ID em mutacoes.
- Recalcular percentual, tributo ou historico a partir da UI.
- Reatribuir configuracoes locais legadas sem owner ao usuario atual.
- Duplicar handlers ao entrar e sair da aba.
- Aumentar bundle inicial acima de `430080` bytes.

## Dependencias legadas

`part-03.js` ainda contem renderizacao principal de pessoas, macros e categorias. `part-09.js` contem parametros tributarios legados. `part-29.js` adiciona melhorias de acordeao e renderizacao de regras percentuais. `classicScripts.js` permanece com 33 scripts classicos/eval.

## Sequencia segura

1. Criar read model puro de Configuracoes sem DOM, `window`, Firebase ou persistencia.
2. Criar controller/presenter modulares como camada ativa de UI.
3. Instalar lazy loader apos o legacy loader, preservando bridges globais existentes.
4. Delegar mutacoes para acoes injetadas pela composition root.
5. Preservar fluxos legados de importacao, historico, tax settings, horas e regras percentuais.
6. Cobrir isolamento pessoal/global, permissoes e lifecycle com Vitest, Playwright e checks estruturais.
