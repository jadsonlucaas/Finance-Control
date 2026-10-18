# Matriz de autorizacao Firestore

Gerado em: 2026-07-18

Escopo: regras Firestore validadas localmente com Firebase Emulator e `@firebase/rules-unit-testing`, usando somente o `projectId` ficticio `finance-control-local-test`. Nenhum teste desta matriz usa credenciais reais, projeto Firebase real ou dados de producao.

## Principio de seguranca

Usuarios autenticados com perfil `inactive`, sem perfil ou com `status` diferente de `active` nao podem usar acesso pessoal para ler, criar, atualizar ou excluir dados financeiros nas proprias subcolecoes privadas. A sessao de autenticacao isoladamente nao autoriza acesso aos dados.

## Politica de autoridade administrativa

Politica adotada: **Politica A - Claim confiavel independente**.

- Custom claim `admin: true`: autoridade administrativa confiavel emitida somente por ambiente server-side confiavel, como Console Firebase, script com Firebase Admin SDK ou backend administrativo. Nao depende de perfil Firestore `active` para operacoes administrativas previstas nas Rules.
- Role de perfil `admin`: autoridade administrativa derivada de `users/{uid}.role == 'admin'`, mas somente quando `status == 'active'`.
- Role de perfil `owner`: equivalente administrativo a `admin` nas Rules quando `status == 'active'`; representa autoridade maxima operacional dentro do app, mas nao cria custom claims.
- Status `pending`: estado inicial de novas contas; bloqueia acesso financeiro ate aprovacao administrativa.
- Status `active`: controla acesso comum do usuario as proprias informacoes e habilita admin/owner baseado em perfil.
- Status `inactive`: bloqueia acesso pessoal as proprias subcolecoes. Se o usuario tambem possuir custom claim `admin: true`, a claim continua permitindo bootstrap/recuperacao administrativa, inclusive reativar perfis, mas nao libera operacoes pessoais nas proprias subcolecoes.
- Bootstrap e recuperacao: a primeira autoridade administrativa e a recuperacao de administradores devem ser feitas por custom claim emitida fora do cliente. O cliente nao consegue criar, editar ou simular custom claim.
- Integracao server-side futura: um backend de chatbot/WhatsApp devera usar credencial server-side confiavel. Firebase Admin SDK server-side normalmente nao depende das Firestore Rules do cliente, mas isso nao autoriza abrir Rules publicas nem simular identidade de chatbot via navegador.

Nenhum codigo de chatbot, webhook ou WhatsApp foi implementado nesta etapa.

## Perfil do usuario

| Recurso | Usuario ativo | Usuario inativo | Usuario sem perfil | Admin por perfil ativo | Admin por claim |
| --- | --- | --- | --- | --- | --- |
| `users/{uid}` leitura do proprio perfil | Permitido | Permitido | Nao aplicavel ate criar perfil | Permitido | Permitido |
| `users/{uid}` criacao inicial do proprio perfil | Permitido somente com `role=user` e `status=pending` | Nao aplicavel quando perfil ja existe | Permitido somente para o proprio UID | Nao pode autoelevar role/status na criacao | Permitido somente no proprio UID e com `role=user`/`status=pending`, salvo processo server-side externo |
| `users/{uid}` atualizacao propria | Permitido sem alterar `uid`, `email`, `role` ou `status` | Permitido sem alterar campos protegidos | Negado sem documento existente | Permitido como admin se estiver ativo | Permitido como admin para recuperacao |
| `users/{otherUid}` leitura/administracao | Negado | Negado | Negado | Permitido | Permitido |

Observacao: elevacao para `admin`, `owner` ou custom claim continua exigindo processo confiavel fora do cliente. Futuras integracoes, como WhatsApp, devem usar backend confiavel e nunca gravar telefone dentro dos registros financeiros.

## Subcolecoes privadas

