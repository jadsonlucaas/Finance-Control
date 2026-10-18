# Diagnostico da UI ativa de importacao

Executado em: 06/09/2026

Escopo: interface local de importacao financeira. Nao houve alteracao de regras financeiras, parser, fingerprint, autenticacao, Firestore Rules, Dashboard, Controle de Horas, Planner, Configuracoes, Administracao, backup/restore, tributos, parcelamentos, recorrencias, WhatsApp, webhook, telefone, provider externo ou Admin SDK antes deste diagnostico.

## Estado anterior

| Ponto | Estado encontrado | Risco |
| --- | --- | --- |
| Quem abre a tela | `switchTab('importacao')` mostra `#view-importacao`; `part-08.js` chama `renderImportacao()` ao trocar para a aba | Bridge global precisa continuar disponivel |
| Quem le arquivo bancario | `src/ui/importacao.js` acessa `#import-file-input`, `file.text()` e PDF.js sob demanda | DOM e parsing ficam acoplados no mesmo arquivo |
| Quem chama XLSX | `src/legacy/inline/part-03.js` usa `ensureSpreadsheetLibrary()` e `window.XLSX.read` somente quando o usuario importa planilha | XLSX esta sob demanda, mas o fluxo ainda e legado |
| Quem parseia XLSX | `window.financeApp.importPipeline.parseSpreadsheetImport`, implementado em `src/application/imports/spreadsheetImportParser.js` | Parser canonico ja existe |
| Quem normaliza XLSX | `parseSpreadsheetImport` mapeia saidas/entradas e retorna `parser_errors` sem escrever | Correto; nao deve ser duplicado na UI |
| Quem faz fingerprint | `PrepareImportBatch` em `src/application/imports/importBatchUseCases.js` | Correto; nao deve ser recalculado na UI |
| Quem deduplica | `PrepareImportBatch` classifica `duplicate_in_file`, `already_imported`, `legacy_match` e `conflict` | Correto; UI deve apenas apresentar |
| Quem monta preview XLSX | `part-03.js` cria relatorios `lastImportReport`/`lastEntradasImportReport` a partir dos candidatos | Preview legado nao separa todos os estados como read model puro |
| Quem persiste XLSX | `CommitImportBatch` via `window.financeApp.importPipeline.commitPreparedImport` | Persistencia canonica usa `createMany` |
| Loop create por linha | No commit canonico nao ha loop de `create`; `CommitImportBatch` usa `financeRecords.createMany` apos reservar receipts | Caminho correto deve ser preservado |
| UI chama dataSdk | `src/ui/importacao.js` chama `target.dataSdk.delete` para remover historico importado | Fora do caminho moderno de preview/commit; remocao permanece legado |
| UI chama Firebase direto | Nao ha import direto do Firebase na UI de importacao | Baixo |
| UI usa `window.financeApp` | `part-03.js` usa `window.financeApp.importPipeline`; `src/ui/importacao.js` le `financeApp.authContext` e repositorios por runtime | Deve ser injetado no controller moderno |
| Globais | `renderImportacao` e `financeApp.importPipeline` sao bridges existentes | Nao adicionar globais |
| Scripts classicos | `part-03.js` mantem XLSX; `part-08.js` chama `renderImportacao` ao navegar | Nao remover nesta etapa |
| Tratamento de erro | Legado limpa preview em alguns erros bancarios; XLSX preserva ultimo relatorio quando possivel | Deve preservar preview em erro no controller moderno |
| Clique duplicado | XLSX legado desabilita botoes; bancario nao tinha guarda canonico no controller | Precisa guarda moderna |
| Response-lost | `CommitImportBatch` tem receipts/idempotency suficientes para replay; reconciliacao generica existe, mas contrato de batch nao retorna attempt completo em falha de resposta simulada | Manter estado `uncertain` quando nao houver confirmacao; nao gerar novo batch automatico |
| Arquivo/preview em erro | Fluxo bancario zera linhas em erro de parse; XLSX preserva relatorio | Modernizacao deve preservar metadados/preview quando seguro |
| XLSX no bootstrap | `window.XLSX` e biblioteca nao entram no entry; sao carregados sob demanda pelo legado | Guard deve continuar comprovando |
| Importacao bancaria e XLSX | Compartilham `PrepareImportBatch`/`CommitImportBatch`, mas parser bancario permanece em `src/ui/importacao.js` | Nao adicionar novo modo nem misturar fingerprints |
| Regra duplicada na UI | Parser bancario possui regras proprias de extrato; XLSX usa parser canonico | Esta etapa nao duplica regra XLSX |

## Caminho seguro

1. Criar `importPreviewReadModel` puro para transformar o resultado preparado em grupos visuais.
2. Criar controller/presenter modernos para XLSX, com dependencias injetadas e sem `dataSdk`, Firebase ou `window.financeApp` no pipeline.
3. Instalar active UI por loader lazy mantendo `renderImportacao` como bridge global compatível.
4. Manter remocao de historico/importacao bancaria como legado ate uma etapa propria.
5. Adicionar guard estrutural para impedir regressao: sem persistencia direta no controller, parser XLSX canonico, `PrepareImportBatch`, `CommitImportBatch`, XLSX fora do entry, budget e contadores legados preservados.
