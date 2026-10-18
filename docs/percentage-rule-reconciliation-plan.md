# Plano de Reconciliacao de Regras Percentuais

## Objetivo

Reconciliar diferencas entre regras percentuais e ocorrencias ja materializadas sem recalculo retroativo automatico.

## Estado atual

O materializador novo identifica ocorrencias existentes por:

- ID deterministico;
- `percentage_occurrence_key`;
- `percentage_rule_id` + pessoa + competencia;
- campos legados de saida percentual.

## Politica conservadora

Nenhum registro existente e sobrescrito automaticamente. Divergencias viram warning:

- `PAID_OCCURRENCE_PRESERVED`;
- `ARCHIVED_OCCURRENCE_PRESERVED`;
- `MANUALLY_EDITED_OCCURRENCE_PRESERVED`;
- `DIVERGENT_AMOUNT_PRESERVED`;
- `DIVERGENT_CATEGORY_PRESERVED`;
- `DIVERGENT_STATUS_PRESERVED`.

## Reconciliacao futura

Uma etapa futura pode criar um caso de uso explicito de preview/reconciliacao com:

- selecao de competencia;
- diff entre valor atual e valor recalculado;
- confirmacao explicita;
- regra separada para futuras, abertas, pagas e editadas;
- auditoria por lote;
- rollback de preview sem escrita.

## Lacunas

- Nao ha Cloud Function/job server-side nesta etapa.
- Nao ha rotina de migracao real de registros antigos para adicionar `percentage_occurrence_key`.
- Nao ha recalculo retroativo automatico por design.

