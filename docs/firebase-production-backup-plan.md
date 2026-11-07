# Backup integral Firebase production

Target único: `finance-control-cce4f`. Região Firestore: `southamerica-east1`. Inventário read-only em 31/10/2026; nenhum payload foi registrado.

## Inventário sanitizado

| Caminho/grupo | Documentos |
| --- | ---: |
| `users` | 6 |
| `users/*/finance_records` | 4.965 |
| `users/*/audit_logs` | 17.350 |
| `users/*/local_storage` | 18 |
| `users/*/idempotency_receipts` | 0 |
| `shared_macros` | 3 |
| `shared_categories` | 22 |
| `tax_parameters` | 0 |
| `finance_records` raiz legado | 5 |
| Firebase Auth users | 6 (0 disabled) |

Storage de objetos não está em uso verificável: nenhum bucket GCS foi listado. Rules production permanecem no ruleset `62167b62-f34f-45cc-8f99-fad42ab803af`; indexes compostos production: 0.

## Estratégia escolhida

Preferência: Firestore Managed Export para GCS, mais export Auth separado e formato portátil JSONL. O projeto está sem billing e sem bucket, logo o managed export está **BLOCKED** até autorização explícita.

Em 31/10/2026 a autorização foi recebida, porém a conta autenticada não possuía nenhuma billing account aberta/acessível. Estado operacional: **MANUAL BILLING ACTION REQUIRED**. Consulte `docs/firebase-production-backup-execution.md`.

Recurso pago necessário: Cloud Storage bucket e operação managed export do Firestore. Região recomendada: `southamerica-east1`, alinhada ao banco. Custos dependem do volume armazenado, operações e retenção; validar a tabela vigente do Google Cloud antes de autorizar. Impacto: criação de billing/bucket e leitura/export de produção; não altera documentos. Rollback: cancelar export, remover artefatos conforme retenção e, se aprovado pelo owner, desvincular billing após confirmar ausência de dependências.

Comandos pretendidos, somente após autorização:

```text
gcloud storage buckets create gs://<bucket-aprovado> --location=southamerica-east1 --project=finance-control-cce4f
gcloud firestore export gs://<bucket-aprovado>/<prefixo-imutavel> --project=finance-control-cce4f
```

Alternativa application-level: `scripts/migration/export-firestore.mjs`, executado em host confiável com token temporário e diretório externo ao repositório. Só é válido junto do export Auth confiável e da validação integral.

Arquivos reais devem permanecer fora do Git; `backups/` já é ignorado.
