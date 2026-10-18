# Diagnostico de Rules do Controle de Horas

Executado em: 13/09/2026

## Contexto

A etapa 6.4 homologou visualmente cadastro e edicao de Controle de Horas, mas registrou uma lacuna operacional: a persistencia direta de `controle_horas` pelo Firebase Web SDK no Firestore Emulator atingia o limite de avaliacao das Firestore Rules. Para preservar a jornada visual sem alterar Rules naquela etapa, o teste E2E usava um bridge local de persistencia apenas para horas.

Na etapa 6.4A, a lacuna foi tratada diretamente nas Rules e o bridge foi removido.

## Reproducao

O teste focalizado `93A1 usuario ativo cria e edita controle_horas canonico completo com rules ativas` foi adicionado em `tests/firestore/firestore-rules.test.js`.

Payload de criacao:

- caminho: `users/active-user/finance_records/{autoId}`;
- tipo: `controle_horas`;
- owner: `active-user`;
- pessoa: `Jadson`;
- competencia: `2026-06`;
- inicio/fim: `08:00` a `17:00`;
- intervalo: `12:00` a `13:00`;
- `net_minutes=480`;
- `bank_minutes=480`;
- `financial_total=0`;
- metadados: `source_channel=web`, `created_by_type=user`, `created_by_id=active-user`.

Falha reproduzida antes da correcao:

```text
PERMISSION_DENIED:
Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.
```

## Causa

A validacao de `controle_horas` acumulava muitas expressoes opcionais em uma unica regra, e a tentativa inicial de fechar a lista de campos com `keys().hasOnly(...)` aumentou ainda mais o custo de avaliacao.

Esse contrato era caro demais para a avaliacao das Rules no Emulator, principalmente quando combinado com os predicados comuns de usuario ativo, owner, tipo, metadados de origem e os cenarios negativos de update.

## Correcao

`firestore.rules` passou a validar `controle_horas` com um contrato essencial de seguranca e formato:

- usuario ativo e dono continuam exigidos pelas regras de `finance_records`;
- `owner_uid` e `owner_email` continuam obrigatorios pelo contrato comum;
- `owner_uid` e `type` continuam imutaveis no update;
- campos proibidos pessoais, como telefone/WhatsApp, continuam bloqueados pelo contrato comum;
- `type == 'controle_horas'` continua obrigatorio;
- formatos criticos de competencia, data, horarios, booleano de virada de dia, minutos e `quantidadeHoras` continuam validados.

As Rules nao recalculam jornada, saldo, DSR ou valores financeiros. Esses invariantes permanecem no dominio e na UI, conforme `docs/hour-control-policy.md`.

## Bridge de teste removido

Foi removido de `tests/playwright/integration-local-hours.spec.js` o bridge que:

- expunha `window.__e2eCreateHourRecord`;
- expunha `window.__e2eUpdateHourRecord`;
- sobrescrevia `rawSdk.create`;
- sobrescrevia `rawSdk.update`;
- gravava `controle_horas` com `withSecurityRulesDisabled`.

O uso remanescente de `withSecurityRulesDisabled` no arquivo fica restrito ao setup de massa local: perfis de usuario e pessoa de referencia sintetica no Emulator.

## Evidencias focalizadas

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project finance-control-local-test --only firestore "npx.cmd vitest run --config vitest.rules.config.js tests/firestore/firestore-rules.test.js -t 93A1 --reporter=dot"` | Aprovado. `Test Files 1 passed (1)`, `Tests 1 passed | 106 skipped (107)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npm.cmd run test:e2e-local -- tests/playwright/integration-local-hours.spec.js --reporter=line"` | Aprovado. `2 passed (25.6s)`, `Script exited successfully (code 0)`. |

## Observacoes

- Os logs `PERMISSION_DENIED` nos testes de Rules sao esperados nos cenarios negativos.
- O E2E focalizado ainda registrou aviso do Firestore Emulator para colisao em `audit_logs`, sem falhar a jornada. A lacuna de auditoria sem colisao permanece fora do escopo desta correcao.
- Nenhum Firebase de producao, Admin SDK, deploy, push, pull, fetch, webhook, WhatsApp, telefone ou provider externo foi usado.
