# Contrato MutationAttemptContext

Data: 2026-09-01

`MutationAttemptContext` representa uma tentativa de mutacao financeira no cliente ou na camada de aplicacao.

## Campos

| Campo | Regra |
| --- | --- |
| `attemptId` | Identificador estavel da tentativa. |
| `idempotencyKey` | Chave reutilizada em retry/reconcile da mesma tentativa. |
| `correlationId` | Correlacao operacional e auditoria. |
| `commandName` | Nome do comando de aplicacao. |
| `sourceChannel` | Canal canonico, como `web`, `bank_import` ou `system`. |
| `createdAt` | ISO string da criacao da tentativa. |
| `status` | `prepared`, `submitting`, `confirmed`, `uncertain`, `failed` ou `reconciled`. |
| `retryCount` | Contador observacional de tentativas. |
| `lastErrorCode` | Codigo normalizado da ultima falha conhecida. |
| `originalPayloadFingerprint` | Fingerprint canonico do payload original. |
| `details` | Metadados saneados, sem payload bruto. |

## Garantias

- Mesmo owner, comando, source channel e payload geram a mesma `idempotencyKey`.
- Payload alterado invalida a tentativa existente.
- O objeto seguro para storage nao inclui `payload` bruto.
- Campos sensiveis sao removidos de `details`.
- A reconciliacao usa receipt e fingerprint; nao infere sucesso por mensagem visual.

