# Diagnóstico do fluxo Auth → perfil

Issue: #23
Data: 02/11/2026

## Causa raiz

O Firebase Auth concluía o `signInWithEmailAndPassword`, mas `applyAuthState()`
executava claims e Firestore dentro do mesmo `try/catch`. Qualquer falha posterior
era apresentada como falha genérica de perfil, sem distinguir quota, serviço,
permissão, sessão ou claims. O perfil existente também disparava `setDoc` de
`email`, `updated_at` e `last_login_at` em todo login.

## Correção

- `authSdk.signIn` registra sucesso/falha apenas da autenticação.
- `authSdk.loadProfileAccess` coordena claims e perfil com erros normalizados.
- `financeApp.authContext` expõe `authenticationState`, `authenticated`,
  `profileState` e `accessState`.
- o app financeiro permanece oculto até perfil `active`.
- `pending` e `inactive` continuam usando a decisão de `accountLifecycle`.
- falhas pós-login mantêm a sessão e exibem retry manual.
- o retry reutiliza a sessão, chama claims + `getProfile`, não chama `signIn`,
  não cria perfil e não altera status.
- `last_login_at` virou best-effort; `updated_at` não é mais alterado no login e
  `email` só é enviado quando mudou.

## Observabilidade

Eventos sanitizados: `auth.sign_in.success`, `auth.sign_in.failure`,
`profile.load.start`, `profile.load.success`,
`profile.load.resource_exhausted`, `profile.load.permission_denied`,
`profile.load.unavailable`, `profile.load.failure`, `profile.retry`,
`profile.retry.success` e `profile.retry.failure`. Contexto limitado a operação,
estado autenticado, código de erro e status de conta; sem senha, token, claims,
perfil ou dados financeiros.

## Segurança, risco e rollback

Rules, indexes e autorização não foram alterados. O principal risco é uma falha
transitória manter a tela de acesso aberta; o estado financeiro continua limpo e
fechado. Rollback: reverter o commit da Issue #23. Nenhuma migração de dados é
necessária.
