# Plano Futuro de Retencao de Auditoria

Data: 2026-08-22

## Estado Atual

Os eventos ficam em `users/{uid}/audit_logs/{logId}`. As Rules aceitam escrita append-only pelo usuario ativo dono do caminho e negam update/delete. Logs legados continuam aceitos para compatibilidade.

## Retencao

Nenhum job de retencao foi implementado nesta etapa. Retencao, exportacao, arquivamento frio e eliminacao legal devem ser executados futuramente em backend confiavel, nunca por cliente web.

## Modelo Futuro

- Manter subcolecao por usuario para isolamento operacional.
- Adicionar espelho server-side assinado se auditoria juridicamente forte for necessaria.
- Indexar por `correlation_id`, `entity_type + entity_id`, `owner_uid`, `event_type`, `result_status` e `occurred_at`.
- Separar auditoria operacional de registros financeiros: eventos nao participam de calculo financeiro.

## Migracao Segura

1. Preservar logs legados.
2. Escrever novos eventos em formato canonico.
3. Criar consulta administrativa server-side.
4. Validar smoke e regras antes de qualquer migracao historica.
5. Somente depois avaliar backfill, sem alterar valores financeiros.
