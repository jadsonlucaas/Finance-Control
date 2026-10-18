# Politica de Backup e Recuperacao Segura

Data: 2026-08-23

## Objetivo

Criar uma camada local e testavel para gerar snapshots financeiros, validar arquivos antes de restaurar e preparar restores sem tocar Firebase real nesta etapa.

## Escopo recuperavel

Entram no `FinanceBackupSnapshot`:

- `finance_records` do owner autenticado/confiavel.
- `personal_references` derivadas de registros pessoais.
- `local_settings` proprias para visualizacao e diagnostico.
- `percentage_rules`, `salary_history` e `hour_entries` proprios.
- Metadados minimos de versao, origem, correlacao, contagens e checksum.

Ficam fora do restore financeiro automatico:

- `audit_logs`.
- `idempotency_receipts`.
- lotes/import batches operacionais.
- referencias globais e parametros tributarios globais.
- caches, dados derivados regeneraveis e snapshots de UI.

## Dados sensiveis proibidos

Backup nao deve exportar credenciais, tokens, cookies, authorization, private keys, service accounts, telefone, WhatsApp, payload bruto, arquivo bancario bruto, XLSX bruto ou bytes de arquivo.

Campos removidos geram warning generico, sem vazar o nome do campo sensivel nem o valor original.

## Restauracao

O restore e dividido em duas etapas:

1. `PrepareFinanceRestore`: valida snapshot, checksum, versao e conflitos, e gera plano sem escrita.
2. `CommitFinanceRestore`: cria snapshot pre-restore e persiste somente itens `new`, bloqueando `conflict`, `incompatible` e `orphaned`.

Itens `identical` nao sao duplicados. `local_settings` ficam visiveis no plano como dados pulados por politica e nao sao gravadas como lancamentos financeiros.

## Rollback

Rollback usa o snapshot pre-restore para remover apenas registros criados pela correlacao do restore e reconstruir o estado anterior permitido pelo mesmo contrato. Ele nao apaga dados externos criados por outro fluxo.

## Garantias

- Nenhuma regra financeira e recalculada pelo backup.
- Nenhuma interface foi alterada.
- Nenhum Firebase real, deploy, push, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi implementado.
- Auditoria registra somente resumo, checksum truncado, contagens agregadas e correlacao.

## UI ativa local

Atualizacao em: 2026-09-08

A tela de Configuracoes passa a carregar `src/ui/backup/loadBackupActiveUi.js` sob demanda. A interface adicionada e somente uma camada de preview, download, validacao e restore dry-run. Ela nao executa restore real, nao escreve dados e nao altera regras financeiras.

O controller da UI usa apenas `CreateFinanceBackupSnapshot`, `ValidateFinanceBackupSnapshot` e `PrepareFinanceRestore`, com repositorios e contexto injetados. `CommitFinanceRestore` e rollback continuam fora da interface.

O restore real permanece bloqueado por politica ate existir backend confiavel, autorizacao operacional explicita, auditoria server-side e validacao com Firebase Emulator. O modo disponivel no navegador e dry-run com `wrote=false`.
