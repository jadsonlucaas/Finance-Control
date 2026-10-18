# Diagnostico da UI de Backup/Restore

Executado em: 06/09/2026

## Escopo

Diagnostico da interface local antes da modernizacao incremental de Backup/Restore. Nao houve alteracao de regras financeiras, autenticacao, Firestore Rules, Dashboard, Controle de Horas, Planner, Configuracoes, Administracao, Importacao, tributos, parcelamentos, recorrencias, materializacao percentual, Firebase real, deploy, WhatsApp, webhook, telefone, provider externo ou Admin SDK antes deste diagnostico.

## Estado anterior

- Nao havia tela ativa dedicada para Backup/Restore no shell principal.
- A tela de Configuracoes concentrava operacoes administrativas, importacoes XLSX legadas e historico/arquivamento, mas sem painel visual de backup/restore financeiro.
- A infraestrutura canonica ja existia em `src/application/backup/financeBackupUseCases.js`.
- `npm run backup:dry-run` e `npm run backup:benchmark` exercitavam contratos com massa sintetica e repositorios em memoria.
- Documentos existentes: `backup-restore-policy`, `backup-format-reference`, `backup-versioning-policy`, `restore-conflict-policy` e `disaster-recovery-future-plan`.

## Contratos existentes

- `CreateFinanceBackupSnapshot` lista dados pelo repositorio injetado, filtra owner, sanitiza campos proibidos, calcula checksum e audita resumo.
- `ValidateFinanceBackupSnapshot` valida versao, schema, checksum, tipos conhecidos, duplicidades, referencias orfas e campos proibidos.
- `PrepareFinanceRestore` gera plano somente leitura com estados `new`, `identical`, `conflict`, `incompatible`, `orphaned` e `skipped_operational`.
- `CommitFinanceRestore`, `PrepareFinanceRollback` e `CommitFinanceRollback` existem na camada de aplicacao, mas nao devem ser chamados pela UI cliente nesta etapa.

## Mapa operacional

| Ponto | Estado anterior |
| --- | --- |
| Quem abre a UI | Nao havia entrada visual dedicada; Configuracoes era o local natural para operacoes administrativas locais. |
| Quem monta backup | `CreateFinanceBackupSnapshot`. |
| Quem busca registros | Repositorio `financeRecords.list` e `localSettings.list` injetados. |
| UI acessa `dataSdk` | Nao havia UI ativa de backup; risco futuro seria ler direto de `window.dataSdk`. |
| UI acessa Firebase | Nao havia UI ativa; contrato exige repositorios injetados. |
| Uso de `window.financeApp` | Apenas composition root/adapters web podem ler dependencias da aplicacao. |
| JSON/arquivo | Snapshot canonico contem versao, owner reference, contagens, checksum, colecoes sanitizadas e metadados. |
| Download | Nao havia adapter visual dedicado. |
| Versionamento | `FINANCE_BACKUP_VERSION=1.0.0`, `FINANCE_BACKUP_SCHEMA_VERSION=1`, legado `0.9.0` migrado em memoria. |
| Checksum | `buildBackupChecksum` com payload canonico. |
| Restore file | Validacao por `ValidateFinanceBackupSnapshot`; sem parser visual unico anterior. |
| Conflitos | `PrepareFinanceRestore` classifica pelo contrato canonico. |
| Write real no restore | Caso de uso existe, mas deve permanecer fora da UI cliente. |
| Auditoria | Eventos `BACKUP_CREATED`, `RESTORE_PREPARED`, `RESTORE_FAILED`, `RESTORE_COMMITTED` existentes no dominio. UI nao deve auditar payload completo. |
| Globais/scripts | Nenhuma API global top-level especifica de backup/restore alem das bridges existentes de historico/PDF. |

## Dados sensiveis

Nao devem entrar no backup: senha, tokens, authorization, cookies, chaves privadas, service accounts, telefone, WhatsApp, payload bruto, arquivos bancarios/XLSX brutos, bytes de arquivo, credenciais e segredos.

Podem entrar no backup pessoal: `finance_records`, referencias pessoais, configuracoes locais, regras percentuais, historico salarial, controle de horas e metadados minimos do snapshot.

Ficam fora do restore comum: auditoria, receipts de idempotencia, import batches operacionais, referencias globais e parametros tributarios globais.

## Riscos e caminho seguro

- Criar botao de restore real no cliente poderia executar escrita destrutiva fora de backend confiavel.
- Expor UID/email no nome do arquivo aumentaria risco de vazamento local.
- Validar JSON em varios pontos criaria divergencia de regra.
- Troca de usuario deve limpar preview, arquivo e plano em memoria.
- O caminho seguro e criar read models puros, controller/presenter com dependencias injetadas, download adapter isolado e guard estrutural impedindo restore real na UI.
