# Politica de Performance e Escalabilidade Frontend

Executado em: 23/08/2026

Esta politica vale para evolucoes locais do frontend Vite sem deploy, sem Firebase real e sem alteracao de regras financeiras.

## Regras

- Dependencias pesadas devem ficar fora do bootstrap sempre que nao forem necessarias para a primeira tela.
- Firebase Web SDK deve carregar sob demanda por `installFirebaseServices` e repositorios Firebase lazy.
- XLSX e PDF devem continuar sob `libraryLoader.global.js`, carregados somente quando o usuario aciona importacao ou relatorio.
- Modulos de dominio nao podem importar servicos Firebase, Auth, Admin SDK ou provider externo.
- Listagens novas devem aceitar paginacao por `limit` e `cursor`.
- Subscriptions devem retornar `unsubscribe` e ser encerradas na troca de usuario.
- Benchmarks e budgets devem usar massa sintetica local, sem escrita em producao.

## Orçamento atual

- Entry JS: ate 420 KiB.
- Maior chunk: ate 560 KiB.
- Chunk Firebase: ate 560 KiB, mas fora do bootstrap.
- Globais inventariadas: ate 58.
- Scripts classicos legados: ate 33.
- `eval` do loader legado: ate 33 scripts executados.

Validacao automatica: `npm run bundle:budget`.

Atualizacao em 03/09/2026: o budget de Entry JS foi restaurado para 420 KiB apos a auditoria de governanca 5.4B. A elevacao para 422 KiB nao permanece como politica aprovada.

Regra anti-moving-goalposts: limites de bundle nao podem ser elevados no mesmo prompt apenas para acomodar crescimento de uma feature. Um aumento futuro precisa de diagnostico, justificativa tecnica, comparacao antes/depois e aprovacao explicita em etapa propria. O caminho preferencial e reduzir bootstrap por lazy loading, code splitting, remocao de import eager desnecessario e deduplicacao.

`scripts/bundle-budget.mjs` deve falhar se o limite configurado ultrapassar o baseline aprovado em `docs/bundle-budget-baseline.json`, se a UI ativa de Controle de Horas voltar a ser importada eager no `src/app.js`, se evidencia do runtime lazy aparecer no entry ou se Firebase voltar ao bootstrap.

## Atualizacao corretiva - 23/08/2026

Historicos persistidos que usam Firestore direto devem provar paginacao no servidor com Emulator. Nesta fase, a prova cobre:

- `audit_logs`;
- `idempotency_receipts`;
- `users` na administracao.

Dashboard e KPIs nao podem usar apenas a primeira pagina como universo de calculo. Totais, percentuais, medias e graficos devem considerar o dataset completo autorizado para o owner e periodo, salvo se houver uma regra de produto explicita para agregado precomputado.

Comandos repetiveis:

```powershell
npm.cmd run bootstrap:benchmark
npm.cmd run dashboard:benchmark
npm.cmd run import:benchmark
npm.cmd run backup:benchmark
npx.cmd firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"
```

Evidencias consolidadas: `docs/firestore-pagination-verification.md` e `docs/performance-before-after.md`.
