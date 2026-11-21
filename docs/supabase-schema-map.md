# Mapa Firestore → Postgres

| Firestore | Postgres |
| --- | --- |
| `users/{uid}` | `profiles`, chave `firebase_uid` durante bridge |
| `users/{uid}/finance_records/{id}` | `finance_records(owner_id,id)` + campos consultáveis + `payload jsonb` |
| `local_storage` | `local_storage(owner_id,key,payload)` |
| `audit_logs` | `audit_logs`, append-only |
| `idempotency_receipts` | tabela homônima |
| globais | `shared_macros`, `shared_categories`, `tax_parameters` |

`parent_id` é identificador lógico e não possui FK. `percentage_rule_id` permanece indexado e só ganhará FK após prova de integridade/semântica. Valores monetários comparáveis usam centavos inteiros; typed values originais continuam no backup portátil.

`identity_mappings(firebase_uid, supabase_user_id, email_hash, migrated_at, migration_version)` impede troca silenciosa de owner.
