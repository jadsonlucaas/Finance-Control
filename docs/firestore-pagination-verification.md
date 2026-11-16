# Verificacao de Paginacao Firestore

Executado em: 23/08/2026

Esta verificacao corrige a ressalva da etapa de performance: listagens historicas persistidas nao devem usar `getAll -> slice` quando ha acesso direto ao Firestore. A validacao foi feita apenas em localhost com Firestore Emulator e massa sintetica.

## Resultado por repositorio

| Area | Colecao / origem | Antes | Depois | Evidencia local | Observacao |
| --- | --- | --- | --- | --- | --- |
| Auditoria operacional | `users/{uid}/audit_logs` | Facade `auditSdk.list` podia retornar tudo e paginar em memoria | `FirebaseAuditRepository.list` usa `query`, `where`, `orderBy`, `startAfter` e `limit` quando `db` existe | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` | Fallback legado continua somente para facade sem `db` |
| Recibos de idempotencia | `users/{uid}/idempotency_receipts` | Nao havia listagem paginada Firestore | `FirebaseWebIdempotencyRepository.list` usa `query`, filtros, `orderBy`, `startAfter` e `limit` | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` | Usado para historico operacional, nao para calculo financeiro |
| Administracao de usuarios | `users` | `userAdminSdk.listUsers` podia retornar tudo e paginar em memoria | `FirebaseUserProfileRepository.listUsers` usa `query`, `orderBy`, `startAfter` e `limit` quando `db` existe | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` | A autorizacao continua protegida por contexto e Rules |
| Import batches | Nao persistido como colecao propria nesta arquitetura | Nao aplicavel | Nao aplicavel | `docs/import-batch-contract.md` e `docs/firestore-data-model.md` | Lotes existem como contrato de aplicacao e receipts, nao como `import_batches` persistido |
| Registros financeiros usados por dashboard | `users/{uid}/finance_records` / cache local do owner | Leitura completa do owner para telas agregadas | Mantido completo para KPIs e totais | `tests/application/performance/dashboardDatasetIntegrity.test.js` | Paginar o universo de KPI alteraria totais e percentuais |
| Registros financeiros historicos | `FinanceRecordRepository.list` | Repositorio web ainda depende da facade/cache existente | Sem correcao nesta fase | `docs/firestore-query-index-plan.md` | Exige migracao de facade ou query nativa coberta por Emulator antes de uso produtivo |

## Evidencia de pagina

`npx firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"`:

| Lista | Page 1 | Page 2 | Page 10 | Fonte | Cursor |
| --- | ---: | ---: | ---: | --- | --- |
| `audit_logs` | 50 | 50 | 50 | `firestore` | Opaco |
| `idempotency_receipts` | 50 | 50 | 50 | `firestore` | Opaco |
| `users` | 50 | 50 | 50 | `firestore` | Opaco |

O cursor e serializado em Base64URL com valores minimos de ordenacao. Ele nao expõe `DocumentSnapshot`, paths internos, uid do owner ou ids de documentos.

## Itens nao corrigidos por design

- Dashboard e KPIs: continuam usando dataset completo do periodo/owner para nao distorcer totais, medias, percentuais e graficos.
- Facades legadas sem `db`: mantem fallback local para compatibilidade ate migracao segura.
- `import_batches`: nao existe colecao persistida atual; a rastreabilidade de importacao fica em receipts de idempotencia e auditoria.

## Janela de historico do Dashboard - 16/11/2026 (issue #113)

A linha "Registros financeiros usados por dashboard: mantido completo" foi revista. Ao abrir o app, o Dashboard nao escuta mais a colecao inteira `users/{uid}/finance_records`; escuta a uniao de 6 consultas de campo unico (indices automaticos, sem indice composto e sem mudanca de regras), montadas em `src/core/recordsHistoryWindow.js`:

| Consulta | Por que |
| --- | --- |
| `competence >= inicio` | Lancamentos da janela e todos os meses futuros |
| `due_date >= inicio-01` | Lancamentos sem `competence` (o app usa o vencimento como competencia) |
| `occurred_date >= inicio-01` | Idem, pela data do lancamento |
| `status in [Em aberto, Vencido, Pendente]` | Contas nao pagas de qualquer epoca continuam visiveis |
| `total_installments > 1` | Parcelamentos completos (progresso "3/10" correto) |
| `type not-in [saida, entrada]` | Pessoas, categorias, regras, horas e salarios (sempre completos) |

- Janela padrao: 12 meses (mes atual + 11 anteriores). `VITE_FINANCE_HISTORY_WINDOW_MONTHS` na Vercel muda o tamanho; `0` volta ao comportamento antigo (colecao inteira) sem reverter codigo.
- KPIs continuam corretos para qualquer periodo selecionado: escolher um mes/data anterior a janela em qualquer filtro (`input[type=month|date]`, setas do periodo) chama `financeHistoryWindow.ensureFrom(mes)` e amplia a janela antes de recalcular.
- Historico completo (`ensureFull`) antes de: tela Importacao, importar/remover/arquivar em Configuracoes, backup e simulacao de restauracao, exclusao de categoria/macro ("em uso" olha tudo) e botao "Carregar histórico completo".
- Se uma consulta da janela falhar, o app volta sozinho para a colecao inteira (nunca mostra dados pela metade).
- Testes: `tests/core/recordsHistoryWindow.test.js`, `tests/services/dataSdk.historyWindow.test.js` e E2E com emulador `tests/playwright/integration-local-history-window.spec.js`.

Custo: abrir o app passa a ler os documentos da janela (+ em aberto, parcelamentos e cadastros) em vez de todo o historico; uma conta com 3 anos de uso le cerca de um terco do que lia.

## whatsapp-api: leitura a partir do mes necessario - 16/11/2026

`store.listFinanceRecords(uid, { from })` le so os lancamentos com `competence >= from`, `due_date >= from-01` ou `occurred_date >= from-01`, mais as contas em aberto de qualquer epoca (`status in [Em aberto, Vencido, Pendente, '']`), e filtra `saida`/`entrada` em memoria (`buildRecentRecordQueries` em `src/core/recordsHistoryWindow.js`). Sem `from`, continua lendo tudo. Sao consultas de campo unico: nenhum indice composto.

| Rota / uso | `from` |
| --- | --- |
| `despesas`, `orcamento` | competencia pedida |
| `resumo`, `categorias` | inicio do periodo pedido |
| `lancamentos` com competencia | competencia pedida |
| `lancamentos` sem competencia, `opcoes`, formas de pagamento, `orcamento/definir` | ultimos 12 meses (`RECENT_LOOKUP_MONTHS`) |
| `vencimentos` | mes atual (vencidas antigas vem pela consulta de contas em aberto) |
| alertas automaticos | mes anterior (resumo mensal) |

O cache curto (`readCache.js`) guarda uma entrada por usuario e `from`; escritas da API limpam todas as entradas do usuario. Teste no emulador: `tests/firestore/whatsapp-api-recent-reads-emulator.test.js`.
