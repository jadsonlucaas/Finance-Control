# Plano de reversao e reconciliacao de importacoes

## Principio

Nao ha exclusao destrutiva automatica de lotes importados nesta etapa. Reversao deve ser tratada como reconciliacao auditavel: localizar registros por `import_batch_id`, `source_channel`, `source_reference_id`, `import_signature` ou `idempotency_key`, revisar impacto e entao aplicar uma operacao explicita futura de arquivamento/correcao.

## Identificacao

Para auditar um lote:

1. Localizar o `batch_id` no preview ou nos registros persistidos.
2. Buscar registros financeiros com `import_batch_id` igual ao batch.
3. Conferir receipts em `users/{uid}/idempotency_receipts`.
4. Conferir eventos de auditoria `IMPORT_COMMITTED` ou `IMPORT_FAILED`.
5. Comparar `entity_ids` da auditoria com os registros encontrados.

## Reversao futura

Um caso de uso futuro deve:

- exigir usuario ativo e autorizado;
- receber `batch_id` e justificativa;
- executar dry-run antes de qualquer escrita;
- arquivar ou marcar registros, nao deletar silenciosamente;
- criar auditoria antes/depois;
- preservar receipts originais como prova de idempotencia;
- rejeitar lote parcialmente desconhecido ou com registros ja alterados sem reconciliacao manual.

## Lacunas conhecidas

- Ainda nao existe comando de reversao persistente.
- Ainda nao existe colecao `import_batches`; o batch e calculado no preview.
- Importacoes XLSX ja usam a politica canonica para novos commits e preservam assinaturas antigas apenas para detectar `legacy_match`.
- Validacao end-to-end com Firestore real deve ocorrer somente em Emulator.

## UI ativa e suporte a reconciliacao - 06/09/2026

A UI moderna preserva `batch_id`, `idempotency_key`, `correlation_id`, `file_fingerprint` e candidatos prontos enquanto houver preview em memoria. Em falha de commit, o controller consulta `ReconcileMutationAttempt` antes de reenviar quando ha contexto suficiente.

A lacuna permanece: sem colecao duravel de `import_batches`, uma tentativa sem receipt concluido e sem confirmacao de commit ainda pode ficar em estado incerto. Nessa situacao, a UI nao cria novo batch automaticamente e o suporte deve reconciliar por receipts, registros financeiros importados e auditoria disponivel.
