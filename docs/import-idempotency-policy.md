# Politica de idempotencia de importacoes financeiras

## Escopo

Esta politica cobre importacoes locais de extratos bancarios e planilhas financeiras. A implementacao canonica fica em `src/application/imports/importBatchUseCases.js` e roda sobre repositorios injetados. Nenhum arquivo bruto, telefone, mensagem externa, webhook, provider, Admin SDK ou dado de producao faz parte deste contrato.

## Fingerprints

`file_fingerprint` e calculado a partir do conteudo canonico parseado, nao do nome do arquivo. O mesmo conteudo com outro nome deve produzir o mesmo fingerprint e o mesmo `batch_id`; qualquer alteracao de conteudo deve produzir outro fingerprint.

`row_fingerprint` identifica a linha financeira:

- quando ha identificador externo, a identidade primaria e `source_reference_id`/`external_id`;
- o fingerprint inclui tambem dados financeiros minimos para rastreabilidade;
- quando nao ha identificador externo, a identidade usa tipo, pessoa, datas, competencia, valor, natureza, descricao, meio de pagamento e categoria normalizados.

`request_fingerprint` identifica o payload normalizado que sera persistido. Mesma identidade de origem com `request_fingerprint` diferente e conflito, nao duplicidade.

Para XLSX, metadados de parser como numero da linha, erros de parser e assinaturas legadas nao entram no payload financeiro nem no `request_fingerprint`. Eles sao usados apenas para preview, rastreabilidade e compatibilidade de deduplicacao com importacoes antigas.

## Estados de candidato

- `ready`: linha valida e ainda nao importada.
- `invalid`: falha no contrato financeiro existente.
- `duplicate_in_file`: mesma identidade e mesmo payload dentro do arquivo atual.
- `already_imported`: receipt idempotente completo encontrado.
- `legacy_match`: assinatura legada ou `source_reference_id` ja existe em registros financeiros.
- `conflict`: mesma identidade/chave com payload diferente.

Somente candidatos `ready` podem ser persistidos por `CommitImportBatch`.

## Commit

`CommitImportBatch` reserva primeiro o batch e depois cada linha `ready` usando `IdempotencyRepository`. A persistencia de registros financeiros usa `financeRecords.createMany` uma unica vez para reduzir risco de lote parcial. Se `createMany` falhar, o caso de uso retorna erro, marca receipts como failed e nao conclui auditoria de sucesso.

O limite atual e `IMPORT_MAX_ATOMIC_ROWS = 100` linhas por lote atomico. Lotes maiores devem ser particionados em etapa futura com checkpoints explicitos.

## Garantias

- Preview nao escreve registros financeiros.
- Replay do mesmo batch retorna `IDEMPOTENT_REPLAY` e nao duplica linhas.
- Mesma chave com payload diferente retorna conflito.
- Receipts nao guardam payload bruto nem arquivo.
- Importacoes continuam usando `source_channel=bank_import` ou `source_channel=spreadsheet_import`; esse campo nao concede permissao e nao altera regras financeiras.
- Importacoes XLSX devem passar por `PrepareImportBatch` e `CommitImportBatch`; a UI nao deve persistir linhas XLSX diretamente com `window.dataSdk.create`.

## UI ativa de importacao - 06/09/2026

A interface ativa de XLSX foi conectada a `ImportController`, `ImportPresenter` e `ImportPreviewReadModel`. O preview apenas transforma os status produzidos por `PrepareImportBatch`; ele nao recalcula fingerprints, nao reinterpreta duplicidade e nao valida contratos financeiros com regra paralela.

O commit continua exclusivo de `CommitImportBatch` e usa candidatos `ready` selecionados. Clique duplo e replay preservam a mesma identidade de batch/idempotencia e nao devem criar linhas duplicadas. Em erro de commit, a UI preserva o preview e retorna estado incerto quando a confirmacao pode ter sido perdida.
