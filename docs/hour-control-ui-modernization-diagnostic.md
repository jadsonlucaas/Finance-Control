# Diagnostico de Modernizacao da UI de Controle de Horas

Gerado em: 02/09/2026

Este diagnostico foi criado antes de qualquer alteracao funcional da etapa de modernizacao da interface de Controle de Horas. O escopo e local, sem push, deploy, Firebase real, WhatsApp, webhook, telefone, provider externo ou Admin SDK.

## Arquitetura atual

O modulo visual de Controle de Horas ainda esta concentrado em scripts classicos:

- `src/legacy/inline/part-06.js`: formulario/modal, previa de calculo, persistencia de `controle_horas`, geracao de entrada de hora extra, filtros, listagem, agrupamento e detalhes.
- `src/legacy/inline/part-04.js`: bridges legadas de `getSalarioVigente`, `calcularHoras` e `calcularHoraExtra`.
- `src/legacy/inline/part-05.js`: consolidacao mensal de entradas, historico salarial e modais de salario.
- `src/legacy/inline/part-20.js`: importacao que tambem usa calculos de horas.
- `src/legacy/inline/part-27.js`: ajustes de DSR/preview relacionados a hora extra e salario.
- `src/ui/legacy-events.js`: handlers modernos que ainda invocam globais como `openSalaryHistoryModal` e `saveSalaryHistoryRecord`.

Os motores canonicos ja existem em:

- `src/domain/workSession.js` e `src/domain/hours.js`: `CalculateWorkSession`, `ResolveEffectiveSalary`, `CalculateDSR`, `calcularHoras`, `calcularHoraExtra` e `calcularBancoHoras`.
- `src/domain/hourPeriodSummary.js`: resumo agregado de horas extras e banco de horas.
- `src/application/useCases/financeRecordUseCases.js`: `CreateHourEntry` e `UpdateHourEntry`, acionados pelo `ApplicationCommandGateway`.

## Onde cada regra acontece hoje

| Area | Implementacao atual | Observacao |
| --- | --- | --- |
| Jornada | `part-06.js` chama `calcularHoras`; bridge canonica vem de `workSession.js`, mas existe funcao legada em `part-04.js` | UI ainda depende de global. |
| Hora extra | `part-06.js` chama `calcularHoraExtra`; `CreateHourEntry` tambem usa `CalculateWorkSession` | Risco de duplicar payload/calculo na UI. |
| Banco de horas | `part-06.js` chama `calcularBancoHoras` e grava `bank_minutes` | Resumo agregado existe em `hourPeriodSummary.js`. |
| DSR | `part-27.js` e consolidacao de entradas usam regras de DSR | Nao deve ser recalculado pela UI nova. |
| Salario vigente | `getSalarioVigente` em `part-04.js`/`part-05.js`; `ResolveEffectiveSalary` no dominio | Read model novo deve usar `ResolveEffectiveSalary`. |
| Persistencia | `part-06.js` usa `window.dataSdk.create` diretamente | Caminho moderno deve usar `CreateHourEntryCommand`/`UpdateHourEntryCommand`. |
| Listagem | `getControleHorasRecords` filtra `allRecords` por competencia e busca textual | Filtros devem virar selectors puros. |
| Detalhes | `toggleHourControlDetails` alterna DOM por pessoa/competencia | Presenter pode renderizar sem calcular regra. |

## Globais e consumidores

Globais/bridges relevantes:

- `calcularHoras`: bridge de compatibilidade para legado e smoke/Playwright.
- `calcularHoraExtra`: bridge de compatibilidade para legado e smoke/Playwright.
- `getSalarioVigente`: usado por entradas, horas, parcelamentos/configuracoes e consolidacao.
- `openSalaryHistoryModal`, `saveSalaryHistoryRecord`: consumidos por `src/ui/legacy-events.js`.
- `renderControleHoras`: renderizacao classica ainda consumida por tabs/rotas legadas.
- `openHourControlModal`, `closeHourControlModal`, `saveHourControlRecord`: fluxo classico do formulario.

Nenhuma dessas bridges deve ser removida sem busca completa de consumidores, smoke e Playwright cobrindo o fluxo.

## Side effects

Renderizacao/listagem classica atualiza DOM e instala/depende de handlers existentes. O caminho de salvamento atual tem side effects de persistencia:

- cria `controle_horas` via `window.dataSdk.create`;
- para `Hora Extra`, cria tambem uma `entrada` financeira derivada;
- atualiza cache global/`allRecords` pela camada de dados legada;
- usa toast e fecha modal.

O read model moderno nao pode gravar dados nem gerar entradas financeiras; isso deve permanecer nos casos de uso/comandos.

## Riscos de regressao

- UI recalcular jornada/HE/DSR com regra diferente do motor canonico.
- Update reprocessar mes inteiro em vez de recalcular apenas o registro editado.
- Salario vigente ser resolvido pela data atual em vez da competencia do registro.
- Banco de horas inverter sinal de debito/credito.
- Filtros de competencia e pessoa alterarem o universo de registros.
- `source_channel` influenciar calculo indevidamente.
- Listener/subscription de owner anterior continuar ativo apos logout/troca de usuario.
- Remocao prematura de `part-06.js`, `part-04.js` ou `part-05.js` quebrar bridges ainda usadas.

