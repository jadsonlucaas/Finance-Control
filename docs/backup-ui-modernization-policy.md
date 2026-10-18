# Politica de Modernizacao da UI de Backup e Restore

Data: 2026-09-08

## Escopo desta etapa

A interface ativa de Backup e Restore em Configuracoes passa a oferecer:

- preview de backup por usuario autenticado;
- resumo por colecao, total de registros, versao, checksum e owner anonimizado;
- download JSON por adapter isolado;
- upload de snapshot para validacao;
- preview de restore em modo dry-run;
- classificacao visual de novos itens, conflitos, invalidos, ignorados e warnings.

Restore real permanece indisponivel na UI. O botao de restauracao real e mantido desabilitado e informa que a execucao exige backend confiavel futuro.

## Guardrails

- A UI nao chama Firebase, `dataSdk`, `CommitFinanceRestore`, rollback ou metodos de escrita diretamente.
- A UI consome somente casos de uso por dependencias injetadas: `CreateFinanceBackupSnapshot`, `ValidateFinanceBackupSnapshot` e `PrepareFinanceRestore`.
- O arquivo de backup nao deve incluir senha, token, cookies, authorization, private key, service account, telefone, WhatsApp, payload bruto, arquivo original ou bytes de arquivo.
- Nome de arquivo gerado pelo adapter nao inclui UID, email, telefone ou WhatsApp.
- Troca de owner limpa previews anteriores antes de montar novo estado.
- `source_channel` e metadado e nao concede permissao.

## Fronteira tecnica

- Read models puros: `src/application/readModels/backupPreviewReadModel.js` e `src/application/readModels/restorePreviewReadModel.js`.
- Controller: `src/ui/backup/backupController.js`, com dependencias injetadas e sem acesso direto a DOM/Firebase.
- Presenter: `src/ui/backup/backupPresenter.js`, responsavel por DOM e mensagens seguras.
- Adapter de download: `src/ui/backup/backupDownloadAdapter.js`, responsavel apenas por Blob, URL e clique de download.
- Loader lazy: `src/ui/backup/loadBackupActiveUi.js`, acionado pela rota de Configuracoes.

## Validacao

Esta etapa deve continuar passando por `npm run backup-ui-modernization:check`, `npm run bundle:budget`, testes unitarios, Playwright local, smoke e scripts de dry-run. Nenhum teste ou script desta etapa deve tocar Firebase real, publicar deploy, criar webhook, usar WhatsApp, telefone, provider externo ou Admin SDK.
