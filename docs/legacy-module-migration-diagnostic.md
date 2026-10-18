# Diagnostico do carregamento legado

Gerado em: 22/08/2026

## Baseline

| Metrica | Antes | Depois desta etapa |
| --- | ---: | ---: |
| Scripts classicos no loader | 34 | 33 |
| Scripts executados por `eval` | 34 | 33 |
| Ocorrencias de `eval` no loader | 2 tokens documentados | 2 tokens documentados |
| `new Function` no loader | 0 | 0 |
| APIs globais inventariadas | 58 | 58 |
| Arquivo migrado removido do loader | 0 | 1 |
| Tamanho aproximado carregado pelo loader | ~789 KB | 774765 bytes |
| Window assignments nos scripts restantes | ~31 | 31 |
| Function declarations nos scripts restantes | ~525 | 525 |
| Chamadas diretas a `dataSdk` nos scripts restantes | ~47 | 47 |

O loader concatena os arquivos `?raw` em `LEGACY_CLASSIC_SCRIPTS` e executa o bundle por eval indireto em escopo global. A ordem atual e: globals/base visual/eventos modernos migrados no bootstrap, depois scripts classicos restantes, depois modulos modernos de entries/monthDetail/dashboard/router.

## Tabela de migracao

| Script | Responsabilidade | Dependencias | Globais | Consumidores | Side effects | Risco | Candidato | Justificativa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/ui/legacy-events.js` | Registro de eventos estaticos e dinamicos | `document`, funcoes em `target`, `auditAction` | `financeEvents` bridge | UI inteira, smoke, Playwright | `addEventListener` | Baixo/medio | Migrado | Nao contem regra financeira nem persistencia; instalacao ja era idempotente |
| `src/legacy-globals.js` | Bridges globais base | `window`, motores modernos | Varios helpers criticos | Scripts legados | Instala globals | Alto | Nao nesta etapa | Ordem e compatibilidade ampla |
| `src/services/libraryLoader.global.js` | Bibliotecas visuais locais | `window`, DOM | `Chart`, `lucide` | UI/smoke | Carrega libs | Medio | Futuro | Pode virar install explicito apos cobertura isolada |
| `src/services/performanceMonitor.global.js` | Monitoramento local | `performance`, console | Monitor global | Smoke/perf | Observers | Medio | Futuro | Nao e regra financeira, mas afeta perf |
| `src/ui/legacy-ui.js` | Primitivas visuais e modais | DOM | `financeUI` | Todo legado | DOM helpers | Medio | Futuro | Visual, mas amplo |
| `src/legacy/inline/part-03.js` | CRUD principal, dashboard, submit, renderizacao | Muitos globals, DOM, dataSdk | Criticos: `renderDashboard`, `handleSubmit`, `renderSaidas`, `renderEntradas` | App inteira | Muito DOM/persistencia | Alto | Intocado | Contem regras e handlers criticos |
| `src/legacy/inline/part-04.js` | Bridges tributarias | Tax engine moderno | `calcularINSS`, `calcularIRRF`, `calcularLiquido` | Entradas/dashboard | Globals de calculo | Alto | Intocado | Critico tributario |
| `src/legacy/inline/part-05.js` | Consolidacao/entradas legadas | dataSdk, DOM, consolidacao | `consolidarEntradaMensal` duplicada | Entradas/dashboard | Persistencia | Alto | Intocado | Regra financeira sensivel |
| `src/legacy/inline/part-06.js` | Controle de horas legado | DOM, dataSdk, motor horas | Handlers de horas | Controle de horas | Persistencia | Alto | Intocado | Motor ja moderno, UI ainda acoplada |
| `src/legacy/inline/part-08.js` | Parcelamentos/render | DOM, dataSdk | `renderParcelamentos` | Aba parcelamentos | Render/persistencia | Alto | Intocado | Fluxo financeiro sensivel |
| `src/legacy/inline/part-11.js` | Ajustes/descontos de entrada | dataSdk | `saveEntryDiscountAdjustmentByEntry` | Entradas | Persistencia | Alto | Intocado | Regras de entrada |
| `src/legacy/inline/part-16.js` | Modais de entradas, outras receitas e historico | DOM, dataSdk | `openEntryOtherRevenuesModal`, `openEntryDiscountHistoryModal` | Entradas | DOM/persistencia | Alto | Intocado | Regras recentes de receitas separadas |
| `src/legacy/inline/part-20.js` | Importacoes | DOM, dataSdk | Import handlers | Importacao | Persistencia em lote | Alto | Intocado | Importacao bancaria/planilha |
| `src/legacy/inline/part-27.js` | Planner/DSR/feriados | DOM, motores modernos | Planner helpers | Planner/horas | DOM | Medio/alto | Futuro | Bom candidato apos testes de feriados |
| `src/legacy/inline/part-28.js` | Admin/usuario | Auth/perfil | `isCurrentUserAdmin` | Config/admin | Estado de usuario | Alto | Intocado | Autenticacao/autorizacao |
| `src/legacy/inline/part-29.js` | Regras percentuais, dashboard controles, filtros | DOM, dataSdk, globals | Varias APIs globais | Dashboard/config | DOM/persistencia | Alto | Intocado | Muito acoplado |
| `src/legacy/inline/part-21..25,30,31.js` | Stubs pequenos | Nenhuma/baixa | Nenhuma | Loader | Sem efeito relevante | Baixo | Futuro | Podem ser removidos do loader apos confirmar vazio/stub |

## Grupo escolhido

Grupo migrado: `src/ui/legacy-events.js`.

Justificativa: arquivo de evento, sem regra financeira canonica, sem chamada direta a `dataSdk`, sem novos globais inventariados, com idempotencia existente via `dataset`, e baixo risco para futura integracao porque backend nao deve importar eventos/DOM.

## Nova ordem

1. `bootstrapApp()` instala templates, bridges modernas e `installLegacyEventBindings(globalThis)`.
2. `loadLegacyClassicScripts()` carrega os 33 scripts classicos restantes por eval.
3. Modulos modernos complementares continuam importados apos o loader.
4. `financeLegacyReady` continua sendo disparado ao final.