| Recurso | Operacao | Usuario ativo dono | Usuario inativo dono | Outro usuario ativo | Admin por claim/perfil |
| --- | --- | --- | --- | --- | --- |
| `users/{uid}/finance_records/{recordId}` | Ler | Permitido | Negado para acesso proprio | Negado | Permitido somente ao acessar dados de outro usuario |
| `users/{uid}/finance_records/{recordId}` | Criar | Permitido com formato valido e `owner_uid` igual ao UID | Negado | Negado | Negado como operacao administrativa |
| `users/{uid}/finance_records/{recordId}` | Atualizar | Permitido com formato valido e dono imutavel | Negado | Negado | Negado como operacao administrativa |
| `users/{uid}/finance_records/{recordId}` | Excluir | Permitido quando `resource.data.owner_uid` e o UID | Negado | Negado | Negado como operacao administrativa |
| `users/{uid}/local_storage/{key}` | Ler | Permitido | Negado | Negado | Apenas do proprio UID se ativo |
| `users/{uid}/local_storage/{key}` | Criar/atualizar | Permitido com chave `finance-control-*` e dono igual ao UID | Negado | Negado | Apenas do proprio UID se ativo |
| `users/{uid}/local_storage/{key}` | Excluir | Permitido quando `resource.data.owner_uid` e o UID | Negado | Negado | Apenas do proprio UID se ativo |
| `users/{uid}/audit_logs/{logId}` | Ler | Permitido | Negado para acesso proprio | Negado | Permitido somente ao acessar dados de outro usuario |
| `users/{uid}/audit_logs/{logId}` | Criar | Permitido quando `actor_uid` e o UID | Negado | Negado | Apenas no proprio UID se `actor_uid` corresponder |
| `users/{uid}/audit_logs/{logId}` | Atualizar | Negado | Negado | Negado | Negado |
| `users/{uid}/audit_logs/{logId}` | Excluir | Negado | Negado | Negado | Negado |
| `users/{uid}/idempotency_receipts/{receiptId}` | Ler | Permitido | Negado | Negado | Negado como acesso amplo |
| `users/{uid}/idempotency_receipts/{receiptId}` | Criar | Permitido somente `processing` valido e `owner_uid` igual ao UID | Negado | Negado | Negado como acesso amplo |
| `users/{uid}/idempotency_receipts/{receiptId}` | Atualizar | Permitido somente `processing -> completed/failed` com identidade imutavel | Negado | Negado | Negado como acesso amplo |
| `users/{uid}/idempotency_receipts/{receiptId}` | Excluir | Negado | Negado | Negado | Negado |

## Colecoes compartilhadas

| Recurso | Operacao | Usuario ativo | Usuario inativo | Usuario sem perfil | Admin por perfil ativo | Admin por claim |
| --- | --- | --- | --- | --- | --- | --- |
| `shared_macros/{docId}` | Ler | Permitido | Negado sem claim | Negado sem claim | Permitido | Permitido |
| `shared_macros/{docId}` | Criar/atualizar/excluir | Negado | Negado sem claim | Negado sem claim | Permitido com formato valido | Permitido com formato valido |
| `shared_categories/{docId}` | Ler | Permitido | Negado sem claim | Negado sem claim | Permitido | Permitido |
| `shared_categories/{docId}` | Criar/atualizar/excluir | Negado | Negado sem claim | Negado sem claim | Permitido com formato valido | Permitido com formato valido |
| `tax_parameters/{parameterId}` | Ler | Permitido | Negado | Negado | Permitido | Permitido somente se tambem possuir perfil ativo |
| `tax_parameters/{parameterId}` | Criar/atualizar/excluir | Negado | Negado | Negado | Permitido com formato valido | Permitido somente se tambem possuir perfil ativo |

## Cobertura automatizada

Arquivo de testes: `tests/firestore/firestore-rules.test.js`

| Grupo | Casos | Cobertura |
| --- | --- | --- |
| Usuario ativo | 01 a 09 | Leitura, escrita, atualizacao, exclusao e auditoria nas subcolecoes proprias |
| Usuario inativo | 10 a 17 | Bloqueio completo em `finance_records`, `local_storage` e `audit_logs` |
| Isolamento entre usuarios | 18 a 24 | Negacao de leitura, escrita, atualizacao, exclusao e auditoria cruzadas |
| Perfil e administracao | 25 a 37 | Usuario sem perfil, criacao inicial segura, bloqueio de autoelevacao e admin por perfil ativo/inativo |
| Autoridade administrativa | 57 a 68 | Claim admin independente, bootstrap/recuperacao, admin/owner por perfil ativo, bloqueio pessoal de inativos e operacoes fora do escopo |
| Colecoes compartilhadas | 38 a 48 | Leitura por usuarios ativos, bloqueio de inativos sem claim e escrita somente por admin |
| Formato e ownership | 49 a 56 | `owner_uid`, `owner_email`, `type`, `amount`, `archived` e `competence` protegidos |
| Idempotency receipts | 99 a 101 | Owner, shape, status, transicoes e isolamento de `users/{uid}/idempotency_receipts` |
| Parametros tributarios | 95 a 98 | Leitura por ativos, bloqueio de pending/inactive, escrita por admin ativo e metadados tributarios em entradas |

