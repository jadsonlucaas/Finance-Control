# Politica da camada de casos de uso

A camada de casos de uso fica em `src/application/useCases`. Ela e a fronteira onde regras de aplicacao sao executadas sem depender de interface ou infraestrutura concreta.

## Contrato

Entrada conceitual:

```json
{
  "context": {
    "actorUid": "user-1",
    "actorType": "user",
    "role": "user",
    "accountStatus": "active",
    "ownerUid": "user-1",
    "sourceChannel": "web",
    "sourceReferenceId": "form",
    "correlationId": "corr-1",
    "idempotencyKey": "idem-1",
    "requestedAt": "2026-07-18T12:00:00.000Z"
  },
  "input": {}
}
```

Saida padrao:

```json
{
  "success": true,
  "code": "OK",
  "data": {},
  "warnings": [],
  "validationErrors": [],
  "correlationId": "corr-1",
  "idempotentReplay": false
}
```

## Regras

- `accountStatus` deve ser `active` para operacoes financeiras comuns.
- `ownerUid` vem do contexto autorizado e nao pode ser sobrescrito pelo input.
- `sourceChannel` e metadado de rastreabilidade e nao altera calculo, autorizacao ou repositorio.
- `correlationId` e `idempotencyKey` sao preservados nos metadados financeiros quando aplicavel.
- Erros previsiveis retornam `ApplicationResult`; exceptions inesperadas continuam normalizadas pelo gateway.
- Casos de uso nao acessam DOM, `window`, modal, toast, CSS, Firebase SDK, `dataSdk` ou provedores externos.
- Regras puras existentes devem ser reutilizadas: tributos, parcelamentos, recorrencias e jornada.
- Auditoria de sucesso ocorre somente depois da mutacao persistida.

## Fluxo

```text
UI / Future Backend
        |
        v
Gateway
        |
        v
Command Handler
        |
        v
Use Case
        |
        +----> Domain Engine
        |
        +----> Repository Interface
        |
        +----> Audit Repository
```

## Fora do escopo

Nenhum chatbot, webhook, Meta API, provedor de WhatsApp, telefone, identidade externa, permissao publica, Firebase Admin SDK, deploy ou escrita em Firebase real foi implementado.
