# Analise de Bundle

Executado em: 23/08/2026

## Diagnostico

- O bootstrap anterior carregava `services-firebase` por import estatico indireto.
- A origem era uma dependencia de dominio para `src/services/audit.js`, que importa Firestore.
- Os repositorios Firebase tambem estavam importados estaticamente na composicao web.

## Mudancas

- `src/domain/audit/financeRecordAudit.js` passou a conter helpers puros de auditoria financeira.
- `src/domain/FinanceRepository.js` deixou de importar `src/services/audit.js`.
- `createApplicationDependencies` passou a criar repositorios Firebase por wrappers lazy.
- `vite.config.js` separa somente `node_modules/firebase` em `services-firebase`.
- `src/app.js` nao inicia mais promise global de Firebase antes da carga legada.
- `src/app.js` instala loaders leves para Controle de Horas e Parcelamentos, mas carrega os renderers reais somente quando o usuario abre as abas correspondentes.

## Estado atual

- Firebase Web SDK esta fora do HTML inicial.
- O chunk Firebase continua grande por conter o SDK web, mas e lazy.
- `part-03` segue como maior area legada funcional e nao foi migrado nesta etapa.
- Chart.js continua no bootstrap porque o dashboard e a primeira tela.

## Estado 5.4B - 03/09/2026

- Entry: `dist/assets/app-u98FG2UQ.js`, `411442` bytes.
- Budget oficial restaurado: `430080` bytes.
- Headroom: `18638` bytes (`4.33%`).
- Maior chunk: `dist/assets/services-firestore-BWq7wxDa.js`, `449417` bytes.
- Firebase: `dist/assets/services-firebase-CKXkwsgm.js`, `167138` bytes, fora do bootstrap.
- Chart.js: `dist/assets/vendor-chart-CieodS8Z.js`, `207440` bytes.
- Controle de Horas ativo: `dist/assets/hourControlActiveUi-BlGPZ-K5.js`, `24630` bytes, chunk assincrono.
- Loader de Controle de Horas: `dist/assets/loadHourControlActiveUi-C9DuLMSJ.js`, `724` bytes.
- Parcelamentos: `dist/assets/parcelamentosRenderer-D2yYUets.js`, `21960` bytes, chunk assincrono.

`hourControlActiveUi.js`, `hourControlController.js`, `hourControlPresenter.js` e `hourControlReadModel.js` nao fazem parte do runtime inicial. O entry contem apenas o loader e a decisao de rota; a instalacao moderna acontece uma vez, com retry apos falha de lazy load.

## Estado Configuracoes - 04/09/2026

Configuracoes tambem passa a usar lazy loader leve no bootstrap. `settingsActiveUi.js`, `settingsController.js`, `settingsPresenter.js` e `settingsReadModel.js` carregam sob demanda quando a aba `configuracoes` e aberta.

Estado medido apos build local:

- Entry: `dist/assets/app-DObkdGHB.js`, `425874` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `4206` bytes.
- Chunk de Configuracoes: `dist/assets/settingsActiveUi-CzqGTLk_.js`, `17010` bytes.
- Loader de Configuracoes: `dist/assets/loadSettingsActiveUi-CpPNdGq7.js`, `620` bytes.

O entry deve continuar contendo apenas a decisao de rota e o loader dinamico. `npm run settings-modernization:check` falha se a UI ativa de Configuracoes voltar a import estatico ou se o budget oficial de Entry JS for aumentado.

## Estado Configuracoes 5.6A - 05/09/2026

O crescimento de 5.6 veio de helpers settings-only adicionados em `src/app.js`: leitura, actions, base record, suplementos e resolucao simples de escopo. Em 5.6A esses helpers foram movidos para `src/ui/settings/settingsWebAdapter.js`, carregado sob demanda por `loadSettingsActiveUi.js`.

Estado medido apos build local:

