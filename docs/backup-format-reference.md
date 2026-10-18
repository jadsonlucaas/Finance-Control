# Referencia do Formato FinanceBackupSnapshot

Data: 2026-08-23

## Versao atual

- `backup_version`: `1.0.0`
- `schema_version`: `1`
- formato canonico: JSON estavel com chaves ordenadas para checksum.

## Estrutura raiz

```json
{
  "backup_id": "backup_*",
  "backup_version": "1.0.0",
  "schema_version": 1,
  "created_at": "ISO-8601",
  "owner_reference": "hash",
  "source_channel": "web",
  "correlation_id": "string",
  "app_version": "string",
  "record_counts": {},
  "checksum": "fnv1a32:*",
  "collections": {},
  "operational": {},
  "warnings": [],
  "metadata": {}
}
```

## Collections

`collections` deve conter listas para:

- `finance_records`
- `personal_references`
- `local_settings`
- `percentage_rules`
- `salary_history`
- `hour_entries`

`operational` e reservado para evidencias que nao sao restauradas como dados financeiros:

- `audit_logs`
- `idempotency_receipts`
- `import_batches`

## Checksum

O checksum e calculado sobre payload canonico sem `checksum`, `filename`, `file_name` ou `original_filename`. Renomear o arquivo local nao altera a assinatura.

## Normalizacao

A serializacao:

- remove `undefined`, funcoes e objetos crus de infraestrutura;
- converte timestamps conhecidos para texto ISO quando possivel;
- ordena chaves;
- limita profundidade e arrays;
- remove campos sensiveis antes da contagem/checksum.

## Visualizacao na UI

Atualizacao em: 2026-09-08

O preview ativo de backup exibe somente metadados seguros: versao, data, owner anonimizado, checksum, contagens por collection, tipos de registro e warnings genericos. A visualizacao nao mostra credenciais, telefone, WhatsApp, payload bruto, arquivo original nem bytes de arquivo.

O nome sugerido para download segue o formato `finance-control-backup-YYYYMMDD-HHmm-vX.json` e nao deve conter UID, email, telefone ou identificador de canal externo.
