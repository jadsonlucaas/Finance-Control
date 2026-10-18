# Politica de Materializacao de Regras Percentuais

## Contrato da regra

`percentage_rule` permanece como registro financeiro normal. Campos canonicos:

- `percentage`: percentual em pontos percentuais;
- `base` ou `base_type`: base de calculo;
- `cycle`: `INICIO_MES` ou `QUINZENA`;
- `startCompetence`/`endCompetence`: vigencia;
- `person`: pessoa especifica; vazio significa aplicar para cada pessoa cadastrada;
- `active`: `false` impede novas ocorrencias.

## Semantica do percentual

O formato canonico e percentual em pontos percentuais. `10` significa 10% e `12.5` significa 12,5%.

`0.10` e `1.10` sao formatos ambiguos para migracao e nao sao convertidos silenciosamente. `110` e invalido para `percentage_rule`, pois o contrato limita o percentual a 100.

## Bases existentes

- `liquido`: receita liquida do trabalho;
- `bruta`: receita bruta do trabalho;
- `base_total`: base do trabalho;
- `salario`: salario base;
- `extra`: H.E. + DSR.

Regras de reserva/investimento preservam o comportamento legado: em `QUINZENA`, usam `adiantamentoQuinzena`; em `INICIO_MES`, usam receita liquida do trabalho.

## Calculo

O motor puro `CalculatePercentageRuleOccurrence` recebe regra, pessoa, competencia e base consolidada. Ele nao acessa DOM, `window`, toast, modal ou Firebase.

Formula:

```text
calculatedAmountCents = round(baseAmountCents * rateBasisPoints / 10000)
```

## Occurrence Key e ID deterministico

A chave logica usa owner, regra, pessoa resolvida e competencia:

```text
percentage-rule:{owner}:{ruleId}:{personId}:{competence}:{hash}
```

O ID do documento e deterministico:

```text
percentage_exit_{hash(occurrenceKey)}
```

Isso reduz risco de duplicidade em duas abas, dois dispositivos e retry depois de crash.

## Idempotencia e concorrencia

`MaterializePercentageRulesForCompetence` usa:

- `IdempotencyRepository.reserve`;
- fingerprint deterministico;
- `FinanceRecordRepository.createIfAbsent`;
- `IdempotencyRepository.complete/fail`.

A idempotency key canonica e:

```text
percentage-materialization:{ruleId}:{personId}:{competence}
```

`source_channel` identifica origem, mas nao concede autorizacao.

Para materializacao automatica, o canal canonico e `system`. `percentage_rule_materialization` identifica a operacao, nao o canal; ele aparece em `command_name`, em eventos de auditoria e como semantica do `source_reference_id`/occurrence key.

Evidencia local de concorrencia real: `tests/firestore/percentage-rule-materialization-concurrency.test.js` executa `MaterializePercentageRulesForCompetence` contra o Firestore Emulator usando os repositories Firebase. O teste cobre duas e tres execucoes simultaneas da mesma regra/pessoa/competencia e confirma uma unica ocorrencia persistida, mesmo `percentage_occurrence_key`, mesmo ID deterministico e um unico receipt idempotente.

## Metadata da ocorrencia

A ocorrencia materializada continua sendo `type: saida` e preserva campos legados:

- `generated_percentage_rule`;
- `percentage_rule_id`;
- `percentage_rate`;
- `percentage_base`;
- `percentage_base_amount`.

Metadados adicionados:

- `percentage_occurrence_key`;
- `percentage_rule_version`;
- `percentage_materialized_at`;
- `percentage_calculation_version`;
- `percentage_base_amount_cents`;
- `percentage_calculated_amount_cents`;
- `source_channel`;
- `source_reference_id`;
- `correlation_id`;
- `idempotency_key`;
- `schema_version`.

Nao armazenar telefone, mensagem, token, credencial, provider ou webhook.

## Politica de existentes

Materializacao cria faltantes; nao reescreve existentes.

Se uma ocorrencia ja existe, o materializador retorna `alreadyExisting` e preserva o registro. Ocorrencias pagas, arquivadas, manualmente editadas ou divergentes geram warnings e nao sao recalculadas automaticamente.

## Regra editada

A edicao da regra vale para ocorrencias ainda ausentes conforme a nova configuracao/vigencia. Ocorrencias materializadas anteriormente permanecem historicas.

## Regra excluida ou inativa

Regra inativa ou fora de vigencia nao cria novas ocorrencias. Excluir ou inativar regra nao apaga historico financeiro materializado.

## Auditoria

Eventos usados:

- `PERCENTAGE_RULE_MATERIALIZATION_STARTED`;
- `PERCENTAGE_RULE_OCCURRENCE_CREATED`;
- `PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS`;
- `PERCENTAGE_RULE_MATERIALIZATION_FAILED`.

Auditoria registra owner, actor, source, competencia, rule/person/occurrence key e correlation id sem dados sensiveis.

No teste de concorrencia real, somente a execucao vencedora registra `PERCENTAGE_RULE_OCCURRENCE_CREATED`. Replays, conflitos seguros e execucoes posteriores sobre ocorrencia existente nao duplicam a auditoria de criacao da ocorrencia.

Quando um crash acontece depois de `createIfAbsent` e antes de `IdempotencyRepository.complete`, o retry valida a ocorrencia deterministica ja criada e completa o receipt `processing` como `RECONCILED_EXISTING`. Essa reconciliacao registra `PERCENTAGE_RULE_RECEIPT_RECONCILED` e nao gera nova auditoria financeira `finance_record.create`.

## Firestore Rules

As Rules aceitam apenas canais canonicos em `finance_records` e `idempotency_receipts`: `web`, `bank_import`, `spreadsheet_import`, `system`, `migration` e `future_integration`. Novas saidas geradas por regra percentual usam `source_channel=system` no fluxo automatico. Saidas geradas por regra percentual seguem com um caminho de validacao especifico para `generated_percentage_rule == true`, mantendo owner, tipo, metadata, campos percentuais e transicoes de receipt validados sem exceder o limite de avaliacao das Rules para o payload completo gerado pelo fluxo real.

## Dry-run

`npm run percentage-rules:dry-run` usa fixtures sinteticas em memoria e retorna `wrote: false`. Contagens indicam simulacao, nao escrita em Firebase real.

## Execucao futura por backend

Um backend futuro devera construir dependencies server-side, injetar repositories equivalentes e chamar `MaterializePercentageRulesForCompetence`.

Esse backend nao deve usar DOM/window, nao deve abrir Firestore Rules publicas e nao deve tratar `source_channel` ou `idempotency_key` como autenticacao.

Nesta etapa nao foi implementado Admin SDK, Cloud Function, cron, webhook, provider de WhatsApp, colecao de mensagens ou armazenamento de telefone.
