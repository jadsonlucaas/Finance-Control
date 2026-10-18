# Politica de recorrencias

Atualizado em: 18/07/2026

## Modelo

Recorrencias novas de `saida` usam o caso de uso puro `CreateRecurrenceSeries` em `src/domain/recurrenceSeries.js`.

Campos persistidos por ocorrencia nova:

- `recurrence`: compatibilidade legada (`mensal` ou `anual`).
- `recurrence_frequency`: frequencia explicita (`monthly` ou `yearly`).
- `recurrence_count`: quantidade usada quando o termino for por quantidade; `0` quando o termino for por data final.
- `recurrence_end_date`: data final inclusiva quando usada; vazio quando o termino for por quantidade.
- `recurrence_series_id`: identificador da serie recorrente.
- `recurrence_sequence_no`: posicao da ocorrencia, iniciando em 1.
- `recurrence_total_occurrences`: total calculado da serie.
- `source_mode`: `recurring`.

`parent_id` continua reservado a parcelamentos e nao e reutilizado para recorrencias novas.

## Termino e limites

Toda recorrencia nova exige exatamente um criterio de termino:

- `recurrence_count`; ou
- `recurrence_end_date`.

Limites seguros:

- mensal: no maximo 120 ocorrencias;
- anual: no maximo 30 ocorrencias.

Recorrencia anual nao assume 12 ocorrencias. Se o usuario escolher anual por quantidade, a quantidade exibida e persistida e literalmente o numero de anos/ocorrencias desejado.

## Datas

Mensal preserva o dia ancora da primeira data. Quando o mes de destino nao possui esse dia, usa o ultimo dia valido e retoma a ancora quando possivel.

Anual avanca em ciclos de 12 meses a partir da data ancora. Para 29/02, anos nao bissextos usam 28/02 e anos bissextos retomam 29/02.

`source_channel` e metadados futuros nao alteram datas, quantidades ou valores.

## Persistencia

A serie inteira e gerada em memoria antes da escrita. A UI persiste via `createManyRecords`, que usa lote/writeBatch no provider Firebase local. Falha de persistencia nao deve deixar serie parcial.

## Preview

A UI mostra antes de salvar:

- frequencia;
- quantidade;
- primeira data;
- ultima data;
- total projetado.

## Escopos de edicao e exclusao

Modelo funcional:

- somente esta;
- esta e proximas;
- toda a serie.

Nesta fase, somente "somente esta" permanece habilitado. "Esta e proximas" e "toda a serie" ficam bloqueados ate haver busca completa de consumidores, mutacao atomica da serie, cobertura de regressao especifica e preservacao de compatibilidade com registros legados.

## Compatibilidade

Registros legados com apenas `recurrence` continuam legiveis. Nenhuma migracao real e executada nesta fase.

## Integracao futura

O backend futuro de WhatsApp deve chamar o mesmo caso de uso puro e persistir pelo mesmo repositorio/lote confiavel. Nenhum webhook, telefone, Meta API, Firebase Admin SDK ou chatbot foi implementado.
