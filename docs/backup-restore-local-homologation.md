# Homologacao local de Backup e Restore Dry-run

Executado em: 18/09/2026

## Escopo

Esta etapa homologou o fluxo de Backup e Restore Dry-run no ambiente local, usando Vite, Auth Emulator e Firestore Emulator. Nenhum Firebase real, deploy, push, pull, fetch, Admin SDK, webhook, WhatsApp, telefone ou provider externo foi usado.

Endereco local usado pela suite emulada: `http://127.0.0.1:5178`.

Projeto emulado: `demo-finance-control-local-e2e`.

## Arquivos principais

- `tests/playwright/integration-local-backup-restore.spec.js`
- `src/application/backup/financeBackupUseCases.js`
- `tests/application/backup/financeBackupUseCases.test.js`
- `playwright.e2e-local.config.js`

## Massa local

A massa E2E foi criada exclusivamente no Firestore Emulator, via fixture minima, para cobrir:

- 1 entrada
- 1 saida comum
- 1 parcelamento com parcelas
- 1 recorrencia mensal
- 1 controle de horas
- referencias pessoais
- dados de outro usuario para prova de isolamento

O caminho funcional real da UI foi usado para:

- gerar preview de backup;
- baixar o JSON pelo navegador;
- carregar o arquivo baixado no input de restore;
- validar o arquivo;
- executar dry-run;
- comprovar que restore real permanece indisponivel.

## Descoberta corrigida

Durante a homologacao, o snapshot principal ja removia campos sensiveis dos registros financeiros, mas o cache JSON armazenado em `local_settings` podia reintroduzir esses campos dentro de uma string serializada.

Correcao aplicada: `local_settings` que contenham JSON em string agora sao desserializadas, sanitizadas com a mesma politica de backup e serializadas novamente antes de entrar no snapshot. Isso nao altera versao, schema, checksum canonico, Firestore Rules, regras financeiras, UI ou restore real.

## Cobertura adicionada

### Playwright local emulado

`tests/playwright/integration-local-backup-restore.spec.js`

1. Gera backup na UI para usuario A.
2. Baixa snapshot real pelo navegador.
3. Valida `backup_version=1.0.0`, `schema_version=1`, checksum canonico e owner reference.
4. Confirma que dados do usuario B nao aparecem no snapshot.
5. Confirma que segredos de fixture nao aparecem no snapshot, inclusive quando estavam no cache local.
6. Recarrega a pagina, envia o mesmo snapshot e executa dry-run.
7. Confirma `wrote=false`, `wouldCreate=0` e registros financeiros identicos antes/depois.
8. Confirma que o botao de restore real segue desabilitado e que `restoreRealUnavailable()` retorna `RESTORE_REAL_UNAVAILABLE`.
9. Troca A -> B -> A e valida isolamento de preview, restore e registros.
10. Valida snapshot adulterado com versao invalida e checksum divergente, sem mutacao financeira.

### Vitest

`tests/application/backup/financeBackupUseCases.test.js`

- Adicionado teste para garantir que payloads JSON armazenados em `local_settings` sejam sanitizados antes da exportacao.

## Lacunas

- Restore real permanece bloqueado na UI client-side.
- Commit de restore, rollback operacional e snapshot pre-restore confiavel devem esperar backend confiavel/futuro.
- A fixture E2E prepara dados por Emulator para focar a homologacao de backup/restore; criacao visual completa de todos os dominios continua coberta pelos specs dedicados ou por lotes futuros.

## Resultado focado

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- tests/application/backup/financeBackupUseCases.test.js` | Aprovado. `Test Files 1 passed (1)`, `Tests 74 passed (74)`. |
| `npx.cmd firebase emulators:exec --only auth,firestore --project demo-finance-control-local-e2e "npx.cmd playwright test tests/playwright/integration-local-backup-restore.spec.js --config=playwright.e2e-local.config.js"` | Aprovado. `2 passed (22.1s)`, `Script exited successfully (code 0)`. |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test --config=playwright.e2e-local.config.js --reporter=line"` | Suite local emulada completa aprovada. `10 passed (1.3m)`, `Script exited successfully (code 0)`. |

## Confirmacao

- Nenhum dado real foi criado, editado ou excluido.
- Nenhum deploy foi executado.
- Nenhum commit foi enviado ao GitHub.
- Nenhuma regra financeira foi alterada.
- Nenhuma interface foi alterada.
- Nenhuma Firestore Rule foi alterada.
- Restore real nao foi habilitado.