## Lacunas

- Criacao de conta com Firebase Auth real nao foi exercitada; os testes simulam `request.auth`.
- UI administrativa com Emulator ainda nao foi automatizada.
- Claims customizadas devem continuar sendo emitidas apenas por backend confiavel; as rules tratam `admin: true` como autoridade administrativa independente para bootstrap e recuperacao.
- Qualquer integracao futura de WhatsApp deve passar por backend server-side confiavel, sem webhook ou chatbot client-side e sem telefone nos registros financeiros.

## Contratos dos registros financeiros

| Area | Decisao |
| --- | --- |
| Owner | `owner_uid` e `owner_email` sao aplicados pelo servico e imutaveis em update. |
| Type | `type` e imutavel em update e validado no cliente e nas Rules. |
| Metadata | `source_channel`, `idempotency_key` e correlatos sao opcionais, tipados e nao concedem autorizacao. |
| Campos proibidos | Telefone, WhatsApp, webhook e chatbot sao rejeitados/limpos pelos contratos e Rules. |
| Usuarios pending/inactive | Continuam bloqueados para comandos financeiros mesmo com payload valido. |
| Integracao futura | Backend confiavel deve reutilizar `src/domain/records`; nenhum contrato paralelo para WhatsApp foi criado. |

## Referencias globais e pessoais

Validado em 18/07/2026:

- `shared_macros` e `shared_categories` aceitam somente `shared_scope=global` e escrita de admin autorizado.
- `users/{uid}/finance_records` aceita `type=macro` e `type=categoria` somente como `shared_scope=personal` para o proprio usuario `active`.
- Usuario comum `active` le globais, mas cria e mantem apenas pessoais.
- `pending`, `inactive` e usuario sem perfil nao leem nem escrevem referencias financeiras.
- Admin por claim continua autoridade confiavel para manutencao global; admin por perfil precisa estar `active`.
- Nenhuma regra usa telefone, canal WhatsApp ou integracao externa como criterio de propriedade.
## Auditoria canonica

`users/{uid}/audit_logs/{logId}` aceita logs legados e `AuditEvent` canonico apenas para usuario ativo no proprio caminho. O formato canonico exige `correlation_id`, `source_channel` permitido, `actor_uid == request.auth.uid`, `owner_uid == request.auth.uid`, `result_status` conhecido e ausencia de campos sensiveis no topo do documento.

Update e delete de audit log sao negados para todos, inclusive admin client-side. Consulta administrativa sobre auditoria deve ser implementada futuramente em backend ou adapter confiavel; no cliente, admin continua limitado pelas Rules e pelo modelo append-only.

## Configuracoes e referencias na UI ativa

A modernizacao da UI de Configuracoes nao altera a matriz de autorizacao. A interface apenas reflete permissoes ja resolvidas pela aplicacao e pelas Rules:

- Usuario comum ativo le referencias globais e mantem somente referencias pessoais.
- Usuario comum nao recebe botao de editar/excluir referencia global.
- Se usuario comum tentar solicitar escopo `global`, a action web rebaixa a operacao para `personal`.
- Admin ativo pode selecionar escopo global pela UI, mas a autorizacao definitiva continua nas Rules e/ou backend confiavel futuro.
- Usuario pending/inactive nao deve acessar a aplicacao financeira nem mutacoes de Configuracoes.

`settingsReadModel` e `settingsPresenter` nao concedem autoridade; `source_channel`, UI state e escopo escolhido no DOM nao substituem autenticacao.

## Administracao de Usuarios na UI ativa

A modernizacao do painel admin nao altera a matriz de autorizacao. `userAdminReadModel` e `userAdminPresenter` apenas refletem permissoes ja resolvidas por perfil/claim:

- `admin: true` continua permitindo bootstrap/recuperacao administrativa, inclusive sem perfil ativo.
- `role=admin` e `role=owner` continuam exigindo `status=active`.
- usuario comum ativo nao recebe painel/acoes administrativas.
- usuario atual nao recebe botoes habilitados para alterar o proprio role/status.
- payload manipulado pelo cliente continua sujeito a `userAdminSdk`, Firestore Rules e backend confiavel futuro.