- Entry: `dist/assets/app-B4p44E06.js`, `420552` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `9528` bytes (`2.22%`).
- Chunk de Configuracoes: `dist/assets/settingsActiveUi-Di2_kalG.js`, `17536` bytes.
- Adapter de Configuracoes: `dist/assets/settingsWebAdapter-CXe8N_6J.js`, `7014` bytes.
- Loader de Configuracoes: `dist/assets/loadSettingsActiveUi-B4MniqMv.js`, `651` bytes.

`settingsActiveUi`, `settingsController`, `settingsPresenter`, `settingsReadModel`, `settingsWebAdapter` e `resolveReferenceWriteScope` permanecem fora do entry. `npm run bundle:budget` e `npm run settings-modernization:check` validam essa fronteira.

## Estado Administracao de Usuarios - 05/09/2026

A UI ativa de Administracao de Usuarios e carregada pelo caminho lazy de Configuracoes. `userAdminActiveUi`, `userAdminController`, `userAdminPresenter`, `userAdminReadModel` e `userAdminPermissions` permanecem fora do bootstrap estatico de `src/app.js`.

Estado medido apos build local:

- Entry: `dist/assets/app-BmdGS1oB.js`, `420576` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `9504` bytes (`2.21%`).
- Chunk de Administracao de Usuarios: `dist/assets/userAdminActiveUi-Bwft7M04.js`, `15151` bytes.
- Loader de Administracao de Usuarios: `dist/assets/loadUserAdminActiveUi-UjKvxhMl.js`, `715` bytes.
- Firebase: `dist/assets/services-firebase-CKXkwsgm.js`, `167138` bytes, fora do bootstrap.
- Maior chunk: `dist/assets/services-firestore-BWq7wxDa.js`, `449417` bytes.

O budget oficial nao foi aumentado para acomodar a mudanca.

## Importacao financeira - 06/09/2026

Estado medido apos build local:

- Entry: `dist/assets/app-C9-0KpVX.js`, `371836` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `58244` bytes (`13.54%`).
- UI ativa de Importacao: `dist/assets/importActiveUi-BTmm4E7d.js`, `19971` bytes, chunk assincrono.
- Loader de Importacao: `dist/assets/loadImportActiveUi-BGv68_lG.js`, `697` bytes.
- Renderer legado de Importacao: `dist/assets/importacao-CNMF_lSg.js`, `41401` bytes, carregado sob demanda para compatibilidade.
- Parser XLSX canonico: `dist/assets/spreadsheetImportParser-kZpl9n_s.js`, `9425` bytes, carregado sob demanda.
- Firebase: `dist/assets/services-firebase-CKXkwsgm.js`, `167138` bytes, fora do bootstrap.
- Maior chunk: `dist/assets/services-firestore-BWq7wxDa.js`, `449417` bytes.

O budget oficial nao foi aumentado. `npm run bundle:budget` e `npm run import-ui-modernization:check` falham se a UI ativa de Importacao, o read model de preview ou o parser XLSX voltarem ao entry.
## Backup e Restore - 08/09/2026

Estado medido apos build local:

- Entry: `dist/assets/app-CrBRnQXd.js`, `371926` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `58154` bytes (`13.52%`).
- UI ativa de Backup/Restore: `dist/assets/backupActiveUi-CBu-5Qyr.js`, `29583` bytes, chunk assincrono.
- Loader de Backup/Restore: `dist/assets/loadBackupActiveUi-CLh9Kzol.js`, `697` bytes.
- Firebase: `dist/assets/services-firebase-CKXkwsgm.js`, `167138` bytes, fora do bootstrap.
- Maior chunk: `dist/assets/services-firestore-BWq7wxDa.js`, `449417` bytes.

O budget oficial nao foi aumentado. `npm run bundle:budget` e `npm run backup-ui-modernization:check` falham se a UI ativa de Backup/Restore, seus read models ou a execucao de restore real voltarem ao entry ou ao controller client-side.

## Exportacao PDF - 08/09/2026

Estado medido apos build local:

