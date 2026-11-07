# Checklist de cutover Supabase

## T-7 dias

- [ ] rehearsal, RLS tests, backup/restore e load tests com dados sintéticos.

## T-24h

- [ ] sync incremental e relatório de paridade.

## T-1h

- [ ] freeze ou dual-write comprovado; backup final; delta migration.

## T0

- [ ] mudar provider por configuração fail-closed; smoke; observabilidade; monitoramento.

## T+

- [ ] Firebase read-only temporário, reconciliação contínua e rollback disponível.

Cutover não está autorizado nesta Issue.
