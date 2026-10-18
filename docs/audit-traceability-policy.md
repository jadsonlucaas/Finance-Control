# Politica de Auditoria e Rastreabilidade

Data: 2026-08-22

## Objetivo

Padronizar auditoria operacional client-side sem alterar regras financeiras, interface, Firebase real, WhatsApp, webhooks ou backend. A auditoria registra rastreabilidade de comandos e resultados, mas nao substitui uma trilha inviolavel server-side.

## Contrato AuditEvent

Todo evento canonico usa `schema_version=1` e `event_version=1`.

Campos obrigatorios:

- `event_id`: identificador do evento.
- `event_type`: tipo registrado em `AUDIT_EVENT_REGISTRY`.
- `category`: `financial`, `operational` ou `admin`.
- `occurred_at`: ISO string.
- `actor_uid`, `actor_type`, `actor_role`: ator que iniciou a operacao.
- `owner_uid`: dono logico dos dados auditados.
- `source_channel`: `web`, `bank_import`, `spreadsheet_import`, `system`, `migration` ou `future_integration`.
- `operation`: nome do comando ou acao legada.
- `entity_type`, `entity_id`, `entity_ids`: entidade afetada.
- `correlation_id`: correlacao obrigatoria por operacao.
- `idempotency_key_hash`: hash, nunca chave bruta.
- `result_status`: `success`, `failure`, `replay`, `conflict` ou `skipped`.
- `before`, `after`, `metadata`: snapshots saneados.

Aliases legados (`action`, `status`, `source`, `entityId`, `correlationId`) permanecem para compatibilidade enquanto houver consumo legado.

## Taxonomia

- Admin: aprovacao, bloqueio, reativacao e troca de perfil.
- Financeiro: criacao/edicao/pagamento/arquivamento/exclusao de saidas, entradas, consolidacao mensal, parcelas, recorrencias e horas.
- Operacional: importacao, idempotencia, replay, conflito, materializacao percentual e reconciliacao.

## Saneamento

Snapshots e metadados removem campos sensiveis conhecidos: senha, tokens, credenciais, segredos, telefone, payload bruto, arquivo bruto, cabecalhos, cookies e chaves privadas. Valores longos, arrays e profundidade sao truncados. Dados financeiros uteis como valor, status, competencia, categoria e identificadores permanecem.

## Politica de Falha

Auditoria falha de forma observavel:

- mutacao financeira concluida + falha de auditoria: retorna warning, sem rollback falso;
- auditoria invalida: retorna erro de validacao no servico;
- repositorio indisponivel: retorna erro `UNAVAILABLE`;
- dry-runs nunca escrevem fora de memoria local.

## Responsabilidades

| Camada | Responsabilidade |
| --- | --- |
| Use case | Montar evento de dominio apos a mutacao confirmada. |
| `AuditTrailService` | Construir, validar, sanear e registrar evento canonico. |
| Repositorio | Persistir append-only e fornecer consultas por id, correlacao, entidade, dono e eventos de seguranca. |
| Firestore Rules | Permitir append proprio ativo, negar update/delete e rejeitar formato invalido. |
| Backend futuro | Tornar auditoria confiavel server-side e assinar/verificar origem. |

## Limites de Confianca

A auditoria atual roda no cliente. Ela e util para suporte, diagnostico e regressao local, mas nao e inviolavel contra cliente comprometido. Evidencia forte exige Cloud Functions, Admin SDK ou backend dedicado no futuro.

## Separacao entre auditoria e telemetry de erro

`AuditTrail` e `ErrorReporter` tem finalidades diferentes.

| Evento | Destino esperado |
| --- | --- |
| Mutacao financeira confirmada | `AuditTrailService` com evento financeiro. |
| Falha de validacao antes da mutacao | Resultado estruturado e `ErrorReporter` quando util para diagnostico. |
| Falha de rede generica | `ErrorReporter`, sem criar `audit_log` financeiro. |
| Falha de auditoria apos commit principal | Warning observavel e `ErrorReporter`; nao rollback falso. |
| Falha de seguranca/admin | Auditoria de seguranca conforme matriz de autorizacao. |

Telemetry de erro local nao substitui auditoria append-only e nao deve receber payload financeiro completo, telefone, token, arquivo bruto ou credenciais.
