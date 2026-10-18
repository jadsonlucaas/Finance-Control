# Ciclo de contas

Gerado em: 2026-07-18

## Proposito

Este documento registra o ciclo de aprovacao de contas do Finance-Control-New. O objetivo e impedir que uma conta autenticada acesse dados financeiros antes de aprovacao administrativa, preservar contas existentes ativas e manter uma trilha de auditoria das alteracoes feitas por administradores.

## Estados validos

| Estado | Significado | Acesso financeiro |
| --- | --- | --- |
| `pending` | Conta criada e aguardando aprovacao. | Bloqueado |
| `active` | Conta liberada para uso normal. | Permitido |
| `inactive` | Conta bloqueada administrativamente. | Bloqueado |

## Transicoes permitidas

| Origem | Destino | Responsavel |
| --- | --- | --- |
| sem perfil | `pending` | Cliente autenticado criando o proprio perfil inicial |
| `pending` | `active` | Admin por custom claim ou admin/owner por perfil ativo |
| `pending` | `inactive` | Admin por custom claim ou admin/owner por perfil ativo |
| `active` | `inactive` | Admin por custom claim ou admin/owner por perfil ativo |
| `inactive` | `active` | Admin por custom claim ou admin/owner por perfil ativo |

## Transicoes proibidas

| Origem | Destino | Motivo |
| --- | --- | --- |
| sem perfil | `active` | Conta nova deve aguardar aprovacao |
| sem perfil | `inactive` | Conta nova deve aguardar aprovacao |
| sem perfil | `admin`/`owner` | Cliente nao pode autoelevar privilegio |
| `inactive` | `pending` | Reativacao deve voltar para `active` ou permanecer `inactive` |
| qualquer | role/status proprio alterado pelo usuario comum | Campos protegidos |

## Firestore Rules

- `users/{uid}` pode ser criado pelo proprio usuario apenas com `role=user` e `status=pending`.
- Usuario comum pode ler o proprio perfil, mas nao pode alterar `uid`, `email`, `role` ou `status`.
- `finance_records`, `local_storage` e `audit_logs` proprios exigem perfil `active`.
- `pending`, `inactive` e usuario sem perfil nao acessam dados financeiros.
- Admin por custom claim `admin: true` pode administrar perfis mesmo sem perfil Firestore.
- Admin/owner por perfil so administra quando o proprio perfil esta `active`.

## Frontend

- `applyAuthState` esconde o app financeiro enquanto carrega claims e perfil.
- `pending` exibe aviso de aguardando aprovacao, botao de verificar status e botao sair.
- `inactive` exibe aviso de conta desativada, botao de verificar status e botao sair.
- `active` exibe o app financeiro somente depois da validacao de perfil.
- Painel admin lista `pending`, `active` e `inactive` separadamente, com acoes Aprovar, Desativar e Reativar.
- O usuario atual nao recebe botoes habilitados para alterar o proprio role/status.

## Criacao inicial e compatibilidade

Novas contas criadas no cliente recebem `role=user` e `status=pending`. Contas existentes com `status=active` permanecem ativas depois de `ensureProfile`. Perfis antigos sem status sao normalizados como `active` no servico para preservar compatibilidade.

## Conta sem perfil

Conta autenticada sem perfil e tratada como `pending` para decisao de acesso. Sem perfil ativo, nao ha acesso a subcolecoes financeiras.

## Autoridade administrativa

Custom claim `admin: true` e a autoridade confiavel para bootstrap e recuperacao. Role `admin` e role `owner` em `users/{uid}` tambem administram, mas somente quando o perfil do admin esta `active`.

## Bloqueio, cache e estado

Ao bloquear `pending` ou `inactive`, o frontend chama limpeza de dados financeiros, zera `allRecords`, preserva o app oculto e impede inicializacao prematura do `dataSdk`.

## Auditoria

`userAdmin.updateUser` registra auditoria depois do update concluido:

- `admin.user_approve`
- `admin.user_deactivate`
- `admin.user_reactivate`
- `admin.user_role_change`

O log contem alvo, role/status anterior e posterior, campos alterados e contexto `source=web_admin`. O actor e preenchido pelo `auditService` a partir do usuario autenticado.

## Recuperacao administrativa

Um admin com custom claim pode recuperar perfis mesmo sem perfil proprio ativo. Essa autoridade nao libera acesso pessoal aos proprios dados financeiros se o usuario estiver `inactive` ou sem perfil.

## Tratamento de falhas

- Falha ao carregar perfil mantem app oculto, limpa estado financeiro e mostra erro.
- Falha ao atualizar status/role no painel admin restaura botoes e preserva estado visual anterior.
- Falha no update administrativo nao gera audit de sucesso.
- Falha de auditoria apos update e propagada ao chamador, tornando o resultado observavel.

## Testes correspondentes

- Rules: `tests/firestore/firestore-rules.test.js`
- Auth + Firestore Emulator: `tests/auth-flow/account-lifecycle-auth-flow.test.js`
- Servico/auditoria: `tests/regression/high-risk-regression.test.js`
- UI local: `tests/playwright/regression-local.spec.js`

## Lacunas remanescentes

- UI admin completa conectada ao Auth/Firestore Emulator real ainda depende de uma etapa dedicada.
- Emissao real de custom claims por Admin SDK local nao foi implementada.
- Fluxos visuais de cadastro/login com Firebase Auth Emulator no browser ainda podem ser ampliados.

## Preparacao para integracao futura

- Somente contas `active` poderao futuramente vincular identidade externa.
- `pending` e `inactive` nao poderao executar comandos financeiros.
- Telefone nao sera usado como uid.
- A identidade externa ficara separada do perfil financeiro.
- Nenhum chatbot, webhook, telefone ou Admin SDK foi implementado nesta etapa.

## Modernizacao do painel administrativo - 05/09/2026

A Administracao de Usuarios ganhou uma camada moderna local em `src/application/readModels/userAdminReadModel.js`, `src/application/userAdmin/userAdminPermissions.js` e `src/ui/admin/*`. A UI preserva as bridges globais existentes e continua delegando mutacoes para `userAdminSdk.updateUser`.

`financeApp.authContext` passa a expor o contexto de sessao ja resolvido pelo fluxo legado para composicao da UI moderna, sem criar nova API global. A autoridade definitiva continua sendo a Politica A: claim admin confiavel independente, admin/owner por perfil somente quando ativo, e usuario inativo bloqueado para acesso pessoal.
