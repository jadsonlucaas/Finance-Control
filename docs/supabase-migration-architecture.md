# Arquitetura de migração Firebase → Supabase

## Fases

1. Migrar Firestore para Postgres mantendo Firebase Auth e `firebase_uid`.
2. Ativar shadow-read sanitizado; UI continua usando Firebase.
3. Após paridade 100%, promover Supabase como data backend.
4. Migrar Auth separadamente, com `identity_mappings` validado.

Modes futuros: `firebase`, `shadow`, `supabase`; dual-write permanece proibido até idempotência/reconciliação comprovadas. A abstração deve ficar no repository/provider, não na UI.

O shadow compara hashes, contagens e somas em centavos; nunca envia payload financeiro à observabilidade. n8n deve passar por Edge Function/gateway server-side com secret, idempotência, rate limit, auditoria e RLS/service authorization.
