# Contrato de idempotencia

Idempotencia evita duplicidade quando o mesmo comando e reenviado pelo mesmo owner, canal e chave.

## Registro persistente

```json
{
  "owner_uid": "user-1",
  "command_name": "CreateExpenseCommand",
  "source_channel": "web",
  "idempotency_key": "key-1",
  "request_fingerprint": "hash-deterministico",
  "status": "completed",
  "entity_id": "record-1",
  "entity_ids": ["record-1"],
  "result_code": "OK",
  "correlation_id": "corr-1",
  "created_at": "2026-08-22T12:00:00.000Z",
  "completed_at": "2026-08-22T12:00:01.000Z",
  "failed_at": "",
  "schema_version": 1
}
```

## Comportamento

- Mesma chave com mesmo fingerprint e resultado completo retorna `IDEMPOTENT_REPLAY`.
- Mesma chave com payload diferente retorna `CONFLICT`.
- `processing` retorna conflito/em processamento.
- `failed` permite retry com o mesmo fingerprint.
- O receipt fica em `users/{uid}/idempotency_receipts/{receiptId}` e nao armazena payload bruto.
- `result_reference` guarda apenas codigo, ids e mensagem.

## Fora do escopo

- Nenhum backend externo foi implementado.
- Nenhuma regra financeira depende da chave de idempotencia.
- Nenhum telefone, webhook, provider, Admin SDK ou mensagem bruta foi implementado.
