# Politica de Resiliencia e Tratamento de Erros

Data: 2026-08-30

## Objetivo

Padronizar falhas de dominio, aplicacao, repositorio, Firebase, rede, offline e lazy load sem alterar regras financeiras nem comportamento funcional. A politica serve para frontend local e para um backend futuro, mantendo codigos estaveis e serializaveis.

## Contratos

| Contrato | Responsabilidade |
| --- | --- |
| `ApplicationError` | Representar erro canonico com categoria, severidade, codigo, mensagens e contexto saneado. |
| `normalizeApplicationError` | Converter qualquer erro para `ApplicationError`. |
| `normalizeRepositoryError` | Converter erros de repositorio para contrato de aplicacao. |
| `normalizeFirebaseError` | Mapear codigos Firebase sem acoplar UI ao Firebase SDK. |
| `normalizeNetworkError` | Detectar falhas de rede, timeout e offline. |
| `normalizeLazyLoadError` | Classificar falhas de `import()`/chunk/modulo opcional. |
| `RetryPolicy` | Decidir retry seguro por tipo de operacao. |
| `executeWithResilience` | Executar operacao, normalizar falha, aplicar retry limitado e preservar correlacao/idempotencia. |
| `ConnectivityService` | Isolar online/offline. |
| `AsyncViewState` | Padronizar estados `idle`, `loading`, `success`, `empty`, `error`, `stale` e `offline`. |
| `ErrorReporter` | Registrar eventos locais sanitizados sem envio externo. |

## Regras gerais

- UI nunca deve decidir comportamento por texto de mensagem.
- Mensagens tecnicas podem existir internamente, mas a UI deve mostrar `userMessage`.
- `details` e contexto sao sanitizados para remover senha, token, telefone, payload bruto, arquivo bruto e credenciais.
- `correlationId` e `idempotencyKey` devem ser preservados entre tentativas.
- Falha final nunca deve ser escondida por catch vazio, fallback silencioso ou loop infinito.
- `source_channel` nao altera politica de erro nem permissao.

## Mutacoes financeiras

- Mutacao sem `idempotencyKey` nao recebe retry automatico.
- Mutacao com `idempotencyKey` pode receber retry limitado somente para erro transitorio suportado.
- Retry de mutacao deve reutilizar a mesma chave, nunca gerar outra.
- Falha de auditoria apos commit principal vira warning observavel, nao rollback falso.
- Quando a confirmacao do cliente se perde, a reconciliacao deve consultar estado/receipt antes de sugerir nova gravacao.
- Falha simulada depois de `IdempotencyRepository.complete` usa codigo `POST_COMMIT_RESPONSE_LOST`, severidade `warning`, resultado `uncertain` e nao converte receipt concluido em falha.
- Eventos `RECONCILIATION_ATTEMPT` e `RECONCILIATION_CONFIRMED` sao observacionais, saneados e locais nesta etapa.

## Reconciliacao pos-commit

Detalhes em `docs/post-commit-reconciliation-policy.md` e `docs/mutation-attempt-contract.md`.

`ReconcileMutationAttempt` consulta somente receipts e entidades ja existentes. Ele nao cria registro financeiro, nao altera regra financeira e nao autoriza retry automatico quando a tentativa nao possui `idempotencyKey`.

## Limites desta etapa

Nao foi implementado WhatsApp, webhook, provider externo, telefone, Admin SDK, nova colecao de mensagens, Firebase real, deploy, fila offline ou telemetry remota.