## Scripts classicos

`src/legacy/classicScripts.js` permanece com 33 scripts/eval. `part-06.js` e o principal candidato futuro do modulo, mas ainda contem UI, persistencia e bridges reais. Remocao nesta etapa so e segura se o formulario, listagem, handlers e consumers globais forem migrados e cobertos.

## Sequencia segura

1. Criar filtros puros para registros de horas.
2. Criar read model puro para Controle de Horas reutilizando `buildHourPeriodSummary` e `ResolveEffectiveSalary`.
3. Criar controller/presenter modernos com dependencias injetadas.
4. Delegar create/update para `ApplicationCommandGateway` com `CreateHourEntryCommand` e `UpdateHourEntryCommand`.
5. Adicionar testes de pureza, equivalencia, states, subscriptions, create/update e ausencia de novas globais/eval.
6. Manter scripts classicos ate comprovar consumidores migrados.

## Resultado da modernizacao local

Foram adicionados selectors puros, read model, controller e presenter modernos para Controle de Horas. O fluxo visual legado nao foi removido nem substituido nesta etapa porque ainda contem persistencia classica e criacao de entrada financeira derivada de hora extra.

Evidencias executadas em 02/09/2026:

- `npm run inventory:globals`: aprovado, 50 APIs globais inventariadas.
- `npm test`: aprovado, 82 arquivos e 519 testes.
- `npm run build`: aprovado, 1904 modulos transformados.
- `npm run smoke`: aprovado, `status=ok`, URL local `http://127.0.0.1:5175/`.
- `npx playwright test tests/playwright/regression-local.spec.js`: aprovado, 33 testes.
- `npm run perf:audit`: aprovado, 2 testes.
- `npm run bundle:budget`: aprovado, sem violacoes.
- `npm run resilience:dry-run`: aprovado, `wrote=false`, `firebase_touched=false`.
- `npm run post-commit:dry-run`: aprovado, `wrote=false`, `firebase_touched=false`.
- `npm run hour-control-modernization:check`: aprovado, `wrote=false`, 50 globais, 33 scripts classicos, 33 eval.
- `npm run hour-control:benchmark`: aprovado, `wrote=false`; 100 registros `55.002ms`, 1.000 registros `6.99ms`, 5.000 registros `24.493ms`, 10.000 registros `42.149ms`.
- `node scripts/analyze-legacy-loader.mjs`: 33 scripts classicos, 33 eval executados, 2 ocorrencias de `eval` no loader, 0 `new Function`.
- `npx firebase emulators:exec --only firestore "npm.cmd run test:rules"`: aprovado no Emulator local.
- `npx firebase emulators:exec --only auth,firestore "npm.cmd run test:auth-flow"`: aprovado no Emulator local; tempo total medido `30579ms`.

`vitest.auth-flow.config.js` nao foi alterado nesta etapa.

## Verificacao da interface ativa pos-9cb8ba7

Antes da correcao desta etapa, a interface ativa de Controle de Horas ainda chamava bridges legadas instaladas pelos scripts classicos: `renderControleHoras`, `openHourControlModal`, `saveHourControlRecord`, `openEditHourControlRecord`, handlers de detalhe e filtros em `src/ui/legacy-events.js`. O caminho de persistencia efetivo ainda passava por `window.dataSdk.create/update` dentro dos scripts `part-06.js`/`part-20.js`, apesar de ja existirem `hourControlReadModel`, `hourControlController` e `hourControlPresenter`.

A correcao local conecta a interface ativa por `src/ui/hours/hourControlActiveUi.js`, instalado em `src/app.js` imediatamente apos `loadLegacyClassicScripts(globalThis)`. O adapter substitui somente as bridges existentes de Controle de Horas, sem criar nova API global de topo, e delega criacao/edicao para `hourControlController`, que executa `CreateHourEntryCommand` e `UpdateHourEntryCommand` no `ApplicationCommandGateway`.

Fluxo ativo apos a correcao:

`bootstrapApp -> loadLegacyClassicScripts -> installHourControlActiveUi -> renderControleHoras/openHourControlModal/saveHourControlRecord -> hourControlController -> hourControlReadModel/hourControlPresenter -> ApplicationCommandGateway -> CreateHourEntry/UpdateHourEntry`.

Scripts classicos permanecem carregados porque ainda concentram consumidores e comportamentos fora desta fatia: bridges de calculo, historico salarial, detalhe legado, exclusao, geracao/sincronizacao de entrada financeira derivada e compatibilidade de outros modulos. A remocao de `part-06.js`, `part-17.js`, `part-18.js`, `part-19.js`, `part-20.js` ou `part-29.js` continua bloqueada ate busca completa de consumidores e regressao especifica.

Testes adicionados/atualizados comprovam que a tela ativa cria e edita registro de horas por controller/presenter/read model/gateway com mocks locais e idempotencia local em memoria, preservando rascunho quando ha erro ou resultado incerto. Nenhum Firebase real, deploy, push, regra financeira ou integracao externa foi usado.
