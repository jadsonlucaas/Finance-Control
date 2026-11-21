# Runbook de migração Supabase

1. Gerar/validar backup integral e export Auth.
2. Restaurar em sandbox isolado.
3. Aplicar migrations SQL e RLS; executar `supabase test db`.
4. Transformar em dry-run, importar em batches idempotentes com checkpoint.
5. Executar parity checker por total/owner/type/competence e somas em centavos.
6. Habilitar shadow-read sem efeito na UI.
7. Exigir 100% parity e rehearsal antes do cutover.

Tooling em `scripts/migration/` falha fechado, não aceita service role no modo de preparação e não imprime payloads. Retry futuro deve ser limitado e cada erro persistido por hash/checkpoint, sem skip silencioso.
