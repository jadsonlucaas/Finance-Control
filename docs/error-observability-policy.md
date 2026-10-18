# Politica de Observabilidade de Erros

Data: 2026-08-30

## Objetivo

Registrar falhas operacionais locais de forma sanitizada para diagnostico e testes, sem enviar dados para provedores externos e sem criar colecoes Firestore.

## ErrorReporter

Interface:

- `report(errorEvent)`;
- `listRecent()`;
- `clearLocal()`.

Implementacao atual:

- `InMemoryErrorReporter`;
- buffer local limitado;
- sem Sentry;
- sem webhook;
- sem WhatsApp;
- sem Firebase real;
- sem arquivo bruto ou payload financeiro completo.

## Evento

Campos principais:

- `code`;
- `category`;
- `severity`;
- `operation`;
- `correlationId`;
- `timestamp`;
- `context` sanitizado.

## Saneamento

Remover ou mascarar:

- password;
- token;
- telefone;
- credenciais;
- payload bruto;
- arquivo bruto;
- cookies;
- cabecalhos sensiveis.

## AuditTrail != ErrorTelemetry

| Situacao | Destino |
| --- | --- |
| Erro tecnico antes de mutacao | `ErrorReporter` local. |
| Falha de validacao/negocio | Resultado estruturado e, quando previsto, auditoria de falha. |
| Mutacao financeira concluida | Auditoria financeira de sucesso. |
| Auditoria falhou apos commit | Warning no resultado e `ErrorReporter`. |
| Erro de rede generico | `ErrorReporter`, sem poluir `audit_logs`. |
| Evento de seguranca/admin | Auditoria de seguranca conforme politica existente. |

