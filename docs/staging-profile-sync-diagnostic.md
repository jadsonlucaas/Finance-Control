# Diagnostico de sincronizacao do perfil active no staging

Executado em: 17/10/2026

## Sintoma

O Playwright classificou o usuario A como `pending` porque observou o titulo inicial `Aguardando aprovacao` antes de o Firebase Auth concluir o login e antes de `applyAuthState` carregar `users/{uid}`.

## Evidencia comparativa

- Projeto: `finance-control-staging-260919`.
- UID A: `8vVGElnbhiQd7TcWtJ84KXSKXc92`.
- Path consultado pelo app e pela verificacao operacional: `users/8vVGElnbhiQd7TcWtJ84KXSKXc92`.
- Firestore direto: `role=user`, `status=active`.
- Perfil retornado por `window.userAdminSdk.getProfile`: `role=user`, `status=active`.
- `window.financeApp.authContext`: mesmo UID, `role=user`, `accountStatus=active`.
- View final depois da sincronizacao: aplicacao visivel.
- ProjectId runtime: `finance-control-staging-260919`.
- Requests para `finance-control-cce4f`: zero.

## Causa raiz

A causa estava no harness de staging. A espera considerava a visibilidade do aviso de acesso, cujo texto inicial permanece no DOM, como estado final. Na captura prematura, `window.authSdk.getCurrentUser()` ainda era `null`, `profile` ainda era `null` e `financeApp.authContext.accountStatus` continha o fallback defensivo `pending` usado durante inicializacao.

Nao houve leitura de documento errado, cache antigo, listener stale, normalizacao incorreta, alteracao de Rules ou perda do status persistido.

## Fluxo real

1. `subscribeAuthState` em `src/services/installFirebaseServices.js` publica `authStateChanged`.
2. `applyAuthState` em `src/legacy/inline/part-28.js` recebe o usuario.
3. `createUserAdminService.ensureProfile` em `src/services/userAdmin.js` le `users/{uid}`.
4. O perfil e normalizado pelo dominio de ciclo de conta.
5. `syncFinanceAuthContext` publica UID, role e status.
6. A UI libera a aplicacao apenas para `active`.

## Correcao

O helper Playwright agora espera, nesta ordem, o UID em `authSdk.getCurrentUser()`, o mesmo UID e perfil em `financeApp.authContext`, e somente depois avalia a view. Nao foram adicionados retry, `waitForTimeout`, timeout maior ou relaxamento de autorizacao.

## Regressao e seguranca

- Login A focado: perfil `active` e app visivel.
- A -> B -> A e reload: aprovados no teste critico focado.
- Pending/inactive continuam protegidos pelas Rules e foram validados anteriormente pela UI e novamente por Auth/Firestore.
- Nenhuma Firestore Rule foi alterada.
- Nenhum Admin SDK, custom claim, billing ou Identity Platform upgrade foi usado.
- Nenhum dado real ou acesso a producao ocorreu.

## Decisao

O falso diagnostico de `pending` para A foi resolvido no harness. A etapa completa continua `STAGING NOT VALIDATED` enquanto os fluxos ampliados de staging nao estiverem integralmente verdes.
# Atualização 7.3F — lifecycle estabilizado e novo bloqueio funcional

O timeout entre contas `pending` e `inactive` era causado pelo harness: o logout era considerado concluído apenas pela mudança visual, antes de Firebase Auth, `financeApp.authContext`, profile e subscriptions/cache terminarem a limpeza. O helper passou a aguardar esses estados canônicos e a distinguir as telas finais de `active`, `pending` e `inactive`.

Foram obtidas três execuções sequenciais verdes da suíte focada (5/5 em cada rodada), sem retry, sem aumento de timeout e sem requests para `finance-control-cce4f`. Os fluxos A -> B -> A, reload active/pending/inactive e pending <-> inactive ficaram determinísticos.

A continuação da suíte encontrou um bloqueio funcional separado no backup real de staging. O snapshot gerado pela UI apresentou `checksumValid=true`, versão `1.0.0` e owner válido, mas sua própria revalidação falhou com seis erros `ORPHAN_REFERENCE`: parcelas criadas pela UI mantêm `parent_id` no formato `p_*`, porém o snapshot não contém o registro-pai correspondente. Por isso upload/validation não chega ao restore dry-run. Nenhum restore real foi executado.

Decisão: `STAGING NOT VALIDATED`. O runtime não foi alterado nesta etapa; o problema de integridade entre parcelamento e backup requer diagnóstico/correção próprios.
