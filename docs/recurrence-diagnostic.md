# Diagnostico de recorrencias

Executado em: 18/07/2026

## Achados

- `src/domain/recordPayloads.js` gerava recorrencias com `count = 12` por padrao quando o chamador nao informava quantidade.
- `src/legacy/inline/part-03.js` fixava `const count = 12` no submit de saida recorrente.
- Recorrencia anual com `count = 12` podia representar 12 anos de lancamentos sem confirmacao explicita.
- O fluxo antigo passava `parentId` para recorrencias, misturando o conceito de serie recorrente com o identificador de parcelamento.
- O fluxo antigo persistia uma ocorrencia por vez com `createRecord`, permitindo serie parcial se uma escrita falhasse no meio.
- Registros legados usam `recurrence` como string (`mensal`, `anual` e variantes historicas), sem metadata de serie.

## Impacto

O risco principal era criar muitas saidas futuras por interpretacao implicita, especialmente em recorrencia anual. O segundo risco era dificultar diagnostico e migracao futura por reutilizar `parent_id` em conceitos diferentes.

## Correcao aplicada

- Criado `CreateRecurrenceSeries` puro, sem DOM, `window`, toast ou Firebase.
- Frequencia explicita normalizada para `monthly` ou `yearly`.
- Termino obrigatorio por quantidade ou data final.
- Serie identificada por `recurrence_series_id`, `recurrence_sequence_no` e `recurrence_total_occurrences`.
- Novas recorrencias nao usam `parent_id`.
- UI passou a exibir preview e persistir por `createManyRecords`.
- Dry-run `analyzeRecurrenceSeries` identifica riscos sem escrever dados.

## Dry-run

O dry-run informa:

- series anuais com 12 ocorrencias;
- gaps de sequencia;
- duplicidades de data;
- datas invalidas;
- conflito com parcelamento;
- `wrote: false`.

Nenhuma migracao de dados reais foi executada.