- Entry: `dist/assets/app-BQDEoBiM.js`, `373464` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `56616` bytes (`13.16%`).
- UI ativa de Relatorio PDF: `dist/assets/reportExportActiveUi-BBU8lokj.js`, `13010` bytes, chunk assincrono.
- Loader de Relatorio PDF: `dist/assets/loadReportExportActiveUi-CaEdRuWf.js`, `675` bytes.
- Adapter PDF: `dist/assets/pdfAdapter-D96YUIe1.js`, `2045` bytes, chunk assincrono.
- Firebase: `dist/assets/services-firebase-CKXkwsgm.js`, `167138` bytes, fora do bootstrap.
- Maior chunk: `dist/assets/services-firestore-BWq7wxDa.js`, `449417` bytes.

O budget oficial nao foi aumentado. `npm run bundle:budget` e `npm run pdf-export-modernization:check` falham se a UI ativa de relatorio, o report model ou a biblioteca PDF voltarem ao entry.

## Saida do Loader Legado - 08/09/2026

- Entry antes da etapa: `373464` bytes.
- Entry depois da etapa: `dist/assets/app-CJv9WDJQ.js`, `372911` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `57169` bytes (`13.29%`).
- Scripts classicos/eval: `33/33 -> 26/26`.
- Bytes do loader classico: `776933 -> 776052`.
- Scripts removidos do loader: `part-21.js`, `part-22.js`, `part-23.js`, `part-24.js`, `part-25.js`, `part-30.js`, `part-31.js`.

O budget oficial nao foi aumentado. O teto estrutural pos-etapa para `bundle:budget` e `legacy-loader:check` passa a ser `26/26` scripts classicos/eval.

## Bridges e Monitor - 08/09/2026

- Entry baseline anterior: `372911` bytes.
- Entry apos segundo lote: `dist/assets/app-BFUKd7Fn.js`, `372910` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `57170` bytes (`13.29%`).
- Scripts classic/eval: `26/26 -> 24/24`.
- Bytes carregados pelo loader legado: `776052 -> 754753`.
- Chunk do monitor ES: `dist/assets/performanceMonitor-r48FUWgM.js`, cerca de `7.75 kB`.
- Removidos do classic/eval loader: `src/legacy-globals.js`, `src/services/performanceMonitor.global.js`.
- Maximo estrutural atualizado: `classicScriptsMax=24`, `evalExecutedScriptsMax=24`.

## Loader de Bibliotecas - 08/09/2026

- Entry baseline anterior: `372910` bytes.
- Entry apos terceiro lote: `dist/assets/app-DXBGtjy6.js`, `373064` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `57016` bytes (`13.26%`).
- Scripts classic/eval: `24/24 -> 23/23`.
- Bytes carregados pelo loader legado: `754753 -> 751896`.
- Chunk da bridge de bibliotecas: `dist/assets/libraryLoaderBridge-BhRFLgRW.js`, cerca de `3.61 kB`.
- Chunk do monitor ES: `dist/assets/performanceMonitor-BCJwDFCf.js`, cerca de `7.75 kB`.
- Removidos do classic/eval loader: `src/services/libraryLoader.global.js`.
- Maximo estrutural atualizado: `classicScriptsMax=23`, `evalExecutedScriptsMax=23`.

## Correcao de Bootstrap dos Loaders - 09/09/2026

- Entry antes da correcao: `373064` bytes.
- Entry depois da correcao: `dist/assets/app-B-iZHFFn.js`, `373064` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `57016` bytes (`13.26%`).
- Scripts classic/eval: `23/23 -> 23/23`.
- Bytes carregados pelo loader legado: `751896 -> 751896`.
- Chunk da bridge de bibliotecas: `3.66 kB -> dist/assets/libraryLoaderBridge-CZxid2j3.js`, cerca de `1.76 kB`.
- Chunk canonico do loader: `dist/assets/libraryLoader-DSM9qcKg.js`, cerca de `2.76 kB`, carregado sob demanda.
- XLSX, jsPDF/autotable e Firebase continuam fora do entry.
- `bootstrap:check`, `bundle:budget`, `library-loader:check` e `legacy-loader:check` aprovados.

## Decomposicao `legacy-ui.js` - 11/09/2026

