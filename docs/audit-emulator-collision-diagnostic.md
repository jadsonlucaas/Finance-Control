# Diagnostico de avisos de auditoria no Emulator

Executado em: 18/09/2026

## Escopo

Validar a auditoria real de `controle_horas` no ambiente local emulado, sem alterar runtime, Firestore Rules, Auth, payloads financeiros, formulas, budgets, timeouts, retries, Firebase real ou integracoes externas.

## Ambiente verificado

- Branch: `melhoria-arquitetura`
- HEAD inicial: `adfb82d fix: corrige rules de horas e homologa persistencia real`
- Remote: nenhum remote configurado
- Projeto emulado: `demo-finance-control-local-e2e`
- Auth Emulator: `127.0.0.1:9099`
- Firestore Emulator: `127.0.0.1:8080`
- Vite E2E local: `http://127.0.0.1:5178`

## Produtores de auditoria encontrados

| Produtor | Responsabilidade | Observacao |
| --- | --- | --- |
| `src/application/useCases/financeRecordUseCases.js` | Produtor canonico dos eventos financeiros de horas apos mutacao confirmada | `CreateHourEntry` registra `finance_record.create_hour_entry`; `UpdateHourEntry` registra `finance_record.update_hour_entry`. |
| `src/application/useCases/auditUseCaseEvents.js` | Monta e envia o evento canonico ao `AuditTrailService` | Preserva aliases legados e retorna warning se o append falhar. |
| `src/application/audit/AuditTrailService.js` | Construcao, validacao, saneamento e append de `AuditEvent` | Falhas de repositorio ficam observaveis. |
| `src/application/repositories/firebaseRepositories.js` | Adapter `FirebaseAuditRepository` | Delega append para `auditSdk.log`. |
| `src/services/audit.js` | Adapter web que grava `users/{uid}/audit_logs` com `addDoc` | Usado pelo gateway web para persistencia real no Firestore Emulator. |
| `src/domain/FinanceRepository.js` | Auditoria legada por `auditWrite` | Nao duplicou horas nesta jornada porque o provider Firebase declara `auditHandled: true`. |

Fluxo canonico observado:

```text
UI de Controle de Horas
  -> ApplicationCommandGateway
  -> CreateHourEntryCommand / UpdateHourEntryCommand
  -> FinanceRecordRepository
  -> AuditTrailService
  -> FirebaseAuditRepository
  -> auditSdk.log
  -> users/{uid}/audit_logs
```

## Avisos capturados

### Aviso A - tentativa com fixture incorreta

- Comando: `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"`
- Teste: `active users create and edit bank-hour records locally without leaking A -> B -> A`
- Resultado: falhou por assertion de teste, nao por aplicacao.
- Mensagem relevante: `expect(new Set(...)).toHaveLength(2)` recebeu `Set`.
- Classificacao: erro de fixture/assertion.
- Correcao: usar `.size` para validar unicidade.

### Aviso B - log operacional esperado

- Testes: jornada positiva A -> B -> A e intervalo invalido.
- Documento observado: `auth.login` em `audit_logs`.
- Classificacao: repeticao legitima de evento operacional, fora do escopo financeiro de horas.
- Correcao: os testes passaram a filtrar `HOUR_ENTRY_CREATED` e `HOUR_ENTRY_UPDATED`, sem exigir que `audit_logs` inteiro esteja vazio.

### Aviso C - `entity already exists` no Firestore Emulator

- Teste: `active users create and edit bank-hour records locally without leaking A -> B -> A`
- Produtor: Firestore Emulator / WebChannel write stream.
- Mensagem sanitizada:

```text
WARNING: Operation failed: entity already exists:
EntityRef[partitionRef=dev~demo-finance-control-local-e2e,
path=/users/{owner}/audit_logs/{autoDocId}]
```

- Fase: escrita de auditoria ou replay do write stream apos fechamento/retry do canal.
- Estado financeiro: registro de `controle_horas` criado e editado com mesmo `id`, sem duplicidade financeira.
- Estado da auditoria: dois eventos financeiros canonicos persistidos e distintos para a mesma entidade.
- Repetibilidade: reproduzido na jornada focada de horas; uma execucao tambem teve timeout no shutdown do Emulator apos `2 passed`, e a reexecucao final terminou com exit code `0`.
- Classificacao: replay/duplicacao interna do write stream do Firestore Emulator para um documento de auditoria ja criado, sem perda nem colisao semantica comprovada entre operacoes diferentes.

## Evidencia persistida

O E2E `tests/playwright/integration-local-hours.spec.js` agora consulta `users/{uid}/audit_logs` por contexto autenticado e comprova:

- existe exatamente um `HOUR_ENTRY_CREATED` para o cadastro de horas;
- existe exatamente um `HOUR_ENTRY_UPDATED` para a edicao do mesmo registro;
- os dois eventos tem `event_id` distintos;
- os dois eventos apontam para o mesmo `entity_id` do registro de horas;
- `owner_uid`, `actor_uid`, `source_channel`, `entity_type` e `result_status` estao coerentes;
- reload preserva o registro e os dois eventos;
- usuario B nao ve registros financeiros nem eventos financeiros de horas do usuario A;
- intervalo invalido nao cria registro financeiro nem evento financeiro de horas;
- snapshots de auditoria filtrados nao contem senha, token, telefone, WhatsApp ou phone.

## Identidade efetiva

- Criacao: `event_type=HOUR_ENTRY_CREATED`, `action=finance_record.create_hour_entry`, `entity_id={hourRecordId}`, `event_id` proprio.
- Edicao: `event_type=HOUR_ENTRY_UPDATED`, `action=finance_record.update_hour_entry`, mesmo `entity_id`, `event_id` distinto.
- Replay compativel: coberto em teste de servico por identidade igual e conteudo semantico igual, sem append adicional.
- Conflito incompativel: coberto em teste de servico por identidade igual e conteudo diferente, preservando o original e retornando conflito.
- Falha de auditoria apos commit financeiro: coberta em use case de horas com warning observavel e registro financeiro preservado.

## Decisao

Nao houve alteracao de runtime. A evidencia atual nao comprova colisao entre `HOUR_ENTRY_CREATED` e `HOUR_ENTRY_UPDATED`, nem perda de historico financeiro. O aviso `entity already exists` permanece classificado como comportamento do Firestore Emulator/WebChannel durante replay de escrita append ja confirmada.

Limite explicito: esta etapa homologa auditoria da jornada de horas e contratos de identidade testados. Ela nao declara auditoria globalmente infalivel nem substitui auditoria server-side futura.

## Atualizacao 6.5A - XLSX sem relacao com colisao de auditoria

Executado em: 18/09/2026

A falha posterior da suite E2E completa em `integration-local-import-xlsx.spec.js` foi investigada separadamente em `docs/e2e-xlsx-order-isolation-diagnostic.md`. A causa foi sincronizacao do harness de teste ao aguardar o resumo do preview XLSX antes de o controller publicar `previewModel`.

Essa falha nao alterou a classificacao dos avisos de auditoria:

- os avisos `entity already exists` continuam associados ao Firestore Emulator/WebChannel em append ja confirmado de `audit_logs`;
- nao houve evidencia de colisao entre `HOUR_ENTRY_CREATED` e `HOUR_ENTRY_UPDATED`;
- a jornada focada de horas continuou aprovada com `2 passed`;
- parser XLSX, fingerprint, idempotencia, Rules, Auth, runtime e regras financeiras permaneceram intocados.
