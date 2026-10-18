# Diagnostico de Auditoria e Rastreabilidade

## Situacao atual

A auditoria existe em tres caminhos principais:

- `src/services/audit.js`: servico client-side legado que grava `users/{uid}/audit_logs` com `action`, `actor_uid`, `actor_email`, `created_at`, `status`, `source` e `details`.
- `src/services/dataSdk.js` e `src/domain/FinanceRepository.js`: chamam `auditWrite`/`auditSdk.logLater` depois de operacoes de CRUD financeiro.
- Casos de uso em `src/application/useCases`: chamam `appendAuditEvent` com `AuditRepository`, principalmente para saidas, entradas, series, horas, importacoes e materializacao percentual.

O modelo Firestore atual usa `users/{uid}/audit_logs/{logId}`. As Rules tornam a colecao append-only para update, mas ainda permitem delete por admin acessando outro usuario. Logs legados continuam em formato simples e nao devem ser migrados nesta etapa.

## Inconsistencias encontradas

- Eventos usam nomes mistos: `finance_record.create`, `finance_record.update`, `IMPORT_COMMITTED`, `PERCENTAGE_RULE_OCCURRENCE_CREATED`, `admin.user_approve`.
- Campos variam entre `action`, `event_type`, `source`, `source_channel`, `created_at`, `occurred_at`, `details`, `before` e `after`.
- `correlationId` pode estar ausente quando a mutacao entra direto por SDK legado ou caso de uso sem envelope.
- `actor_type`, `actor_role`, `owner_uid`, `operation`, `entity_type`, `result_status` e `schema_version` nao sao uniformes.
- O sanitizer legado remove poucos campos sensiveis e nao trata telefone, arquivo bruto, cookies, authorization, service account ou private key.
- Falhas de auditoria retornam warning em alguns use cases, mas podem ser apenas `console.warn` no caminho legado.
- Consulta administrativa ainda nao possui contrato de repository suficiente; o adapter Firebase retorna indisponivel para listagem.

## Riscos

- Auditoria client-side nao e prova inviolavel, pois o cliente nao e ambiente plenamente confiavel.
- Eventos sem `correlation_id` dificultam rastrear comando, receipt, mutacao e resultado.
- `details` arbitrario pode armazenar segredo, token, telefone ou payload grande.
- Replay idempotente pode ser interpretado como nova criacao se os consumidores olharem apenas registros financeiros.
- Falha de auditoria apos commit financeiro nao deve fingir rollback nem ser silenciosa.
- Sem query por entidade/correlacao, investigacao operacional depende de varredura manual.

## Eventos encontrados

- Financeiros: `finance_record.create`, `finance_record.update`, `finance_record.mark_paid`, `finance_record.archive`, `finance_record.delete`, `finance_record.create_income`, `finance_record.create_installment_series`, `finance_record.create_recurrence_series`, `finance_record.create_hour_entry`, `finance_record.update_hour_entry`.
- Importacao: `IMPORT_COMMITTED`, `IMPORT_FAILED`.
- Materializacao percentual: `PERCENTAGE_RULE_MATERIALIZATION_STARTED`, `PERCENTAGE_RULE_OCCURRENCE_CREATED`, `PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS`, `PERCENTAGE_RULE_MATERIALIZATION_FAILED`, `PERCENTAGE_RULE_RECEIPT_RECONCILED`.
- Admin: `admin.user_approve`, `admin.user_deactivate`, `admin.user_reactivate`, `admin.user_role_change`.
- Legado/configuracoes: `settings.record_create`, `settings.record_update`, `settings.record_delete`, `percentage_rule.save`.

## Nivel de confianca atual

Client-side audit trail: util para rastreabilidade operacional local, mas nao inviolavel.

Receipts/idempotencia: melhor fonte de integridade contra duplicidade quando usados com chave/fingerprint.

Firestore Rules: reduzem adulteracao client-side, bloqueiam pending/inactive/outro owner e update de logs, mas nao tornam o cliente confiavel.

Auditoria server-side futura: deve ser a camada de maior confianca para eventos criticos.

## Lacunas

- Contrato canonico `AuditEvent`.
- Taxonomia formal de eventos.
- Sanitizacao robusta e testada de `before`, `after` e `metadata`.
- Query append-only padronizada por correlationId, entidade, owner, status e periodo.
- Politica explicita de falha de auditoria por tipo de operacao.
- Retencao futura.
- Escrita server-side confiavel para administracao sensivel.

## Politica proposta

- Manter `users/{uid}/audit_logs/{logId}`.
- Novos eventos usam contrato canonico, preservando aliases legados (`action`, `created_at`, `details`) para leitura antiga.
- `source_channel` representa origem; `operation`/`event_type` representam o que aconteceu.
- `correlation_id` passa a ser obrigatorio para novos eventos canonicos; quando ausente, a camada de servico retorna erro observavel.
- `AuditTrailService` centraliza build, sanitizacao e persistencia.
- Falha de auditoria em operacoes financeiras comuns vira warning observavel, sem rollback falso.
- Eventos administrativos sensiveis continuam documentados como limitados enquanto nao houver backend transacional confiavel.
- Replays nao duplicam eventos financeiros de sucesso.

## Rollback

Rollback local seguro:

- remover `AuditTrailService` e helpers canonicos;
- restaurar `appendAuditEvent` para construir o formato anterior;
- reverter Rules de shape canonico de audit log se necessario;
- manter logs existentes intactos, pois a colecao nao muda.