- Entry baseline anterior: `374009` bytes.
- Entry apos a etapa: `dist/assets/app-C7kP6oAI.js`, `374155` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `55925` bytes (`13.00%`).
- Scripts classic/eval: `23/23 -> 22/22`.
- Bytes carregados pelo loader legado: `751896 -> 746720`.
- Removido do classic/eval loader: `src/ui/legacy-ui.js`.
- Bridge preservada: `window.financeUI`, instalada por ES Module.
- Nenhum XLSX, PDF ou Firebase foi adicionado ao entry por esta etapa. O aumento de `146` bytes no entry vem do ponto de import dinamico da bridge ES; permanece abaixo da meta preferencial de `375000` bytes e do budget oficial.

## Consumidores `financeUI` - 12/09/2026

- Entry baseline da etapa: `374155` bytes.
- Entry apos a etapa: `dist/assets/app-uLsSiLQf.js`, `374155` bytes.
- Budget oficial: `430080` bytes.
- Headroom: `55925` bytes (`13.00%`).
- `classic/eval`: permanece `22/22`.
- Bytes carregados pelo loader legado: `746720 -> 747024` nesta etapa, ainda abaixo do baseline de saida do loader (`776933`).
- APIs globais: permanecem `50`.
- `part-03.js`: chamadas diretas `window.financeUI` `13 -> 0`.
- `part-29.js`: chamadas diretas `window.financeUI` `3 -> 0`.
- Novo adapter: `src/ui/legacy-ui.js:installFinanceUiConsumerAdapters`, carregado pelo mesmo import ES que instala `window.financeUI`.
- Nenhum XLSX, PDF, Firebase, WhatsApp, webhook, provider externo ou Admin SDK foi adicionado ao entry por esta etapa.

## Consumidores modernos `financeUI` - 12/09/2026

- Modulos modernos migrados para imports ES/injecao local: `src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js`, `src/ui/records/financialCrudControllerInstaller.js`.
- `part-07.js`: chamadas diretas `window.financeUI` `5 -> 0`; chamadas visuais passam pelo adapter temporario `window.financeApp.financeUiAdapters`.
- Consumidores diretos remanescentes naquele ponto: `src/legacy/inline/part-08.js` (`9`) e `src/legacy/inline/part-14.js` (`4`).
- Nenhum script saiu do classic/eval loader nesta etapa e nenhuma API global top-level nova foi adicionada.
- Build validado: entry `dist/assets/app-8u1PGeQx.js` com `375011` bytes contra budget `430080`; maior chunk `services-firestore-BWq7wxDa.js` com `449417` bytes contra limite `573440`.
- Loader legado validado: `classic/eval=22/22`, bytes legados `747119`, APIs globais `50`, novo `eval=0`, `new Function=0`.
- Gates: `npm run finance-ui-consumers:check`, `npm run bundle:budget`, `npm run bootstrap:check` e `npm run bootstrap:benchmark`.

## Consumidores criticos `financeUI` - 12/09/2026

- `part-08.js`: chamadas diretas `window.financeUI` `9 -> 0`; chamadas puramente visuais de Configuracoes e a ativacao visual de navegacao foram substituidas por DOM local equivalente.
- `part-14.js`: chamadas diretas `window.financeUI` `4 -> 0`; fallback visual de pessoas passou a usar DOM local equivalente.
- Consumidor direto remanescente nos criticos: nenhum; a navegacao efetiva de `switchTab` usa `navigationCoordinator.js` e `navigationTabs.js:activateTab`, sem chamar `financeUI.activateTab` nem `financeUiAdapters.activateTab`.
- Nenhum script saiu do classic/eval loader nesta etapa e nenhuma API global top-level nova foi adicionada.
- Build validado: entry `dist/assets/app-IiJYzU-6.js` com `375011` bytes contra budget `430080`; maior chunk `services-firestore-BWq7wxDa.js` com `449417` bytes contra limite `573440`.
- Loader legado validado: `classic/eval=22/22`, bytes legados `747948`, APIs globais `50`, novo `eval=0`, `new Function=0`.
