# Plano de migracao de recorrencias

Atualizado em: 18/07/2026

## Principio

Nao migrar dados reais automaticamente nesta fase. Recorrencias legadas continuam legiveis por `recurrence`.

## Etapas futuras seguras

1. Executar dry-run local sobre exportacao/emulador, nunca em producao como teste.
2. Classificar series com `recurrence_series_id` ausente, `parent_id` reutilizado, duplicidades, gaps e datas invalidas.
3. Revisar manualmente series anuais com 12 ocorrencias.
4. Criar teste de regressao para cada padrao encontrado.
5. Definir script idempotente que gere `recurrence_series_id` somente para grupos confirmados.
6. Executar primeiro em Firebase Emulator com backup.
7. Liberar edicao/exclusao por escopo somente depois de haver mutacao atomica e cobertura UI/Rules.

## Lacunas intencionais

- "Esta e proximas" e "toda a serie" estao modelados, mas bloqueados na UI.
- Nao ha script de migracao real nesta fase.
- Nao ha backend WhatsApp ou Firebase Admin SDK.
- Nao ha escrita em Firebase de producao.

## Criterio para desbloquear escopos

Para liberar escopos amplos sera necessario:

- buscar a serie completa por `recurrence_series_id`;
- bloquear conflito com parcelamento legado;
- persistir update/delete por lote atomico;
- testar clique duplicado, erro de rede e concorrencia;
- preservar registros legados sem metadata completa.
