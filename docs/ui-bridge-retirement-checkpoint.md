# Checkpoint de aposentadoria da bridge `financeUI`

Executado em: 12/09/2026

## Baseline medido nesta etapa

- HEAD inicial: `b61aaca refactor: extrai coordenacao de navegacao para es modules`
- Branch: `melhoria-arquitetura`
- Remote: vazio
- Worktree inicial: limpa
- APIs globais inventariadas: 50
- `classic/eval`: 22/22
- Bytes legados: 747012
- Entry inicial medido: 375270 bytes
- Budget fixo de entry: 430080 bytes
- Headroom inicial: 54810 bytes

## Relacao real entre superficies

| Superficie | Produtor | Consumidor | Caminho ativo/fallback | Dependencia | Decisao | Evidencia |
| --- | --- | --- | --- | --- | --- | --- |
| `window.financeUI` | Antes: `src/ui/legacy-ui.js:installLegacyUiBridge` via `defineLegacyGlobalBridge` | Nenhum consumidor runtime efetivo encontrado | Era apenas exposicao publica da implementacao ES | Direta, obsoleta | Removida | `finance-ui-consumers:check`: `directFinanceUiConsumers=[]`, `financeUiInstalled=false`, `removedGlobalSurface=["window.financeUI"]` |
| `window.financeApp.financeUiAdapters` | `src/ui/legacy-ui.js:installFinanceUiConsumerAdapters` | `part-03`, `part-07`, `part-29` | Adapter fino para scripts classicos que nao importam ES Modules | Indireta, ainda necessaria | Mantida | `financeUiAdapterConsumers=21`, `remainingRuntimeConsumers=["part-03","part-07","part-29"]` |
| `src/ui/legacy-ui.js` | ES Module | Bootstrap legado e testes | Implementacao canonica dos helpers visuais e dos adapters | Codigo ES preservado | Mantido | `installLegacyUiBridge()` agora instala adapters sem publicar `window.financeUI` |
| `window.switchTab` | `part-08` + `navigationCoordinator.js` + `router.js` | Eventos de navegacao e fluxos legados | Bridge publica de navegacao | Compatibilidade publica | Mantida | Playwright de navegacao/hash/Voltar/sidebar |
| `navigationTabs.js:activateTab` | ES Module | `navigationCoordinator.js` | Ativacao visual canonica | Direta ES | Mantida | `navigationEvidenceStatus=ok` |

## Respostas do checkpoint

1. A navegacao ficou canonica? Sim. A ativacao visual passa por `navigationCoordinator.js` e `navigationTabs.js:activateTab`.
2. `window.financeUI` ainda e instalada? Nao.
3. Quem usa `financeUiAdapters`? `src/legacy/inline/part-03.js`, `src/legacy/inline/part-07.js` e `src/legacy/inline/part-29.js`.
4. Quais modulos modernos ainda dependem de bridges visuais? Nenhum no conjunto auditado pelo checker.
5. Quantos scripts continuam no loader? 22 scripts classic/eval.
6. Blocos fora deste lote: regras financeiras, Auth, Firestore Rules, persistencia, payloads, idempotencia, auditoria, reconciliacao, WhatsApp, webhook, telefone, provider externo, Admin SDK e migracao completa dos `part-XX`.
7. Alteracao real desta etapa: retirada da exposicao publica `window.financeUI`, mantendo a implementacao ES e os adapters aninhados necessarios.

## Decisao

Cenario 2 confirmado: a construcao dos adapters dependia da exposicao publica apenas por caminho mecanico. Os adapters agora recebem a implementacao ES diretamente por `createLegacyUiBridge(target)`. Como nao ha consumidor runtime efetivo de `window.financeUI`, a propriedade deixou de ser instalada.

## Observacoes

Frontend com bridges remanescentes nao impede contratos de `src/application/**` e `src/domain/**` de serem reutilizaveis por backend futuro. As bridges restantes sao compatibilidade de frontend legado e nao contrato para backend, chatbot, webhook, WhatsApp, provider externo ou Admin SDK.
