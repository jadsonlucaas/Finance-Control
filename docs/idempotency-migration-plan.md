# Plano de Migracao de Idempotencia

## Implantacao Futura

- Manter `idempotencyKey` opcional para UI web simples.
- Exigir `idempotencyKey` por lote em importacoes quando os fluxos forem migrados para `ApplicationCommandGateway`.
- Usar uma chave para a operacao inteira de series, nao uma chave por parcela ou ocorrencia.
- Backend futuro deve chamar o mesmo gateway/casos de uso com contexto autenticado e autorizado.

## Compatibilidade

- Registros financeiros legados continuam validos sem metadata.
- `users/{uid}/idempotency_receipts` e isolado das consultas financeiras.
- Replays retornam ids/codigo anteriores sem nova mutacao financeira.
- Nenhum dado real foi migrado nesta etapa.

## Rollback

- Desabilitar a injecao de `repositories.idempotency` no composition root ou executar comandos sem `idempotencyKey`.
- Receipts persistidos podem permanecer inertes, pois nao afetam Dashboard, relatorios ou calculos.
- Firestore Rules podem manter a subcolecao bloqueada sem impactar `finance_records`.

## Retencao e Cleanup

- `cleanupExpired(context)` existe como contrato e retorna `wrote:false` nesta etapa.
- Um job futuro podera apagar receipts expirados via backend confiavel, com politica de retencao definida antes da ativacao.

## Importacoes

- Importadores futuros devem produzir chave logica por lote/linha conforme o risco de replay.
- Duplicidade sera detectada por chave e fingerprint; divergencia de payload vira conflito.
- Importacoes atuais nao foram alteradas.

## Integracao Futura

- Um identificador externo futuro pode alimentar `source_reference_id` e `idempotency_key`.
- Nao ha implementacao de chatbot, webhook, provider, telefone, mensagem bruta, Admin SDK ou permissao publica.

## Dry-run

`npm run idempotency:dry-run -- caminho/commands.json` avalia comandos locais e retorna:

- comandos sem `idempotencyKey`;
- metadata ausente/invalida;
- possiveis duplicidades;
- conflitos de fingerprint;
- `wrote:false`.
