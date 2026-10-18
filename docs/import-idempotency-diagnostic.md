# Diagnostico de Idempotencia de Importacoes

Executado em: 22/08/2026

## Fluxo Atual

- Importacao bancaria fica em `src/ui/importacao.js`.
- Bancaria suporta CSV Bradesco, Mercado Pago, Banco Inter, CSV padrao e PDF Itau.
- O arquivo bancario e lido no navegador; CSV usa `file.text()` e PDF usa PDF.js.
- O preview bancario existe antes da gravacao, com classificacao de debito/credito, sugestao de categoria, transferencia interna, duplicidade e status visual.
- O commit bancario grava uma saida por linha pronta chamando `target.dataSdk.create(payload)` em loop.
- XLSX de saidas e entradas ainda fica em `src/legacy/inline/part-03.js` para leitura do arquivo, DOM e feedback visual.
- XLSX usa `window.XLSX.read`, mas delega parse canonico para `src/application/imports/spreadsheetImportParser.js`.
- XLSX delega preview/commit para `PrepareImportBatch` e `CommitImportBatch` via `window.financeApp.importPipeline`.
- XLSX possui `import_source`, `source_channel=spreadsheet_import`, `import_signature`, `import_core_signature`, `source_reference_id`, `idempotency_key`, `correlation_id` e relatorio de prontas/invalidas/duplicadas/conflitos/capacidade.

## Riscos

- Bancaria grava linha a linha; falha no meio pode gerar lote parcial.
- Bancaria gera `batchId` com `Date.now()`, entao o mesmo arquivo reprocessado nao tem identidade de lote estavel.
- Bancaria detecta duplicidade por assinatura legada contra registros existentes, nao por receipt persistente.
- XLSX mantem `forceImport` apenas para bypass do limite visual de capacidade; idempotencia, duplicidade e conflitos continuam sendo respeitados pelo pipeline.
- XLSX deduplica contra registros existentes, receipts e assinaturas legadas antes do commit.
- XLSX persiste candidatos prontos via `financeRecords.createMany`, sem loop de `window.dataSdk.create` no fluxo de importacao XLSX.
- Protecoes contra clique duplicado sao principalmente visuais (`button.disabled`) e nao substituem idempotencia persistente.
- UI de importacao ainda conhece DOM, parser e persistencia no mesmo fluxo.

## Duplicidades Possiveis

- Mesmo arquivo bancario importado duas vezes com nome igual ou diferente.
- Duas linhas iguais dentro do arquivo bancario.
- Mesmo XLSX reprocessado em outra aba.
- Mesmo arquivo XLSX com nome diferente.
- Linha ja importada por assinatura legada, mas sem receipt.
- Retry apos falha de rede depois de alguma escrita.

## Falsos Positivos

- Assinaturas baseadas em data, descricao normalizada e valor podem colidir transacoes distintas do mesmo dia.
- Descricoes bancarias cosmeticamente iguais podem representar movimentos diferentes se nao houver ID externo.
- XLSX usa campos financeiros amplos, reduzindo falsos positivos, mas pode perder identidade externa quando a planilha nao tem ID confiavel.

## Falhas Parciais

- Bancaria: cada linha chama `dataSdk.create` separadamente.
- XLSX: `CommitImportBatch` usa uma chamada `createMany` para candidatos `ready` ate `IMPORT_MAX_ATOMIC_ROWS`.
- Nao ha receipt master de batch que represente progresso final.
- Nao ha subcolecao `import_batches`.

## Politica Proposta

- Criar `ImportBatch` em memoria para preview e commit.
- Criar `ImportCandidate` por linha.
- Calcular fingerprint de arquivo por conteudo canonico.
- Calcular fingerprint de linha por identidade financeira.
- Usar `IdempotencyRepository` para batch e linhas.
- Commit deve persistir apenas linhas `ready`.
- Nesta etapa, limitar lote a tamanho seguro e usar `createMany` unico para evitar chunk parcial.
- `import_batch_id`, `import_signature`, `source_channel`, `source_reference_id`, `idempotency_key` e `correlation_id` devem ser propagados aos registros criados.

## Compatibilidade

- Registros legados com `import_signature`, `import_core_signature` e `import_batch_id` continuam sendo usados para detectar `legacy_match`.
- Nenhum dado legado sera alterado retroativamente.
- Importacoes bancarias continuam criando apenas `saida`.
- Importacoes XLSX continuam usando os mesmos campos financeiros normalizados.
- Futuro backend externo pode reutilizar a mesma ideia de ID externo como `source_reference_id`/`idempotency_key`, sem regra exclusiva de canal.

## Resultado da migracao XLSX local

Executado em: 22/08/2026

- Parser XLSX canonico criado em `src/application/imports/spreadsheetImportParser.js`.
- Runtime local do pipeline exposto por `window.financeApp.importPipeline`.
- UI legada de XLSX deixou de chamar `window.dataSdk.create` para persistir linhas importadas.
- Preview XLSX mostra linhas prontas, duplicadas/ja importadas, invalidas, conflitos e limite de capacidade.
- `source_channel=spreadsheet_import` e aplicado aos registros criados por planilha.
- Assinaturas legadas de XLSX continuam reconhecidas para evitar recriacao de registros antigos.
- Dry-run local `npm run import:xlsx-dry-run` cobre mesmo conteudo com outro nome, conteudo alterado, duplicidade interna, linha invalida, registro legado ja importado e conflito de receipt.
- Nenhum arquivo bruto, webhook, telefone, WhatsApp, Admin SDK, Firebase real ou deploy foi usado nesta etapa.

## Resultado da validacao local

Executado em: 22/08/2026

- `npm.cmd run inventory:globals`: aprovado, 58 APIs globais inventariadas.
- `npm.cmd test`: aprovado, 63 arquivos de teste e 324 testes.
- `npm.cmd run build`: aprovado.
- `npm.cmd run smoke`: aprovado, `status=ok`, URL local `http://127.0.0.1:5175/`.
- `npm.cmd run import:dry-run`: aprovado, sem Firebase real.
- `npm.cmd run import:xlsx-dry-run`: aprovado, `source_channel=spreadsheet_import`, `wrote=false`, 5 registros simulados em memoria.
- `npx.cmd firebase emulators:exec --only firestore "npm.cmd run test:rules -- --reporter=dot"`: aprovado em tres execucoes validas com Firestore Emulator; resumo observado de 2 arquivos e 105 testes aprovados.
- `npx.cmd playwright test`: aprovado, 25 testes.
- Deploy, push, pull, fetch, PR, Firebase real, WhatsApp, webhook, telefone, provider externo e Admin SDK: nao executados.

## Rollback

- O pipeline novo pode ser desabilitado mantendo os fluxos legados.
- Receipts de importacao ficam isolados em `idempotency_receipts`.
- Nenhum arquivo bruto e persistido.
- Nenhuma reversao destrutiva sera implementada nesta etapa.
