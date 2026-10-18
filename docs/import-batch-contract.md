# Contrato ImportBatch e ImportCandidate

## ImportBatch

```json
{
  "batch_id": "batch_fnv1a32_...",
  "owner_uid": "uid",
  "import_type": "bank_statement",
  "source_channel": "bank_import",
  "original_filename": "extrato.csv",
  "file_fingerprint": "fnv1a32:...",
  "canonical_content_fingerprint": "fnv1a32:...",
  "correlation_id": "corr-1",
  "idempotency_key": "import:bank_statement:fnv1a32:...",
  "status": "ready",
  "total_rows": 2,
  "valid_rows": 2,
  "invalid_rows": 0,
  "duplicate_rows": 0,
  "conflict_rows": 0,
  "imported_rows": 0,
  "skipped_rows": 0,
  "created_at": "2026-08-22T12:00:00.000Z",
  "processed_at": "",
  "schema_version": 1
}
```

Estados aceitos: `parsed`, `validated`, `ready`, `processing`, `completed`, `completed_with_skips`, `failed`, `cancelled`.

O batch e um objeto de aplicacao. Nesta etapa ele nao cria colecao nova no Firestore; a durabilidade vem dos registros financeiros, receipts idempotentes e auditoria.

## ImportCandidate

```json
{
  "candidate_id": "row_1",
  "row_index": 1,
  "source_row_reference": "1",
  "normalized_payload": {
    "type": "saida",
    "person": "Ana",
    "amount": 120.35,
    "source_channel": "bank_import",
    "source_reference_id": "tx-1",
    "idempotency_key": "import-row:bank_statement:fnv1a32:...",
    "import_signature": "fnv1a32:...",
    "import_core_signature": "fnv1a32:...",
    "import_batch_id": "batch_fnv1a32_..."
  },
  "source_channel": "bank_import",
  "source_reference_id": "tx-1",
  "row_fingerprint": "fnv1a32:...",
  "request_fingerprint": "fnv1a32:...",
  "idempotency_key": "import-row:bank_statement:fnv1a32:...",
  "status": "ready",
  "validation_errors": [],
  "warnings": [],
  "existing_entity_id": "",
  "conflict_reason": ""
}
```

## Casos de uso

`PrepareImportBatch` recebe linhas ja parseadas e retorna `ApplicationResult` com `batch`, `candidates`, `summary`, `errors` e `warnings`. Ele valida, deduplica e consulta repositorios para detectar importacoes anteriores, mas nao persiste registros financeiros.

`CommitImportBatch` recebe o preview preparado, seleciona apenas candidatos `ready`, reserva receipts e persiste via `financeRecords.createMany`. O retorno inclui `entityIds`, contagem importada e contagem ignorada.

## Dry-run

`npm run import:dry-run` executa massa bancaria sintetica em memoria e retorna JSON com `wrote=false`, comparacao de fingerprints e contagens por status. Ele existe para auditoria local e nao toca Firebase real.

`npm run import:xlsx-dry-run` executa massa XLSX sintetica em memoria e valida `source_channel=spreadsheet_import`, mesmo conteudo com outro nome, linha invalida, duplicidade interna, registro legado ja importado, conflito de receipt e commit atomico de candidatos `ready`. Ele nao toca Firebase real.

## UI ativa de importacao - 06/09/2026

A UI ativa de XLSX consome este contrato sem criar contrato paralelo:

- `importController` recebe arquivo, chama o parser XLSX canonico, executa `PrepareImportBatch`, monta o read model de preview e chama `CommitImportBatch`.
- `importPreviewReadModel` agrupa `ready`, `invalid`, duplicidades, conflitos e ignorados sem alterar status de candidatos.
- `importPresenter` exibe os grupos, estados de loading/erro/offline e resultado de commit.
- `createMany` permanece encapsulado no caso de uso; a UI moderna nao faz loop de `create` por linha.
- Troca de owner limpa batch/preview/tentativa em memoria.
