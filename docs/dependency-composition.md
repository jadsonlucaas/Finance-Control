# Composicao de dependencias

`src/application/dependencies/createApplicationDependencies.js` e o ponto unico de composicao da camada de aplicacao.

## Web local

O runtime web usa:

```js
createApplicationDependencies({
  mode: 'web',
  target: window,
  financeRecordDataSdk: FinanceRepository
});
```

Isso monta:

- `FirebaseFinanceRecordRepository`
- `FirebaseUserProfileRepository`
- `FirebaseSharedReferenceRepository`
- `FirebaseLocalSettingsRepository`
- `FirebaseAuditRepository`
- subscription via adapter de finance records

O `FinanceRepository` continua sendo ligado ao `dataSdk` por `installFirebaseServicesWhenReady()`. Assim, o piloto web de `CreateExpense` segue para persistencia real local/web via adapter Firebase Web e nao para in-memory.

## Testes

Testes usam explicitamente:

```js
createApplicationDependencies({ mode: 'test' });
```

ou injetam `repositories` diretamente. O modo `test` cria implementacoes in-memory deterministicas. O modo `web` exige `financeRecordDataSdk`; se faltar, a inicializacao falha explicitamente.

## Futuro backend

Backend futuro deve montar outro container com implementacoes server-side das mesmas interfaces. Essa etapa nao cria backend, Admin SDK, webhook, WhatsApp, telefone ou permissao publica.
