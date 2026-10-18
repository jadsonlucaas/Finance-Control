# Politica de Idempotencia Persistente

## Fingerprint

`buildOperationFingerprint` usa:

- `ownerUid`
- `commandName`
- `sourceChannel`
- `schemaVersion`
- payload canonicalizado

Campos ignorados:

- `requestedAt` / `requested_at`
- `processedAt` / `processed_at`
- `receivedAt` / `received_at`
- `correlationId` / `correlation_id`
- campos sensiveis ou de provedor

O fingerprint e deterministico, ordena chaves e nao armazena payload bruto no receipt.

## IdempotencyReceipt

Path escolhido:

```text
users/{uid}/idempotency_receipts/{receiptId}
```

Campos:

- `owner_uid`
- `command_name`
- `source_channel`
- `idempotency_key`
- `request_fingerprint`
- `status`
- `entity_id`
- `entity_ids`
- `result_code`
- `correlation_id`
- `created_at`
- `completed_at`
- `failed_at`
- `expires_at`
- `schema_version`

`status`: `processing`, `completed`, `failed`.

## Politica

- Chave logica: `owner_uid + command_name + source_channel + idempotency_key`.
- Mesma chave e mesmo fingerprint com `completed`: retorna replay com `idempotentReplay=true`.
- Mesma chave e fingerprint diferente: `CONFLICT`.
- `processing`: conflito/em processamento. Quando o comando tem entidade deterministica e a entidade ja existe, o caso de uso pode reconciliar o receipt apenas depois de validar owner, comando, source channel, fingerprint e identidade completa da entidade.
- `failed`: retry permitido com o mesmo fingerprint.
- Receipt nao e registro financeiro, nao aparece no Dashboard e nao participa de relatorios.
- `result_reference` guarda apenas codigo, ids e mensagem; nao guarda payload bruto nem registro financeiro completo.

## Fluxo

```text
Command
  |
  v
Authorization
  |
  v
Fingerprint
  |
  v
IdempotencyRepository.reserve
  |             \
  |              -> Replay / Conflict
  v
Use Case
  |
  v
Repository Mutation
  |
  v
Audit
  |
  v
IdempotencyRepository.complete
  |
  v
Resposta ao chamador
```

Se a resposta se perder depois de `IdempotencyRepository.complete`, o receipt permanece `completed`. O gateway retorna `uncertain`, preserva `reservationId`, `idempotencyKey` e `requestFingerprint` no resultado e exige reconciliacao antes de reenviar.

`ReconcileMutationAttempt` consulta o receipt pela chave logica e fingerprint. Com receipt `completed`, valida ids retornados quando o repositorio financeiro permite `getById` e retorna `reconciled_success`. Com receipt `processing`, mantem `uncertain`. Com receipt `failed`, retorna falha confirmada com retry permitido somente pelo mesmo fingerprint. Com fingerprint diferente, retorna conflito.

## Firebase

`FirebaseWebIdempotencyRepository.reserve` usa transacao Firestore. As Rules validam owner, shape, status e transicoes, mas corrida e resolvida pelo adapter transacional.

## Importacoes financeiras

Importacoes usam a mesma colecao privada de receipts para `CommitImportBatch` e `ImportRowCommand`.

- Batch: chave logica `owner_uid + CommitImportBatch + source_channel + idempotency_key`.
- Linha: chave logica `owner_uid + ImportRowCommand + source_channel + idempotency_key`.
- `PrepareImportBatch` nao escreve registros financeiros nem receipts obrigatorios.
- `CommitImportBatch` completa receipts apenas depois de `financeRecords.createMany` retornar sucesso.
- Replay de batch concluido retorna `IDEMPOTENT_REPLAY` e nao duplica registros.

Detalhes em `docs/import-idempotency-policy.md`.

## Regras Percentuais

`MaterializePercentageRulesForCompetence` usa idempotency key `percentage-materialization:{ruleId}:{personId}:{competence}` e fingerprint calculado com owner, regra, pessoa, competencia, occurrence key e valor. A defesa contra duplicidade nao depende apenas do receipt: a saida possui ID deterministico e e criada por `createIfAbsent`.

Para materializacao percentual automatica, novos receipts usam `source_channel=system`. `percentage_rule_materialization` nao e canal: e nome de operacao/processo expresso por `command_name`, auditoria e `source_reference_id`.

Se uma falha ocorrer apos `createIfAbsent` e antes de `complete`, o retry consulta o receipt `processing`, localiza a saida pelo ID deterministico/occurrence key e valida owner, regra, pessoa, competencia, occurrence key e fingerprint antes de completar o receipt como `RECONCILED_EXISTING`. Se a entidade estiver ausente, o bloqueio `processing` permanece pela politica existente. Se a entidade existir mas for incompativel, o fluxo retorna `CONFLICT` e nao sobrescreve nem completa falsamente o receipt.

Dry-run percentual declara `wrote: false`; suas contagens sao simuladas em memoria e nao representam escrita em Firebase real.
## Auditoria de replays e conflitos

Receipts persistidos continuam sendo a fonte de decisao para replay/conflito. A auditoria registra o resultado observado com `IDEMPOTENCY_REPLAY` ou `IDEMPOTENCY_CONFLICT`, `result_status` correspondente e `idempotency_key_hash`.

O handler financeiro nao deve ser reexecutado em replay. Assim, uma segunda chamada com o mesmo receipt nao duplica registros financeiros nem duplica auditoria financeira de sucesso. Falhas parciais devem preferir reconciliacao auditavel a criacao de novo registro.
