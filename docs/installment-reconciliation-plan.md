# Plano de reconciliacao de parcelamentos

Atualizado em: 18/07/2026

## Objetivo

Auditar series parceladas legadas sem alterar dados reais nesta etapa.

## Dry-run local

Use `buildInstallmentReconciliationDryRun(records)` ou `analyzeInstallmentSeries(records)` com fixtures ou registros em memoria. O retorno inclui `wrote: false`.

Campos reportados:

- `parent_id`;
- quantidade encontrada;
- `total_installments` esperado;
- soma atual em centavos;
- diferenca contra total esperado quando conhecido;
- parcelas duplicadas;
- numeros ausentes;
- `parent_id` ausente;
- `installment_no` invalido;
- valores com mais de duas casas;
- sugestao de correcao;
- risco.

## Auditoria futura em dados reais

1. Fazer backup completo antes de qualquer leitura operacional.
2. Exportar registros para ambiente local controlado.
3. Rodar dry-run sem escrita.
4. Revisar manualmente series com `status=needs_review`.
5. Aprovar cada correcao com evidencia de total original.
6. Executar correcao somente com plano de rollback.
7. Validar Dashboard, Parcelamentos e relatorios apos a correcao.

## Criterios de correcao

Uma serie so pode ser corrigida automaticamente no futuro quando o total original for conhecido, `parent_id` for confiavel, nao houver conflito de numeracao e a diferenca for explicavel por arredondamento.

## Rollback

Rollback deve restaurar o backup anterior a qualquer escrita. Esta fase nao executa escrita, portanto nao ha rollback de dados.

## Proibicao

E proibido executar correcao automatica em producao nesta etapa. Nenhum Firebase real, WhatsApp, webhook, telefone, Meta API ou Firebase Admin SDK foi usado ou implementado.
