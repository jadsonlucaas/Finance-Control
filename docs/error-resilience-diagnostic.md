# Diagnostico de Resiliencia e Tratamento de Erros

Data: 2026-08-30

## Escopo

Diagnostico local do tratamento de falhas antes da padronizacao de `ApplicationError`, `RetryPolicy`, `ConnectivityService`, `AsyncViewState` e `ErrorReporter`. Nenhuma regra financeira, Firestore Rules, autenticacao, deploy, Firebase real, WhatsApp, webhook, telefone, provider externo ou Admin SDK foi alterado para produzir este diagnostico.

## Contagem tecnica

| Item | Resultado |
| --- | --- |
| `catch` em `src` | 87 ocorrencias |
| `console.error` em `src` | 33 ocorrencias |
| `showToast` em `src` | 199 ocorrencias |
| `throw new Error` em `src` | 75 ocorrencias |
| APIs globais no baseline | 58 |
| scripts classicos/eval no baseline | 33 |

## Mapa de riscos

| Origem | Erro atual | Codigo atual | Tratamento atual | Risco | Deve retry? | Deve preservar estado? | Politica proposta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ApplicationCommandGateway` | Excecoes de handlers, repositorios e idempotencia | `VALIDATION_ERROR`, `PERSISTENCE_ERROR`, `CONFLICT` | Retorno estruturado parcial | Falta categoria canonica para UI/backend futuro | Somente se leitura ou mutacao idempotente | Sim | Normalizar para `ApplicationError` e reportar localmente |
| `ApplicationResult` | Falha de aplicacao | Codigo legado | Resultado sem erro canonico | Consumidor depende de texto/codigo heterogeneo | Conforme `RetryPolicy` | Sim | Adicionar campo `applicationError` sem remover contrato legado |
| Use cases financeiros | Validacao, negocio, persistencia, auditoria | Mistura de codigo proprio e repository error | Retorna erro ou warning | Falha de auditoria pode parecer falha total | Nao para validacao/negocio | Sim | Diferenciar erro antes do commit e warning pos-commit |
| Repository normalization | Erros de repositorio | `REPOSITORY_*` | Normalizacao tecnica | UI/backend ainda precisam mapper de aplicacao | Rede/timeout conforme operacao | Sim | `normalizeRepositoryError` para categorias estaveis |
| Firebase adapters | `permission-denied`, `unavailable`, `deadline-exceeded` | FirebaseError | Alguns adapters convertem, outros propagam causa | Vazamento tecnico para UI ou retry inseguro | Leituras transitorias; mutacoes so idempotentes | Sim | `normalizeFirebaseError` sem acoplar UI ao Firebase |
| Auth service | Login/permissao/inativo | Codigos do Firebase/Auth | Mensagens especificas no fluxo | Mensagem visual virar logica de negocio | Nao, exceto rede em fluxo seguro futuro | Sim | Categorias `AUTHENTICATION` e `AUTHORIZATION` |
| UI forms | Falha de submit | Toast/texto | Catch encerra loading em pontos isolados | Campos podem ser perdidos ou usuario repetir gravacao | Nao sem idempotencyKey | Sim | Pilotos Playwright exigem draft preservado e loading encerrado |
| Importacao | Preview/commit, duplicidade, arquivo invalido | Import batch codes | Pipeline idempotente, toasts legados | Reenvio sem diferenciar commit perdido | Commit somente com mesma chave | Sim | Usar retry idempotente e estado `stale/error` |
| Backup/restore | Snapshot invalido, conflito, commit falho | Backup codes | Dry-run e validacoes puras | Restauracao parcial ou mensagem ambigua | Nao sem idempotencia | Sim | Erros canonicos e reporter, sem fila offline |
| Materializacao percentual | `createIfAbsent` feito e receipt falha | `RECONCILED_EXISTING`, `CONFLICT` | Reconciliacao ja coberta | Retry concorrente pode duplicar se contrato regredir | Sim, protegido por id deterministico/receipt | Nao aplicavel | Manter politica especifica e documentar pos-commit |
| Auditoria | `append` falha apos mutacao | Warning/erro local | Nao faz rollback falso | Usuario achar que principal nao salvou | Nao repetir cegamente | Sim | `POST_COMMIT_AUDIT_FAILED` como warning observavel |
| Subscriptions | Listener antigo em troca de usuario | Nao padrao | Unsubscribe por repositorio | Vazamento de dados entre owners | Nao | Sim | Politica de ciclo de vida e teste de cleanup |
| Lazy loaders | `import()` rejeitado, chunk antigo | Erro cru/load failed | Catch com console/toast em pontos isolados | App shell quebrar ou reload infinito | Retry manual/limitado | Sim | `LAZY_LOAD_FAILED`, mensagem segura e sem reload automatico infinito |
| Offline/online | Estado do navegador | Nao padrao | Uso indireto ou ausente | Falso sucesso de gravacao offline | Leituras esperam reconexao; mutacoes nao enfileiram | Sim | `ConnectivityService` isolando `navigator.onLine` no adapter |
| Toast/UI | Erro tecnico exibido | Texto livre | `showToast(message)` | FirebaseError ou stack aparecer na UI | Nao decide retry | Sim | `userMessageForError` converte objeto canonico para mensagem amigavel |
| Smoke/Playwright | Fluxos felizes | Nao aplicavel | Testes locais | Falhas transitorias sem cobertura | Conforme caso | Sim | Incluir cenarios Playwright de resiliencia |

## Politica de migracao segura

- Nao substituir todos os catches nesta etapa.
- Integrar a camada canonica como contrato transversal e piloto minimo.
- Manter codigos legados enquanto consumidores antigos existirem.
- Nao introduzir retry automatico em gravacoes financeiras sem idempotencia.
- Nao criar fila offline de mutacoes.
- Nao enviar telemetry para servico externo.

