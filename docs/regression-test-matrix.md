# Matriz de testes de regressao

Gerado em: 2026-07-18

Escopo: execucao local em `http://127.0.0.1:5173`, com Vitest para dominio, builders, validacoes e servicos simulados; Playwright para comportamento de interface com Vite local; smoke para contratos globais e fluxos integrados com mocks em memoria. Nenhum teste deve criar, editar ou excluir dados no Firebase real.

## Observacao critica sobre mocks

Testes executados com mocks validam o comportamento esperado do frontend ou de um servico simulado, mas nao comprovam as permissoes reais definidas em firestore.rules. Regras de acesso, isolamento entre usuarios, usuario inativo, claims administrativas, colecoes compartilhadas e auditoria exigem testes com Firebase Emulator.

## Legenda de cobertura

- Coberto por Vitest unitario: regra pura, builder, selector ou normalizador sem Firebase real.
- Coberto por teste de servico com mock: servico exercitado contra dependencia simulada ou provider em memoria.
- Coberto por Playwright local: UI exercitada em Vite local com `window.dataSdk` mockado.
- Coberto por smoke: fluxo amplo ja coberto por `tests/smoke/smoke.mjs`.
- Coberto por Firebase Emulator: regra Firestore exercitada localmente com `@firebase/rules-unit-testing`, sem Firebase real.
- Depende de Firebase Emulator: precisa de Auth/Firestore/Rules reais em ambiente isolado.
- Sem cobertura: nao ha teste automatizado especifico ainda.
- Bloqueador para a proxima fase: nao deve migrar/refatorar sem cobrir antes.

## Matriz por area

| Area | Coberto por Vitest unitario | Coberto por teste de servico com mock | Coberto por Playwright local | Coberto por smoke | Cobertura Firebase Emulator / lacuna | Sem cobertura | Bloqueador para a proxima fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Autenticacao e criacao de conta | `tests/services/auth.test.js` normaliza erros | Perfil mockado em `tests/regression/high-risk-regression.test.js` | Nao | Login screen no smoke | Coberto por Firebase Emulator: usuario sem perfil, usuario inativo e perfil com status invalido nas Rules. Depende de Firebase Emulator/Auth: criacao real de conta e sessao | Fluxo real completo de cadastro | Nao para Rules; sim para Auth real antes de migrar cadastro |
| Navegacao | `tests/architecture/no-inline-html-handlers.test.js` e router coberto indiretamente | Nao | `tests/playwright/regression-local.spec.js` abre dashboard com mock | Smoke cobre `switchTab` e telas principais | Nao | Historico completo `goBackTab` | Nao |
| Dashboard e filtros | Selectors e tendencias em `tests/application/selectors` e `tests/regression` | Nao | Filtro por pessoa/mes em Playwright local | Smoke cobre graficos e cards | Nao para filtros locais; sim para dados reais multiusuario | Regressao visual detalhada por viewport | Nao |
| Saidas | Payloads e validacoes em `tests/domain/recordPayloads.test.js` e `tests/ui/recordFormValidation.test.js` | CRUD com `FinanceRepository` e provider em memoria | Nao especifico nesta etapa | Smoke cobre criar, editar, pagar, arquivar e excluir | Coberto por Firebase Emulator: leitura, criacao, edicao, exclusao, ownership e formato em `finance_records` | UI isolada de criacao/edicao fora smoke | Nao para Rules |
| Entradas | Consolidacao em `tests/domain/entries.test.js`, `tests/application/entries/entryConsolidation.test.js`, parametros tributarios em `tests/domain/taxes.test.js` e `tests/domain/taxParameters.test.js` | Nao | Nao especifico nesta etapa | Smoke cobre detalhe de entradas e descontos | Escrita real em entradas de usuario e `tax_parameters` cobertos por Rules | Cadastro visual completo com Emulator | Sim: bases de calculo antes de migrar |
| Parcelamentos | `tests/ui/dashboardInstallments.test.js` e `tests/regression` | Nao | `tests/playwright/integration-local-installments.spec.js` cria serie, paga parcela, recarrega e valida isolamento A -> B -> A com emuladores | Smoke cobre fixos mensais e regras percentuais | Coberto por Firebase Emulator: criacao e pagamento persistente de parcela propria ativa; negativos de Rules para owner/status/tipo/campos invalidos | Reversao de pagamento, edicao/exclusao de lote | Nao para criacao/pagamento; sim antes de migrar edicao/exclusao |
| Controle de horas | `tests/domain/hours.test.js`, `tests/domain/hourControlDryRun.test.js`, `tests/domain/hourPeriodSummary.test.js`, read model/controller modernos e `tests/regression` | Dry-run local sem escrita em `src/domain/hourControlDryRun.js` | Motor canonico, bridge global e UI ativa moderna em `tests/playwright/regression-local.spec.js` | Smoke cobre detalhe e edicao de horas | Rules de `controle_horas` aceitam contrato moderno e legado; persistencia real visual completa ainda depende de Emulator | Exclusao/detalhe real com Emulator | Nao |
| Planner | `tests/application/readModels/plannerReadModel.test.js` cobre filtros, read model, agrupamentos, resumo e detalhe por ID real; `tests/application/planner/plannerLocalEventStore.test.js` cobre chaves V2 por owner e legado V1 nao atribuido | `tests/ui/plannerController.test.js` cobre controller, eventos locais V2 e delegacao por `financialActions` injetado | `tests/playwright/regression-local.spec.js` abre o Planner ativo por lazy load, valida registros por ID real e isolamento local entre owners | Nao especifico | Coberto por mocks locais; Firebase Emulator continua necessario para autenticar troca real de usuarios fora do mock | Impacto final de feriados do Planner no DSR em fluxo real | Nao para Rules; sim antes de remover `part-26.js`/`part-27.js` |
| Importacao | Normalizadores em `tests/domain/imports.test.js`, duplicidade logica em `tests/regression`, parser XLSX em `tests/application/imports/spreadsheetImportParser.test.js` e batch idempotente em `tests/application/imports/importBatchUseCases.test.js` | `npm run import:dry-run` e `npm run import:xlsx-dry-run` usam repositorios em memoria e massa sintetica | Duplicidade XLSX em Playwright local confirma `createMany` e `source_channel=spreadsheet_import` | Smoke cobre importacao XLSX | Persistencia real e remocao por lote dependem de Emulator; batch canonico nao usa Firebase real nos testes | Importacao bancaria PDF/CSV completa via UI ainda parcial | Nao |
| Configuracoes | View models/validacoes parciais | Mock no smoke para pessoa/macro | Nao especifico nesta etapa | Smoke cobre pessoas e macros | Coberto por Firebase Emulator: `shared_macros`, `shared_categories` e `local_storage` nas Rules | UI real de shared collections com Emulator | Nao para Rules |
| Administracao de usuarios | Nao como regra pura | `userAdminService` mockado em `tests/regression` | Nao | Nao especifico | Coberto por Firebase Emulator: role/profile admin, owner equivalente, admin por claim independente com ou sem perfil ativo, bootstrap/recuperacao e bloqueio pessoal de usuario inativo nas proprias subcolecoes. Depende de Auth Emulator para emissao real de claims | UI admin com Emulator | Nao para Rules; sim para Auth/UI admin |
| Exportacao PDF | Selectors financeiros em `tests/application/selectors/financialSelectors.test.js` | Nao | Nao especifico nesta etapa | Smoke cobre exportacao sem erro | Nao para fonte local; sim se dados reais vierem de Firestore | Validacao do arquivo PDF gerado | Nao |

## Cobertura Firebase Emulator adicionada nesta etapa

Arquivo: `tests/firestore/firestore-rules.test.js`

- Usuario inativo nas Firestore Rules.
- Leitura, escrita e exclusao cruzadas entre usuarios.
- Permissoes de admin por perfil ativo, owner ativo e claim admin independente.
- Bootstrap e recuperacao por claim admin sem depender de perfil ativo.
- Bloqueio de admin inativo por perfil quando nao ha claim.
- Bloqueio de operacoes pessoais em subcolecoes proprias para usuario inactive ou sem perfil, mesmo com claim admin.
- `shared_macros`.
- `shared_categories`.
- `audit_logs`.
- `local_storage`.
- `finance_records`.
- Usuario sem perfil.
- Perfil com status invalido.

## Bloqueadores restantes para a proxima fase

Antes de migrar/refatorar fluxos que dependem de autenticacao real ou UI administrativa, criar cobertura adicional para:

- Criacao de conta com Firebase Auth Emulator.
- Sessao real do Firebase Auth ligada ao perfil Firestore.
- UI admin completa com Emulator.
- Emissao real de custom claims por ambiente confiavel no Auth Emulator ou script server-side local.
- Snapshots simultaneos multiusuario na interface.
- Persistencia visual completa de entradas, parcelamentos, controle de horas e importacao em ambiente emulado.

## Testes Vitest adicionados nesta etapa

Arquivo: `tests/regression/high-risk-regression.test.js`

| Nome do teste | Tipo | Risco coberto | Comportamento validado | Limitacao | Precisa Emulator? |
| --- | --- | --- | --- | --- | --- |
| `isolates cached records and synced local data when switching users` | Vitest unitario | Troca de usuario sem vazamento | Cache por UID e limpeza de chaves `finance-control-*` | Nao exercita snapshots Firestore reais | Sim, para isolamento real em Firestore |
| `keeps inactive user and admin permission decisions observable through mocked profile service` | Servico com mock | Usuario inativo e admin | `ensureProfile` preserva status e `updateUser` audita alteracoes | Mock nao valida Rules nem claims | Sim |
| `creates and edits an expense through the repository using an in-memory provider` | Servico com mock | Criacao/edicao de saida | `FinanceRepository` cria e atualiza saida com provider em memoria | Nao grava em Firestore real | Sim, para Rules de `finance_records` |
| `builds installments and marks a parcel as paid without changing sibling parcels` | Vitest unitario | Parcelamento e parcela paga | Builders criam parcelas e `buildPaidToggleRecord` marca uma parcela | Nao testa UI de lote | Nao obrigatorio, exceto persistencia real |
| `consolidates entries using work income for taxes while keeping other revenue visible separately` | Vitest unitario | Consolidacao de entradas | INSS/IRRF usam base de trabalho; outras receitas ficam separadas | Nao testa modal visual | Nao |
| `calculates overtime and time bank movements with deterministic values` | Vitest unitario | Hora extra e banco de horas | Valor de HE e saldo de banco de horas deterministico | Nao testa cadastro visual | Nao |
| `keeps dashboard filters restricted by month and person in monthly trend data` | Vitest unitario | Filtros do dashboard | Tendencia mensal respeita meses e pessoa filtrada | Usa fonte ja filtrada, nao DOM completo | Nao |
| `normalizes imported duplicate candidates to the same stable signature fields` | Vitest unitario | Importacao com duplicidade | Linhas equivalentes geram assinatura estavel | Nao executa leitor XLSX real | Nao |

## Testes Playwright adicionados nesta etapa

Arquivo: `tests/playwright/regression-local.spec.js`

| Nome do teste | Tipo | Risco coberto | Comportamento validado | Limitacao | Precisa Emulator? |
| --- | --- | --- | --- | --- | --- |
| `pending account notice keeps financial app hidden and clears local records` | Playwright local | Conta pendente sem flash de dados | UI mantem app financeiro oculto, mostra aviso de status e limpa registros locais | Usa `userAdminSdk` e `authSdk` mockados | Sim, para sessao Firebase real |
| `dashboard filters keep local mocked user data separated by person and month` | Playwright local | Dashboard/filtros e isolamento visual | Vite local em `127.0.0.1:5173`, `dataSdk` mockado, filtro por pessoa e competencia | Nao autentica usuario real | Sim, para dados reais multiusuario |
| `expense spreadsheet import does not recreate the same duplicated row` | Playwright local | Importacao duplicada | Segunda importacao XLSX nao recria a mesma saida | XLSX e dataSdk sao mocks | Sim, para persistencia real e Rules |
| `bank import preview commits through idempotent batch without duplicate records` | Playwright local | Preview/commit bancario idempotente | CSV padrao gera preview, commit usa `createMany`, marca linha como importada e desabilita novo commit | CSV, Auth e dataSdk sao mocks locais | Sim, para persistencia real e Rules |
| `canonical hour engine supports normal, night and invalid break scenarios in local app` | Playwright local | Controle de horas | Motor exposto no app calcula jornada normal, noturna, intervalo invalido e ignora metadados de telefone | Avalia motor via app mockado, nao cadastro real | Sim, para persistencia visual |
| `legacy global hour bridge delegates to canonical engine` | Playwright local | Bridges globais legadas | `parseTimeToMinutes`, `calcularHoras`, `calcularHoraExtra` e `calcularBancoHoras` delegam ao motor | Nao testa cliques do modal | Nao |
| `active hour-control UI uses modern controller presenter read model and gateway` | Playwright local | UI ativa de Controle de Horas | Lista, cria e edita lancamento por `hourControlController`, `hourControlPresenter`, `hourControlReadModel` e `ApplicationCommandGateway` | Dados e idempotencia sao mocks locais | Sim, para persistencia real |
| `active hour-control UI preserves form on error and uncertain result` | Playwright local | Resiliencia de mutacao de horas | Modal fica aberto e rascunho permanece em erro/resultado incerto | Gateway simulado localmente | Sim, para reconciliacao real |

## Testes de Planner adicionados em 03/09/2026

Arquivos:

- `tests/application/readModels/plannerReadModel.test.js`
- `tests/ui/plannerController.test.js`
- `tests/architecture/plannerModernization.test.js`

Cobertura adicionada:

- filtros puros por periodo, pessoa, tipo, status, macro, categoria e arquivamento;
- leitura de saidas, entradas, eventos locais e controle de horas persistidos;
- agrupamento por dia, semana e mes;
- resumo por valores persistidos;
- reconhecimento de metadados de parcelamento e recorrencia sem recalculo;
- detalhe por ID real, inclusive quando descricao/data/valor sao iguais;
- gravacao local de eventos manuais do Planner;
- delegacao de marcar pago, arquivar e excluir saida para `financialActions` injetado;
- lazy load apos `loadLegacyClassicScripts(globalThis)`;
- preservacao das bridges globais existentes sem nova API global top-level.
- Playwright local do Planner ativo com registros persistidos mockados e detalhe por ID real.

Lacunas:

- Playwright cobre cadastro local V2 e isolamento entre `uid-a` e `uid-b` no mesmo navegador.
- Impacto de feriados do Planner no DSR agora tem fonte owner-scoped, mas ainda precisa de teste especifico antes de remover `part-27.js`.
- Persistencia real e isolamento multiusuario seguem dependentes de Firebase Emulator, nao de Firebase real.

## Testes de isolamento do Planner adicionados em 04/09/2026

Coberturas novas:

- `tests/application/planner/plannerLocalEventStore.test.js` garante que eventos e feriados customizados exigem `ownerUid`, usam chaves V2 sem email/telefone bruto, isolam owner A/B e mantem V1 como legado nao atribuido.
- `tests/ui/plannerController.test.js` garante que o controller grava eventos locais no store V2 e delega mutacoes financeiras por dependencia injetada, sem depender de `window.financeApp.financialCrud`.
- `tests/architecture/plannerModernization.test.js` e `npm run planner-modernization:check` bloqueiam dependencia direta da UI moderna em `financeApp`, `financialCrud` e chaves V1 globais.
- `tests/playwright/regression-local.spec.js` valida no localhost que eventos locais e feriados customizados nao vazam entre dois owners simulados no mesmo navegador.

## Testes de importacao XLSX adicionados em 22/08/2026

- `tests/application/imports/spreadsheetImportParser.test.js`: valida parser puro de saidas, erros de parser visiveis e mapeamento de entradas suportadas.
- `tests/application/imports/importBatchUseCases.test.js`: valida que erros do parser bloqueiam persistencia e que assinaturas legadas XLSX viram `legacy_match`.
- `tests/playwright/regression-local.spec.js`: confirma que a mesma planilha XLSX importada duas vezes grava uma unica saida, usa `dataSdk.createMany` uma vez e persiste `source_channel=spreadsheet_import`.
- `npm run import:xlsx-dry-run`: cobre massa local com mesmo conteudo e nome diferente, linha invalida, duplicidade interna, registro legado ja importado, conflito de receipt e commit atomico de cinco candidatos prontos.

## Testes de backup e recuperacao adicionados em 23/08/2026

Arquivo: `tests/application/backup/financeBackupUseCases.test.js`

- 73 testes Vitest cobrem formato `FinanceBackupSnapshot`, sanitizacao de credenciais/telefone/arquivos brutos, checksum deterministico, isolamento por owner, validacao de versao/schema, duplicidade, tipo desconhecido, referencia orfa, migracao legada em memoria, prepare sem escrita, conflito, restore idempotente, snapshot pre-restore, rollback seletivo, auditoria resumida, dry-run e ausencia de DOM/window/Firebase Admin/WhatsApp/provider.
- `npm run backup:dry-run` executa fixtures sinteticas em memoria e confirma que checksum invalido, campo proibido, ID duplicado, versao futura, migracao legada, preview de restore e commit local nao tocam Firebase real.
- Lacuna intencional: restore real contra Firebase deve esperar Firebase Emulator/backend confiavel futuro e aprovacao operacional explicita.

## Testes de controle de horas adicionados em 21/08/2026

- `tests/domain/hours.test.js`: parser `HH:MM`, minutos inteiros, jornada normal, jornada atravessando meia-noite, virada de mes/ano, intervalos, HE, banco de horas, DSR, salario vigente, uso sem DOM/window e invariancia de `source_channel`.
- `tests/domain/hourControlDryRun.test.js`: dry-run deterministico com `wrote: false`, deteccao de jornada noturna antiga, divergencia de horas, divergencia de valor e possivel DSR duplicado.
- `tests/firestore/firestore-rules.test.js`: contrato moderno de `controle_horas`, legado aceito, campos canonicos invalidos rejeitados, pending/inactive preservados.
- `tests/playwright/regression-local.spec.js`: motor canonico disponivel no app local e bridge global delegando para o motor.

## Lacunas que exigem Firebase Emulator

- UI admin completa com Firebase Emulator, incluindo cliques reais em aprovar/desativar/reativar.
- Snapshots simultaneos de dois usuarios na interface.
- Cadastro visual completo com dados emulados para entradas, saidas, parcelamentos, controle de horas, planner e importacao.
- Emissao real de custom claims por ambiente confiavel no Auth Emulator ou script server-side local.

## Politica de autoridade administrativa

Politica adotada: **Politica A - Claim confiavel independente**.

Custom claim `admin: true` e autoridade administrativa emitida fora do cliente e pode servir para bootstrap e recuperacao. Role `admin` e role `owner` em `users/{uid}` continuam validos somente com `status=active`. O status `active` tambem controla o acesso comum do usuario as proprias subcolecoes; por isso, usuario `inactive` ou sem perfil nao recupera acesso pessoal aos proprios dados financeiros apenas por ter claim admin.

O backend futuro de chatbot/WhatsApp deve usar credencial server-side confiavel. Firebase Admin SDK server-side normalmente nao depende das Firestore Rules do cliente, mas isso nao autoriza abrir acesso publico nem simular claim no navegador. Nenhum codigo de chatbot foi implementado nesta etapa.

## Limpeza de dados

Vitest usa objetos em memoria e limpa estado por teste. Playwright injeta `window.dataSdk` mockado e remove registros do array `window.__regressionRecords` ao final de cada cenario. Nenhum fluxo desta etapa usa dados reais.

## Delta Fase 1.2 - ciclo de aprovacao e status de contas

Executado em: 2026-07-18

Arquivos de cobertura adicionados/atualizados:

- `tests/regression/high-risk-regression.test.js`: lifecycle puro, criacao de perfil `pending`, bloqueio de acesso financeiro antes de `active`, transicoes administrativas e auditoria de reativacao.
- `tests/firestore/firestore-rules.test.js`: criacao propria somente como `pending`; usuario `pending` sem acesso a `finance_records`, `local_storage` e `audit_logs`; admin aprova `pending -> active`; admin bloqueia `pending -> inactive`; `inactive -> pending` permanece negado.
- `tests/auth-flow/account-lifecycle-auth-flow.test.js`: Auth Emulator cria usuario real local, Firestore Emulator cria perfil `pending`, bloqueia escrita financeira, libera acesso apenas com perfil `active` sem tocar no Firebase real.

Fluxos locais cobertos nesta fase:

- Nova conta nasce `pending`.
- `pending` e `inactive` nao acessam dados financeiros.
- `active` acessa dados financeiros.
- Admin nao altera status para transicao invalida.
- Admin nao depende de auditoria de clique para registrar sucesso; o audit fica no servico apos update confirmado.
- UI evita exposicao do app antes da validacao de perfil e mostra aviso separado para conta pendente/inativa.

Compatibilidade futura com WhatsApp:

- Nenhum telefone, webhook, chatbot, Admin SDK ou mecanismo externo foi implementado.

## Rastreabilidade de contratos financeiros

| Risco | Cobertura local |
| --- | --- |
| Tipo financeiro desconhecido ou shape incoerente | `tests/domain/financeRecordContracts.test.js` e `tests/firestore/firestore-rules.test.js` |
| Owner/type alterados em update | Dominio, `dataSdk.referenceData.test.js` e Rules |
| Aliases legados e `schema_version` ausente | Dominio e dry-run em memoria |
| Metadata multicanal invalida | Dominio, Rules e Playwright local |
| Campos de telefone/WhatsApp em registros | Dominio e Rules |
| Persistencia invalida antes do Firestore | `tests/services/dataSdk.referenceData.test.js` |
| UI local sem campos tecnicos multicanal | `tests/playwright/regression-local.spec.js` |

## Rastreabilidade de parcelamentos

| Risco | Cobertura local |
| --- | --- |
| Soma divergente por centavos | `tests/domain/installmentSeries.test.js` e `tests/domain/recordPayloads.test.js` |
| Datas com overflow em dias 29, 30 e 31 | `tests/domain/installmentSeries.test.js` |
| `parent_id`, numeracao e total inconsistentes | Dominio, Rules e Playwright local |
| Lote parcial de parcelas | `tests/services/dataSdk.referenceData.test.js` e `tests/regression/high-risk-regression.test.js` |
| Clique duplicado | `tests/playwright/regression-local.spec.js` |
| Edicao de uma parcela afetar demais parcelas | `tests/regression/high-risk-regression.test.js` e Playwright local |
| Series legadas divergentes | `analyzeInstallmentSeries` e `docs/installment-reconciliation-plan.md` |
| Integracao futura sem DOM/telefone/canal paralelo | `tests/domain/installmentSeries.test.js` e `docs/installment-policy.md` |
- A regra documentada para integracao futura e: somente perfil `active` pode vincular identidade externa; `pending` e `inactive` devem ser rejeitados por backend confiavel.

## Rastreabilidade de recorrencias

| Risco | Cobertura local |
| --- | --- |
| Recorrencia anual criada implicitamente com 12 ocorrencias | `tests/domain/recurrenceSeries.test.js` e `tests/domain/recordPayloads.test.js` |
| Termino ausente ou duplicado | `tests/domain/recurrenceSeries.test.js` e `tests/ui/recordFormValidation.test.js` |
| Datas 28, 29, 30, 31, virada de ano e 29/02 anual | `tests/domain/recurrenceSeries.test.js` |
| `recurrence_series_id`, sequencia e total inconsistentes | Dominio, Rules e Playwright local |
| Lote parcial de recorrencia | `tests/playwright/regression-local.spec.js` valida chamada unica a `createManyRecords` com duplo submit |
| Preview de impacto antes de salvar | `tests/playwright/regression-local.spec.js` |
| Escopos amplos de edicao/exclusao simulados sem suporte | `tests/domain/recurrenceSeries.test.js` e UI com opcoes bloqueadas |
| Registros legados com `recurrence` | Dominio, Rules e dry-run |
| Dry-run sem escrita | `tests/domain/recurrenceSeries.test.js` |
| Parcelamentos continuam usando `parent_id` separado | `tests/domain/recordPayloads.test.js`, `tests/domain/installmentSeries.test.js` e Rules |

## Rastreabilidade do ciclo de contas

| Requisito | Arquivo de teste | Nome exato do teste | Tipo de teste | Ambiente | Comportamento comprovado | Limitacao | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| signup cria usuario no Auth Emulator | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `01 signup cria usuario no Auth Emulator` | Auth Flow | Auth Emulator 9099 | Usuario e email sao criados localmente | Nao testa UI de cadastro | Coberto |
| perfil inicial user/pending | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `02 cria perfil inicial user pending` | Auth + Firestore | Auth 9099, Firestore 8080 | `ensureProfile` cria `role=user` e `status=pending` | Auditoria de profile create mockada | Coberto |
| cliente nao cria active/admin/owner | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `03 cliente nao consegue criar perfil active`; `04 cliente nao consegue criar perfil admin`; `05 cliente nao consegue criar perfil owner` | Rules via Auth Flow | Auth 9099, Firestore 8080 | Cliente autenticado nao autoaprova nem autoeleva | Nao testa formulario visual | Coberto |
| conta active existente nao vira pending | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `06 conta active existente permanece active apos ensureProfile` | Auth + Firestore | Auth 9099, Firestore 8080 | Perfil existente `active` permanece `active` | Nao cobre todos os perfis legados sem status | Coberto |
| pending le o proprio perfil | `tests/firestore/firestore-rules.test.js` | `28 usuario cria somente o proprio perfil inicial` | Firestore Rules | Firestore 8080 | Perfil `pending` proprio pode ser criado; leitura propria e permitida por `isSelf` | Leitura explicita fica inferida pela regra de leitura propria | Coberto por Rules |
| pending nao acessa dados financeiros | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `08 pending nao acessa finance_records` | Auth + Firestore | Auth 9099, Firestore 8080 | `pending` nao le `finance_records` | Local storage/audit complementados nas Rules | Coberto |
| pending visualiza tela de aprovacao | `tests/playwright/regression-local.spec.js` | `pending account notice keeps financial app hidden and clears local records` | Playwright UI | Vite 5173 com mocks | Aviso fica visivel e app oculto | Mock de Auth/Firestore | Coberto UI local |
| pending consegue sair | `tests/playwright/regression-local.spec.js` | `pending account can refresh to active and can sign out` | Playwright UI | Vite 5173 com mocks | Botao sair chama `signOut` e volta para auth | Mock de Auth | Coberto UI local |
| pending verifica novamente o status | `tests/playwright/regression-local.spec.js` | `pending account can refresh to active and can sign out` | Playwright UI | Vite 5173 com mocks | Botao verificar chama `getProfile` e libera quando vira `active` | Mock de Firestore | Coberto UI local |
| admin aprova pending | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `09 admin por claim aprova pending` | Rules/Auth Flow | Firestore 8080 | Claim admin faz `pending -> active` | Claim local simulada por rules testing | Coberto |
| active acessa o app | `tests/playwright/regression-local.spec.js` | `active account shows financial app only after profile validation` | Playwright UI | Vite 5173 com mocks | App aparece depois da validacao | Mock de Auth/Firestore | Coberto UI local |
| admin desativa active | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `12 admin desativa active` | Rules/Auth Flow | Firestore 8080 | Admin faz `active -> inactive` | Claim local simulada | Coberto |
| inactive perde acesso | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `13 inactive perde acesso imediatamente` | Auth + Firestore | Auth 9099, Firestore 8080 | `inactive` nao le `finance_records` | Nao mede UI neste teste | Coberto |
| inactive limpa cache/estado | `tests/playwright/regression-local.spec.js` | `inactive account keeps app hidden, clears previous state and does not loop login` | Playwright UI | Vite 5173 com mocks | `allRecords` e cache anterior sao limpos | Mock de limpeza | Coberto UI local |
| inactive visualiza bloqueio | `tests/playwright/regression-local.spec.js` | `inactive account keeps app hidden, clears previous state and does not loop login` | Playwright UI | Vite 5173 com mocks | Mensagem de conta desativada aparece | Mock de Auth/Firestore | Coberto UI local |
| admin reativa inactive | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `14 admin reativa inactive` | Rules/Auth Flow | Firestore 8080 | Admin faz `inactive -> active` | Claim local simulada | Coberto |
| reativado volta ao app | `tests/auth-flow/account-lifecycle-auth-flow.test.js`; `tests/playwright/regression-local.spec.js` | `15 reativado recupera acesso`; `pending account can refresh to active and can sign out` | Auth Flow + UI local | Emulators e Vite 5173 | Acesso financeiro volta quando `active`; UI abre app apos refresh ativo | UI usa mock | Coberto |
| usuario comum nao altera status | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `16 usuario comum nao altera status` | Auth + Firestore | Auth 9099, Firestore 8080 | Update proprio de status falha | Nao testa botao inexistente | Coberto |
| usuario comum nao altera role | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `17 usuario comum nao altera role` | Auth + Firestore | Auth 9099, Firestore 8080 | Update proprio de role falha | Nao testa botao inexistente | Coberto |
| admin claim sem perfil recupera conta | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `18 admin por claim sem perfil aprova e recupera conta` | Rules/Auth Flow | Firestore 8080 | Claim admin sem perfil lista e atualiza perfil alvo | Claim local simulada | Coberto |
| role admin inactive nao administra | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `20 role admin inactive nao administra` | Firestore Rules | Firestore 8080 | Perfil admin inativo nao administra sem claim | Nao testa UI | Coberto |
| role admin active administra | `tests/auth-flow/account-lifecycle-auth-flow.test.js` | `19 role admin active administra` | Firestore Rules | Firestore 8080 | Perfil admin ativo administra | Nao testa UI real com emulator | Coberto |
| auditoria de aprovacao | `tests/regression/high-risk-regression.test.js` | `audits approval, deactivation and reactivation after successful profile updates` | Servico com mock | Vitest node | `admin.user_approve` apos update | Audit persistence real nao exercitada | Coberto por mock |
| auditoria de desativacao | `tests/regression/high-risk-regression.test.js` | `audits approval, deactivation and reactivation after successful profile updates` | Servico com mock | Vitest node | `admin.user_deactivate` apos update | Audit persistence real nao exercitada | Coberto por mock |
| auditoria de reativacao | `tests/regression/high-risk-regression.test.js` | `audits approval, deactivation and reactivation after successful profile updates` | Servico com mock | Vitest node | `admin.user_reactivate` apos update | Audit persistence real nao exercitada | Coberto por mock |
| auditoria de role | `tests/regression/high-risk-regression.test.js` | `audits role changes with before and after values` | Servico com mock | Vitest node | `admin.user_role_change` com before/after | Audit persistence real nao exercitada | Coberto por mock |
| falha nao gera sucesso | `tests/regression/high-risk-regression.test.js` | `does not write a success audit when the administrative update fails` | Servico com mock | Vitest node | Falha de update impede audit de sucesso | Nao usa Firestore real | Coberto por mock |
| nao ha flash do dashboard | `tests/playwright/regression-local.spec.js` | `active account shows financial app only after profile validation`; `pending account notice keeps financial app hidden and clears local records` | Playwright UI | Vite 5173 com mocks | App fica oculto ate perfil validado; pending nao chama `initSdk` | Mock de Auth/Firestore | Coberto UI local |
| clique duplicado nao gera duas operacoes | `tests/playwright/regression-local.spec.js` | `admin duplicate click and network error keep lifecycle UI safe` | Playwright UI | Vite 5173 com mocks | Duplo clique em Aprovar gera uma chamada | Mock de servico | Coberto UI local |
| erro de rede mantem estado seguro | `tests/playwright/regression-local.spec.js` | `admin duplicate click and network error keep lifecycle UI safe` | Playwright UI | Vite 5173 com mocks | Erro em update preserva usuario `pending` e botao visivel | Mock de servico | Coberto UI local |
| pending nao ve dados do usuario anterior | `tests/playwright/regression-local.spec.js` | `pending account notice keeps financial app hidden and clears local records` | Playwright UI | Vite 5173 com mocks | Registros e cache anterior sao removidos | Mock de limpeza | Coberto UI local |
| inactive nao ve dados do usuario anterior | `tests/playwright/regression-local.spec.js` | `inactive account keeps app hidden, clears previous state and does not loop login` | Playwright UI | Vite 5173 com mocks | Registros e cache anterior sao removidos | Mock de limpeza | Coberto UI local |

## Rastreabilidade de referencias globais e pessoais

| Requisito | Arquivo de teste | Tipo | Ambiente | Status |
| --- | --- | --- | --- | --- |
| Active le globais; pending/inactive nao leem | `tests/firestore/firestore-rules.test.js` | Rules | Firestore Emulator 8080 | Coberto |
| Usuario comum nao mantem global | `tests/firestore/firestore-rules.test.js`; `tests/playwright/regression-local.spec.js` | Rules + UI | Emulator e Vite 5173 | Coberto |
| Admin claim/perfil mantem global | `tests/firestore/firestore-rules.test.js`; `tests/playwright/regression-local.spec.js` | Rules + UI | Emulator e Vite 5173 | Coberto |
| Active cria macro/categoria pessoal | `tests/firestore/firestore-rules.test.js`; `tests/services/dataSdk.referenceData.test.js` | Rules + servico | Emulator e Vitest | Coberto |
| Referencias pessoais nao vazam | `tests/firestore/firestore-rules.test.js`; `tests/domain/referenceData.test.js` | Rules + dominio | Emulator e Vitest | Coberto |
| Escopo invalido/global no privado/personal no shared rejeitados | `tests/firestore/firestore-rules.test.js` | Rules | Firestore Emulator 8080 | Coberto |
| Combinacao deterministica, duplicidade e colisao | `tests/domain/referenceData.test.js` | Dominio | Vitest | Coberto |
| DataSdk roteia create/update/delete por escopo | `tests/services/dataSdk.referenceData.test.js` | Servico mockado | Vitest | Coberto |
| Defaults globais nao sao escritos por usuario comum | `tests/services/dataSdk.referenceData.test.js` | Servico mockado | Vitest | Coberto |
| Categoria em uso nao e excluida destrutivamente | `tests/services/dataSdk.referenceData.test.js`; `tests/playwright/regression-local.spec.js` | Servico + UI | Vitest e Vite 5173 | Coberto |
| Resolvedor preserva lancamento orfao | `tests/domain/referenceData.test.js` | Dominio | Vitest | Coberto |
| Dry-run nao altera dados e e idempotente | `tests/domain/referenceData.test.js` | Dominio | Vitest | Coberto |
| Readiness WhatsApp sem DOM/telefone/canal paralelo | `tests/domain/referenceData.test.js`; `docs/reference-data-policy.md` | Dominio + doc | Vitest | Coberto |

## Rastreabilidade de parametros tributarios

| Risco | Cobertura local |
| --- | --- |
| Tabelas atuais tratadas como oficiais sem fonte | `docs/tax-parameter-policy.md` e `tests/domain/taxes.test.js` |
| Sobreposicao de vigencia ativa | `tests/domain/taxParameters.test.js` |
| Calculo sem competencia explicita no motor puro | `tests/domain/taxes.test.js` |
| Outras receitas entrarem na base de INSS/IRRF | `tests/domain/entries.test.js` |
| Reconciliacao historica escrever dados | `tests/domain/taxes.test.js` com `dryRunTaxHistory` |
| Escrita indevida de `tax_parameters` | `tests/firestore/firestore-rules.test.js` casos 95 a 98 |

## Rastreabilidade da fronteira multicanal de aplicacao

| Risco | Cobertura local |
| --- | --- |
| Envelope aceitar ator/canal invalido ou canal WhatsApp inexistente | `tests/application/gateway/applicationGateway.test.js` |
| Resultado sem contrato padrao ou sem correlacao | `tests/application/gateway/applicationGateway.test.js` |
| Registry resolver handler por mecanismo dinamico inseguro | `tests/application/gateway/applicationGateway.test.js` e codigo em `src/application/gateway/handlerRegistry.js` |
| `source.channel` elevar privilegio | `tests/application/gateway/applicationGateway.test.js` |
| Payload substituir `owner_uid` autenticado | `tests/application/gateway/applicationGateway.test.js` |
| Pending/inactive executar comandos financeiros | `tests/application/gateway/applicationGateway.test.js` |
| Integracao sem contexto confiavel executar comando | `tests/application/gateway/applicationGateway.test.js` |
| Idempotencia duplicar criacao ou aceitar conflito de payload | `tests/application/gateway/applicationGateway.test.js` |
| Consumidor server-side simulado depender de DOM | `tests/application/gateway/applicationGateway.test.js` |
| `future_integration` alterar calculo financeiro | `tests/application/gateway/applicationGateway.test.js` |
| Piloto web de criacao de saida sair do caminho de repositorio normalizado | `tests/playwright/regression-local.spec.js` e `tests/application/gateway/applicationGateway.test.js` |
| Metadata operacional aceitar campos vazios/sensiveis ou alterar owner/calculo | `tests/application/gateway/idempotencyPersistence.test.js` |
| Fingerprint variar por ordem de chaves ou campos volateis | `tests/application/gateway/idempotencyPersistence.test.js` |
| IdempotencyRepository duplicar reserva, vazar owner/comando/origem ou permitir mutacao externa | `tests/application/gateway/idempotencyPersistence.test.js` |
| Gateway chamar handler em replay/conflito ou duplicar auditoria | `tests/application/gateway/idempotencyPersistence.test.js` |
| Series gerarem novas parcelas no replay | `tests/application/gateway/idempotencyPersistence.test.js` |
| Adapter Firebase Web reservar sem atomicidade | `tests/firestore/idempotency-repository-emulator.test.js` |
| Firestore Rules abrirem receipts para pending/inactive/outro owner/admin amplo | `tests/firestore/firestore-rules.test.js` casos 99 a 101 |

## Rastreabilidade da camada de repositorios

| Risco | Cobertura local |
| --- | --- |
| Interfaces importarem Firebase, DOM ou window | `tests/application/repositories/repositoryLayer.test.js` |
| Metodos obrigatorios ausentes | `tests/application/repositories/repositoryLayer.test.js` |
| In-memory vazar dados entre owners ou mutacao externa | `tests/application/repositories/repositoryLayer.test.js` |
| `createMany` deixar escrita parcial apos falha injetada | `tests/application/repositories/repositoryLayer.test.js` |
| FirebaseError chegar cru ao gateway/UI | `tests/application/repositories/repositoryLayer.test.js` |
| Runtime web usar in-memory por engano | `tests/application/repositories/repositoryLayer.test.js` e `docs/dependency-composition.md` |
| Handler instanciar repositorio diretamente | `tests/application/repositories/repositoryLayer.test.js` por injecao alternativa |
| Subscription vazar snapshot Firebase cru | `docs/repository-interface-reference.md` e `tests/application/repositories/repositoryLayer.test.js` |

## Rastreabilidade da camada de casos de uso

| Risco | Cobertura local |
| --- | --- |
| Use case importar DOM, window, Firebase ou provedor externo | `tests/application/useCases/financeRecordUseCases.test.js` |
| Pending/inactive executar operacao financeira direta | `tests/application/useCases/financeRecordUseCases.test.js` |
| Payload sobrescrever owner autorizado | `tests/application/useCases/financeRecordUseCases.test.js` |
| `source_channel` alterar regra financeira | `tests/application/useCases/financeRecordUseCases.test.js` |
| CreateExpense persistir/auditar fora de ordem | `tests/application/useCases/financeRecordUseCases.test.js` |
| UpdateExpense alterar owner/type/series metadata | `tests/application/useCases/financeRecordUseCases.test.js` |
| MarkExpenseAsPaid duplicar auditoria em replay | `tests/application/useCases/financeRecordUseCases.test.js` |
| Archive/Delete afetar serie inteira implicitamente | `tests/application/useCases/financeRecordUseCases.test.js` |
| CreateIncome misturar consolidacao tributaria | `tests/application/useCases/financeRecordUseCases.test.js` |
| Consolidacao usar competencia implicita ou mutar historico | `tests/application/useCases/financeRecordUseCases.test.js` |
| Parcelamento/recorrencia duplicar motor ou deixar parcial | `tests/application/useCases/financeRecordUseCases.test.js` |
| Horas duplicarem motor de jornada ou DSR | `tests/application/useCases/financeRecordUseCases.test.js` |
| Handlers voltarem a conter regra de negocio | `tests/application/useCases/financeRecordUseCases.test.js` |
| Backend futuro depender de telefone/canal externo | `tests/application/useCases/financeRecordUseCases.test.js` e `docs/use-case-layer-policy.md` |

## Rastreabilidade da migracao ES Modules do legado

| Risco | Cobertura local |
| --- | --- |
| Novo `eval`/`Function` fora do loader legado | `tests/architecture/no-new-eval.test.js` |
| Arquivo migrado continuar no loader classico | `tests/architecture/no-new-eval.test.js` e `scripts/analyze-legacy-loader.mjs` |
| `legacy-events` importar com side effect automatico | `tests/ui/legacyEventsModule.test.js` |
| Bridge `financeEvents` ausente ou sem delegacao | `tests/ui/legacyEventsModule.test.js` e `npm run smoke` |
| Bootstrap duplicar instalacao de eventos | `tests/ui/legacyEventsModule.test.js` e `npm run smoke` |
| Erro de ordem/ReferenceError no bootstrap | `npm run smoke` |
| APIs globais aumentarem apos migracao | `npm run inventory:globals` |

## Rastreabilidade da reducao de APIs globais

| Risco | Cobertura local |
| --- | --- |
| API global nova sem inventario | `tests/architecture/global-api-collisions.test.js` |
| Duplicacao global nao documentada | `tests/architecture/global-api-collisions.test.js` |
| Whitelist de duplicacao virar autorizacao generica | `tests/architecture/global-api-collisions.test.js` |
| `window.financeApp` expor installer sem consumidor | `tests/architecture/global-api-collisions.test.js` e `npm run smoke` |
| Bridge sobrescrever canonico silenciosamente | `tests/legacy/bridgeRegistry.test.js` |
| Bridge perder origem canonica | `tests/legacy/bridgeRegistry.test.js` |
| Backend futuro depender de global web | `tests/application/useCases/financeRecordUseCases.test.js`, `tests/application/repositories/repositoryLayer.test.js` e `docs/global-api-reduction-policy.md` |

## Rastreabilidade de importacoes idempotentes

| Risco | Cobertura local |
| --- | --- |
| Mesmo arquivo renomeado gerar novo lote | `tests/application/imports/importBatchUseCases.test.js` e `npm run import:dry-run` |
| Conteudo alterado manter fingerprint antigo | `tests/application/imports/importBatchUseCases.test.js` e `npm run import:dry-run` |
| Mesma linha externa duplicar no arquivo | `tests/application/imports/importBatchUseCases.test.js` |
| Mesmo identificador externo com payload diferente ser aceito | `tests/application/imports/importBatchUseCases.test.js` |
| Linha invalida bypassar contrato financeiro | `tests/application/imports/importBatchUseCases.test.js` |
| Importacao legada ser recriada | `tests/application/imports/importBatchUseCases.test.js` por `import_signature` |
| Receipt existente com fingerprint diferente ser ignorado | `tests/application/imports/importBatchUseCases.test.js` |
| Commit persistir linhas duplicadas ou invalidas | `tests/application/imports/importBatchUseCases.test.js` |
| Replay de batch recriar registros | `tests/application/imports/importBatchUseCases.test.js` |
| Lote grande demais iniciar escrita parcial | `tests/application/imports/importBatchUseCases.test.js` |
| Falha de `createMany` deixar registro parcial | `tests/application/imports/importBatchUseCases.test.js` |
| Dry-run tocar Firebase real | `npm run import:dry-run` retorna `firebase_touched=false` e `wrote=false` |
| UI bancaria duplicar por segundo clique | `tests/playwright/regression-local.spec.js` verifica commit via `createMany` uma vez e botao desabilitado apos importar |

Lacunas: UI bancaria PDF/CSV completa, migracao total do fluxo XLSX legado para os novos casos de uso e reversao persistente exigem etapa futura com Firebase Emulator.

## Rastreabilidade da materializacao percentual

| Risco | Cobertura local |
| --- | --- |
| Percentual ambiguo ser convertido silenciosamente | `tests/domain/percentage-rules.test.js` |
| Calculo depender de DOM/window | `tests/domain/percentage-rules.test.js` |
| Occurrence key/ID colidir por owner, regra, pessoa ou competencia | `tests/domain/percentage-rules.test.js` |
| Segunda execucao duplicar saidas | `tests/application/percentageRuleMaterializationUseCases.test.js` |
| Duas ou tres execucoes concorrentes no Firestore criarem saidas duplicadas | `tests/firestore/percentage-rule-materialization-concurrency.test.js` |
| Ocorrencia paga ou editada ser sobrescrita | `tests/application/percentageRuleMaterializationUseCases.test.js` |
| Regra inativa/fora de vigencia criar ocorrencia | `tests/application/percentageRuleMaterializationUseCases.test.js` |
| Dry-run tocar Firebase real | `npm run percentage-rules:dry-run` retorna `wrote=false` |
| Renderizacao disparar escrita percentual | `schedulePercentageExitMaterialization` nao grava; materializacao explicita usa runner/use case |
| `percentage_rule_materialization` virar `source_channel` indevido | `tests/firestore/percentage-rule-materialization-concurrency.test.js` valida novos writes com `source_channel=system` |
| Crash entre `createIfAbsent` e `receipt.complete` bloquear retry | `tests/firestore/percentage-rule-materialization-concurrency.test.js` usa `afterCreateBeforeReceiptComplete` e valida `RECONCILED_EXISTING` |
| Retry concorrente apos receipt orfao duplicar saida/auditoria | `tests/firestore/percentage-rule-materialization-concurrency.test.js` dispara dois retries concorrentes |
| Documento deterministico incompativel ser aceito como replay | `tests/firestore/percentage-rule-materialization-concurrency.test.js` retorna `CONFLICT` e preserva receipt `processing` |

Cobertura real adicionada: `tests/firestore/percentage-rule-materialization-concurrency.test.js` executa o use case real com `FirebaseFinanceRecordRepository`, `FirebaseWebIdempotencyRepository`, `FirebaseAuditRepository` e Firestore Emulator. O teste comprova 2 e 3 execucoes concorrentes, retry posterior, preservacao de ocorrencia paga, preservacao de ocorrencia editada, crash controlado apos create, reconciliacao do receipt orfao, dois retries concorrentes seguros, conflito com entidade incompativel, receipt unico e uma unica auditoria financeira de criacao.
## Cobertura de auditoria canonica

| Fluxo | Teste | Ambiente | Resultado esperado | Lacuna |
| --- | --- | --- | --- | --- |
| Contrato `AuditEvent` | `tests/application/audit/auditTrail.test.js` | Vitest local | Campos obrigatorios, taxonomia e aliases legados preservados | Nao prova inviolabilidade server-side |
| Saneamento | `tests/application/audit/auditTrail.test.js` | Vitest local | Campos sensiveis removidos e snapshots truncados | Rules validam apenas topo do documento |
| Falha de auditoria | `tests/application/audit/auditTrail.test.js` e use cases financeiros | Vitest local | Falha fica observavel sem rollback falso | Backend futuro deve reprocessar alertas |
| Query administrativa | `tests/application/audit/auditTrail.test.js` | Repositorio em memoria | Consulta por id, correlacao, entidade, dono e seguranca | Adapter Firebase web depende de facade futura |
| Rules append-only | `tests/firestore/firestore-rules.test.js` | Firestore Emulator | Create proprio valido, update/delete negados, formato invalido rejeitado | Necessita Emulator |
| Dry-run | `npm run audit:dry-run` | Node local | `wrote=false`, fixtures validas/invalidas e saneadas | Nao escreve em Firestore |
# Atualizacao de performance - 23/08/2026

Novos testes locais adicionados em `tests/application/repositories/paginationPerformance.test.js`.

Cobertura:

- paginacao por cursor em registros financeiros;
- limite maximo de pagina;
- filtro combinado com pagina;
- ordenacao estavel;
- isolamento por owner;
- bloqueio de acesso cruzado;
- paginacao de auditoria administrativa;
- paginacao de usuarios;
- unsubscribe individual;
- `unsubscribeAll` por owner;
- unsubscribe sincrono em composicao web lazy;
- ausencia de dependencia DOM/browser nos helpers de paginacao.

Scripts complementares:

- `npm run performance:baseline`
- `npm run bundle:budget`
- `npm run dashboard:benchmark`
- `npm run import:benchmark`
- `npm run backup:benchmark`

## Rastreabilidade corretiva de performance e Firestore

| Risco | Cobertura local |
| --- | --- |
| `audit_logs` voltar para `getAll -> slice` quando ha `db` | `tests/firestore/firestore-pagination-emulator.test.js` e `tests/architecture/firestore-pagination-contract.test.js` |
| `idempotency_receipts` nao ter paginação server-side | `tests/firestore/firestore-pagination-emulator.test.js` e `tests/architecture/firestore-pagination-contract.test.js` |
| Administracao de usuarios carregar lista completa para paginar | `tests/firestore/firestore-pagination-emulator.test.js` |
| Cursor vazar snapshot Firebase, owner ou id interno | `tests/firestore/firestore-pagination-emulator.test.js` e `npm run firestore:pagination:benchmark` |
| Dashboard calcular KPI usando somente primeira pagina | `tests/application/performance/dashboardDatasetIntegrity.test.js` |
| Troca de owner manter listener antigo ativo | `tests/application/performance/subscriptionLifecycleRuntime.test.js` |
| Benchmark tocar producao | `npm run dashboard:benchmark`, `npm run import:benchmark`, `npm run backup:benchmark` e `npm run firestore:pagination:benchmark` retornam `wrote=false` |

Lacunas: `finance_records` historicos ainda dependem da facade/cache web existente. KPIs do dashboard permanecem intencionalmente sobre dataset completo autorizado. `import_batches` nao existe como colecao persistida atual.

## Cobertura de resiliencia e erros

| Risco | Cobertura local |
| --- | --- |
| `ApplicationError` invalido ou nao serializavel | `tests/application/resilience/errorResilience.test.js` |
| Categoria/severidade/codigo obrigatorio regredirem | `tests/application/resilience/errorResilience.test.js` |
| Detalhes vazarem senha, token ou telefone | `tests/application/resilience/errorResilience.test.js` |
| Firebase `permission-denied` chegar cru na UI | `tests/application/resilience/errorResilience.test.js` |
| Firebase `unavailable`/`deadline-exceeded` sem categoria transitoria | `tests/application/resilience/errorResilience.test.js` |
| Retry de query em rede/timeout quebrar limite | `tests/application/resilience/errorResilience.test.js` |
| Mutacao sem `idempotencyKey` receber retry automatico | `tests/application/resilience/errorResilience.test.js` |
| Mutacao idempotente trocar `idempotencyKey` no retry | `tests/application/resilience/errorResilience.test.js` |
| Loop infinito de retry | `tests/application/resilience/errorResilience.test.js` |
| Aplicacao acessar `navigator.onLine` fora do adapter | `tests/architecture/resilience-architecture.test.js` |
| `ConnectivityService` nao notificar/limpar listeners | `tests/application/resilience/errorResilience.test.js` |
| `AsyncViewState` perder loading/empty/error/stale/offline | `tests/application/resilience/errorResilience.test.js` |
| `ErrorReporter` enviar ou reter dados sensiveis | `tests/application/resilience/errorResilience.test.js` e `tests/architecture/resilience-architecture.test.js` |
| Dashboard nao expor loading/error/retry local | `tests/playwright/regression-local.spec.js` |
| Importacao perder preview em falha | `tests/playwright/regression-local.spec.js` |
| Lazy load quebrar app shell | `tests/playwright/regression-local.spec.js` |
| Offline simulado mostrar sucesso falso | `tests/playwright/regression-local.spec.js` |
| Retorno online nao permitir retry seguro | `tests/playwright/regression-local.spec.js` |
| Formulario perder dados apos falha de mutacao sem idempotencia | `tests/playwright/regression-local.spec.js` |

Lacunas: a etapa nao substitui todos os catches legados nem implementa fila offline. Fluxos completos de restauracao, importacao real de arquivos grandes e confirmacao perdida apos commit exigem cenarios adicionais com Firebase Emulator e, futuramente, backend confiavel.

## Cobertura de reconciliacao pos-commit

| Risco | Cobertura local |
| --- | --- |
| Resposta perdida depois de receipt completed duplicar saida | `tests/application/resilience/postCommitReconciliation.test.js`, `tests/playwright/regression-local.spec.js` e `tests/firestore/post-commit-reconciliation-emulator.test.js` |
| Entrada ou apontamento de horas duplicar apos timeout visual | `tests/application/resilience/postCommitReconciliation.test.js` |
| Parcelamento/recorrencia duplicar lote | `tests/application/resilience/postCommitReconciliation.test.js` e `tests/firestore/post-commit-reconciliation-emulator.test.js` |
| Importacao repetir batch | `tests/application/resilience/postCommitReconciliation.test.js` e `npm run post-commit:dry-run` |
| Mutacao sem chave receber retry automatico | `tests/application/resilience/postCommitReconciliation.test.js` |
| Payload alterado ser aceito como replay | `tests/application/resilience/postCommitReconciliation.test.js` |
| UI perder rascunho ao entrar em estado incerto | Piloto de entradas/saidas em `src/legacy/inline/part-03.js` e Playwright local |

Lacunas: atualizacao, marcar como pago, arquivar e excluir ainda exigem matriz propria antes de ativar reconciliacao visual. O teste Emulator desta etapa usa Firestore real apenas para receipts no Emulator; registros e auditoria ficam em memoria para nao tocar producao.

## Cobertura de modernizacao do CRUD financeiro

| Risco | Cobertura local |
| --- | --- |
| Criacao de saida ignorar `ApplicationCommandGateway` no caminho autenticado | `tests/ui/financialCrudControllers.test.js` e `tests/playwright/regression-local.spec.js` |
| Edicao, pago, arquivar ou excluir voltarem a nao ter comando canonico | `tests/ui/financialCrudControllers.test.js` |
| Criacao de entrada misturar calculos fiscais ou de jornada no controller | `tests/ui/financialCrudControllers.test.js` e `tests/architecture/financialCrudModernization.test.js` |
| Controller modular acessar `window`, Firebase ou `dataSdk` | `tests/architecture/financialCrudModernization.test.js` e `npm run crud-modernization:check` |
| Estado incerto perder tentativa idempotente segura | `tests/ui/financialCrudControllers.test.js` |
| Bridge criar nova API global de topo | `tests/architecture/financialCrudModernization.test.js`, `tests/playwright/regression-local.spec.js` e inventario de globais |
| Remocao prematura de `part-03.js` quebrar handlers legados | `docs/financial-crud-modernization-diagnostic.md` e `npm run crud-modernization:check` |

Lacunas: desmarcar pago e reabrir arquivado continuam no fallback legado porque os use cases atuais sao comandos explicitos de marcar pago e arquivar. Edicao de entrada ainda permanece no legado nesta etapa. Testes com Firestore Emulator continuam necessarios para validar permissao e persistencia real dos comandos migrados sem tocar producao.

## Cobertura de Dashboard e read models

| Risco | Cobertura local |
| --- | --- |
| Read model depender de DOM, `window`, Firebase ou canal externo | `tests/architecture/dashboardReadModelModernization.test.js` e `npm run dashboard-modernization:check` |
| Input de registros ser mutado durante filtros/agregacoes | `tests/application/readModels/dashboardReadModel.test.js` |
| Output variar para a mesma massa deterministica | `tests/application/readModels/dashboardReadModel.test.js` |
| KPI usar pagina parcial de listagem | `tests/application/readModels/dashboardReadModel.test.js` e `tests/application/performance/dashboardDatasetIntegrity.test.js` |
| Arquivado ou cancelado entrar em KPI ativo | `tests/application/readModels/dashboardReadModel.test.js` |
| `source_channel` alterar calculo ou filtro | `tests/application/readModels/dashboardReadModel.test.js` |
| Filtros por periodo, pessoa e macro divergirem por ordem | `tests/application/readModels/dashboardReadModel.test.js` |
| Builders de graficos conterem regra visual/Chart.js | `tests/application/readModels/dashboardReadModel.test.js` e `tests/architecture/dashboardReadModelModernization.test.js` |
| Saidas/Entradas paginarem sem preservar detalhe por `id` | `tests/application/readModels/financialListReadModels.test.js` |
| Dados de owner A vazarem quando fonte ja esta escopada para owner B | `tests/application/readModels/financialListReadModels.test.js` |
| Dashboard controller duplicar subscriptions ou nao limpar listeners | `tests/ui/dashboardController.test.js` |
| Estados loading, success, empty, error e offline regredirem | `tests/ui/dashboardController.test.js` |

Lacunas: o adapter legado `dashboardData.js` ainda le DOM/`window` por compatibilidade. A validacao completa com listeners reais do Dashboard continua exigindo Firestore Emulator antes de remover `part-03.js`, `part-16.js` ou `part-29.js`.

## Cobertura de modernizacao da UI de Controle de Horas

| Risco | Cobertura local |
| --- | --- |
| Read model de horas depender de DOM, `window`, Firebase, `dataSdk` ou canal externo | `tests/architecture/hourControlModernization.test.js` e `npm run hour-control-modernization:check` |
| Input de horas ser mutado durante filtros/agregacoes | `tests/application/readModels/hourControlReadModel.test.js` |
| Filtros por competencia, periodo, pessoa, status, tipo e busca divergirem por ordem | `tests/application/readModels/hourControlReadModel.test.js` |
| `source_channel` alterar calculo, filtro ou resumo | `tests/application/readModels/hourControlReadModel.test.js` |
| Salario vigente ser resolvido fora do motor canonico | `tests/application/readModels/hourControlReadModel.test.js` valida uso de `ResolveEffectiveSalary` pelo read model |
| Banco de horas e horas extras duplicarem regra agregada | `tests/application/readModels/hourControlReadModel.test.js` compara com `buildHourPeriodSummary` |
| UI moderna criar ou editar horas sem passar pelo `ApplicationCommandGateway` | `tests/ui/hourControlController.test.js` |
| Duplo clique em create/update disparar comandos concorrentes para a mesma tentativa | `tests/ui/hourControlController.test.js` |
| Resposta incerta pos-commit perder contexto de reconciliacao | `tests/ui/hourControlController.test.js` |
| Subscription de Controle de Horas vazar entre owners/telas | `tests/ui/hourControlController.test.js` |

Lacunas: `src/legacy/inline/part-06.js` continua responsavel pelo formulario visual real e pela criacao da entrada financeira derivada de hora extra. A ativacao completa do controller moderno no fluxo visual deve esperar regressao especifica com Firebase Emulator para cadastro/edicao real de `controle_horas`, entrada derivada de HE, preview DSR, fechamento de modal, cache global e consumidores das bridges legadas.

## Cobertura de bundle governance 5.4B

| Risco | Cobertura local |
| --- | --- |
| Budget de Entry JS ser aumentado para acomodar feature | `scripts/bundle-budget.mjs`, `docs/bundle-budget-baseline.json` e `docs/bundle-budget-governance-diagnostic.md` |
| Controle de Horas moderno voltar para import eager no bootstrap | `tests/architecture/hourControlModernization.test.js` e `npm run bundle:budget` |
| Chunk ativo de Controle de Horas reaparecer no entry | `npm run bundle:budget` valida evidencias estaveis, sem depender do hash do chunk |
| Navegar para Controle de Horas deixar de instalar controller/presenter/read model modernos | `tests/playwright/regression-local.spec.js` |
| Lazy load de Controle de Horas falhar e quebrar a shell | `tests/playwright/regression-local.spec.js` |
| Navegacao repetida duplicar handlers ou grupos visuais | `tests/playwright/regression-local.spec.js` |
| Parcelamentos permanecer no bootstrap inicial apesar de ser tela secundaria | `npm run bundle:budget` e `docs/bundle-analysis.md` acompanham o chunk assincrono |

Lacunas: a verificacao de carregamento antecipado e feita por estado observavel de instalacao e evidencias de bundle, nao por instrumentacao de rede em producao. Testes com Firebase real nao foram executados nem sao permitidos nesta etapa.

## Cobertura de modernizacao de Configuracoes

| Risco | Cobertura local |
| --- | --- |
| Read model de Configuracoes depender de DOM, `window`, Firebase, `dataSdk` ou canal externo | `tests/architecture/settingsModernization.test.js` e `npm run settings-modernization:check` |
| Input ser mutado ou output variar para a mesma massa deterministica | `tests/application/readModels/settingsReadModel.test.js` |
| Referencia pessoal de outro owner aparecer na tela | `tests/application/readModels/settingsReadModel.test.js` e `tests/playwright/regression-local.spec.js` |
| Usuario comum manter referencia global pela UI | `tests/playwright/regression-local.spec.js` |
| Usuario comum criar macro/categoria como global sem autorizacao | `tests/playwright/regression-local.spec.js` |
| Admin criar referencia global sem escolha explicita | `tests/playwright/regression-local.spec.js` valida selecao explicita de escopo |
| Erro/duplicidade de salvamento exibir sucesso falso | `tests/playwright/regression-local.spec.js` |
| Lazy loader de Configuracoes voltar a import eager ou aumentar budget | `tests/architecture/settingsModernization.test.js`, `npm run settings-modernization:check` e `npm run bundle:budget` |

Lacunas: tipos de H.E., importacoes, historico e parametros tributarios ainda dependem de renderizadores legados complementares. Validacao com Firestore Emulator continua necessaria antes de remover bridges, mover persistencia compartilhada ou substituir `part-03.js`, `part-09.js`, `part-16.js` e `part-29.js`.

## Cobertura corretiva de Configuracoes 5.6A

| Risco | Cobertura local |
| --- | --- |
| Usuario comum pedir `global` e o sistema converter silenciosamente para `personal` | `tests/application/settings/referenceWriteScope.test.js`, `tests/ui/settingsWebAdapter.test.js` e `tests/playwright/regression-local.spec.js` |
| Escopo omitido virar `global` por acidente para admin | `tests/application/settings/referenceWriteScope.test.js` e `tests/ui/settingsWebAdapter.test.js` |
| Repository receber write global nao autorizado | `tests/ui/settingsWebAdapter.test.js` |
| UI comum oferecer seletor global habilitado | `tests/playwright/regression-local.spec.js` |
| Referencia global aparecer editavel para usuario comum | `tests/playwright/regression-local.spec.js` |
| Owner spoofing por payload de categoria | `tests/ui/settingsWebAdapter.test.js` |
| Codigo settings-only voltar ao bootstrap | `tests/architecture/settingsModernization.test.js`, `npm run settings-modernization:check` e `npm run bundle:budget` |

Lacunas: a persistencia real de referencias compartilhadas continua exigindo Firebase Emulator/Rules antes de remover bridges legadas ou alterar colecoes compartilhadas. Nenhum teste desta etapa usa Firebase de producao.

## Cobertura de Administracao de Usuarios

| Risco | Cobertura local |
| --- | --- |
| Claim admin sem perfil perder autoridade de recuperacao | `tests/application/userAdmin/userAdminPermissions.test.js` |
| Admin por perfil inativo continuar administrando | `tests/application/userAdmin/userAdminPermissions.test.js` |
| Usuario comum receber acoes administrativas | `tests/application/readModels/userAdminReadModel.test.js` e `tests/playwright/regression-local.spec.js` |
| Proprio admin alterar role/status pela UI | `tests/application/readModels/userAdminReadModel.test.js` e `tests/playwright/regression-local.spec.js` |
| Lista misturar status/role/filtro de busca | `tests/application/readModels/userAdminReadModel.test.js` e `tests/playwright/regression-local.spec.js` |
| Duplo clique gerar duas mutacoes administrativas | `tests/ui/userAdminController.test.js` e `tests/playwright/regression-local.spec.js` |
| Erro de rede mostrar sucesso falso | `tests/ui/userAdminController.test.js` e `tests/playwright/regression-local.spec.js` |
| UI admin moderna voltar a import eager ou Firebase direto | `tests/architecture/userAdminModernization.test.js` e `npm run user-admin-modernization:check` |

Lacunas: busca textual global indexada, indices compostos de `users` e fluxo visual completo com Auth/Firestore reais devem ser validados no Firebase Emulator antes de qualquer alteracao em producao. Nenhum teste desta etapa usa Firebase de producao.

## Cobertura de queries administrativas de usuarios

| Risco | Cobertura local |
| --- | --- |
| Listagem admin paginada cair em scan completo | `npm run user-admin:query-check` e `tests/firestore/user-admin-queries-emulator.test.js` |
| Filtros `status`, `role` e `status+role` divergirem do server-side | `tests/firestore/user-admin-queries-emulator.test.js` |
| Cursor expor snapshot Firebase ou dado cru | `tests/firestore/user-admin-queries-emulator.test.js` e `npm run user-admin:query-check` |
| `pageSize` ignorar maximo do contrato | `tests/firestore/user-admin-queries-emulator.test.js` |
| UI prometer full-text inexistente | `tests/playwright/regression-local.spec.js` valida placeholder "Buscar na pagina" |
| Botao anterior/proxima duplicar itens visualmente | `tests/playwright/regression-local.spec.js` e `tests/ui/userAdminController.test.js` |

Lacuna remanescente: busca global por nome/email exige backend/provider/indice dedicado futuro; nao foi implementada nesta fase.

## Cobertura E2E local de Administracao de Usuarios - 19/09/2026

- `tests/playwright/integration-local-user-admin.spec.js` homologa a UI real de Administracao de Usuarios com Vite, Auth Emulator e Firestore Emulator em `http://127.0.0.1:5178`.
- A jornada cobre usuario comum ativo sem painel admin, recusa de `listUsers`, recusa de `updateUser`, bloqueio direto pelas Firestore Rules e ausencia de elevacao por payload client-side.
- A jornada cobre usuarios pending e inactive: ambos autenticam no Auth Emulator, mas ficam bloqueados na tela de acesso e nao conseguem acionar operacoes administrativas.
- A jornada positiva usa admin autorizado por perfil ativo em Firestore, conforme politica atual, sem emitir custom claim pelo cliente.
- A listagem admin cobre pagina de 50 registros, proxima/anterior, ausencia de duplicidade entre paginas, filtros server-side por status, role e status+role, reset de filtros e busca explicitamente page-local.
- A UI comprova ausencia de vazamento financeiro: registro privado de outro usuario nao aparece no DOM nem em `window.allRecords`.
- Confirmado: cliente nao expoe setter de custom claims, nao importa Firebase Admin SDK e token/claims nao recebem `admin`, `role` ou `status` criados pelo cliente.
- `playwright.e2e-local.config.js` inclui `integration-local-user-admin.spec.js` na suite local emulada completa.
- Lacunas: emissao real de custom claims segue dependente de backend/Admin SDK confiavel futuro; busca global por nome/email segue fora do escopo; edicoes positivas completas por UI podem receber cenario dedicado se a politica administrativa mudar.

## Cobertura de modernizacao da UI de Importacao

| Risco | Cobertura local |
| --- | --- |
| Read model de preview depender de DOM, `window`, Firebase, `dataSdk` ou mutar input | `tests/application/readModels/importPreviewReadModel.test.js` e `npm run import-ui-modernization:check` |
| UI XLSX duplicar regra de parser, fingerprint ou deduplicacao | `tests/ui/importController.test.js`, `tests/application/imports/importBatchUseCases.test.js` e `npm run import:xlsx-dry-run` |
| Preview misturar prontos, invalidos, duplicados, conflitos e ignorados | `tests/application/readModels/importPreviewReadModel.test.js` e `tests/playwright/regression-local.spec.js` |
| Commit persistir linha por linha ou fora de `CommitImportBatch` | `tests/ui/importController.test.js` e `npm run import-ui-modernization:check` |
| Clique duplo/replay duplicar importacao | `tests/ui/importController.test.js` e `tests/playwright/regression-local.spec.js` |
| Erro de lazy-load ou commit apagar preview desnecessariamente | `tests/ui/importController.test.js` |
| Troca de usuario reutilizar batch/preview anterior | `tests/ui/importController.test.js` e `tests/playwright/regression-local.spec.js` |
| UI ativa ou parser XLSX voltar ao entry | `npm run bundle:budget` e `npm run import-ui-modernization:check` |

Lacunas: importacao bancaria/CSV visual completa e historico/remocao de lotes permanecem no renderer legado e exigem cenarios adicionais antes de qualquer remocao. Persistencia real, Rules e Auth devem continuar sendo validadas apenas com Firebase Emulator, nunca em producao.
## Cobertura de modernizacao da UI de Backup/Restore

| Risco | Cobertura local |
| --- | --- |
| Read model de backup ou restore depender de DOM, `window`, Firebase, `dataSdk` ou mutar input | `tests/application/readModels/backupRestoreReadModels.test.js` e `npm run backup-ui-modernization:check` |
| Backup exportar dados de outro owner | `tests/application/readModels/backupRestoreReadModels.test.js`, `tests/ui/backupController.test.js` e Playwright local |
| Nome de arquivo vazar UID, email, telefone ou WhatsApp | `tests/ui/backupController.test.js` e Playwright local |
| Arquivo invalido, versao futura ou checksum divergente permitir restore | `tests/ui/backupController.test.js`, `tests/application/backup/financeBackupUseCases.test.js` e Playwright local |
| Restore dry-run executar escrita real | `tests/ui/backupController.test.js`, `npm run backup:dry-run`, `npm run backup:benchmark` e `npm run backup-ui-modernization:check` |
| `CommitFinanceRestore` ou rollback entrar na UI client-side | `npm run backup-ui-modernization:check` |
| Troca de usuario reutilizar preview antigo | `tests/ui/backupController.test.js` e Playwright local |
| UI ativa de Backup/Restore voltar ao entry | `npm run bundle:budget` e `npm run backup-ui-modernization:check` |
| Cache local JSON reintroduzir senha, token, telefone ou raw file no snapshot | `tests/application/backup/financeBackupUseCases.test.js` e `tests/playwright/integration-local-backup-restore.spec.js` |
| Dry-run com Auth/Firestore Emulator alterar registros financeiros | `tests/playwright/integration-local-backup-restore.spec.js` compara IDs, valores e status antes/depois no Firestore Emulator |
| Snapshot do usuario A ser aceito pelo usuario B | `tests/playwright/integration-local-backup-restore.spec.js` valida `OWNER_REFERENCE_MISMATCH` na UI real emulada |

Atualizacao 6.6: `tests/playwright/integration-local-backup-restore.spec.js` homologou Backup e Restore dry-run com Vite, Auth Emulator e Firestore Emulator em `http://127.0.0.1:5178`. A jornada baixa o JSON real, valida checksum/versao/schema/owner, bloqueia snapshot adulterado, prova isolamento A -> B -> A, confirma restore real indisponivel e comprova zero mutacao em `finance_records` apos dry-run. `docs/backup-restore-local-homologation.md` registra a execucao.

Lacunas: restore real, snapshot pre-restore server-side e rollback operacional continuam bloqueados ate backend confiavel futuro e aprovacao operacional explicita. Nenhum teste desta etapa usa Firebase de producao.

## Cobertura E2E local de Configuracoes e Referencias - 18/09/2026

- `tests/playwright/integration-local-settings-references.spec.js` homologa a UI real de Configuracoes com Vite, Auth Emulator e Firestore Emulator em `http://127.0.0.1:5178`.
- A jornada cobre configuracao pessoal de A, reload, reversao sem duplicidade, bloqueio cross-user, troca A -> B -> A no mesmo navegador e configuracao pessoal propria de B.
- A mesma spec cobre leitura de `shared_macros` e `shared_categories` por usuario comum ativo, ausencia de botao de edicao global, tentativa manipulada de escrita `global`, recusa por `SETTINGS_SHARED_REFERENCE_FORBIDDEN`, zero fallback para referencia pessoal e dado invalido sem persistencia.
- `tests/firestore/firestore-rules.test.js` adiciona `84A` para `local_storage` owner-scoped e `84B` para contrato invalido de configuracao local.
- Confirmado: cliente nao expoe setter de custom claims, nao usa Admin SDK e role/status em Firestore nao viram autoridade para emitir claim.
- Validacao final 6.7: `npm test` aprovou `112` arquivos e `661` testes; `npm run build`, `npm run smoke`, checks de budget/bootstrap/loaders/settings/admin e suite E2E local emulada completa aprovaram. A suite `playwright.e2e-local.config.js` fechou com `12 passed (1.6m)`.
- Lacunas: edicao global positiva por UI e emissao real de custom claims continuam dependentes de autoridade confiavel fora do cliente.

## Cobertura de modernizacao da Exportacao PDF

| Risco | Cobertura local |
| --- | --- |
| Report model depender de DOM, `window`, Firebase, `dataSdk` ou biblioteca PDF | `tests/application/readModels/financialReportReadModel.test.js` e `npm run pdf-export-modernization:check` |
| Totais divergirem da fonte canonica do Dashboard | `tests/application/readModels/financialReportReadModel.test.js` |
| PDF exportar senha, token, telefone, WhatsApp, UID tecnico ou email tecnico | `tests/application/readModels/financialReportReadModel.test.js`, `tests/ui/pdfAdapter.test.js` e Playwright local |
| Controller recalcular negocio ou chamar Firebase/dataSdk direto | `tests/ui/reportExportController.test.js` e `npm run pdf-export-modernization:check` |
| Biblioteca PDF voltar ao entry | `npm run bundle:budget` e `npm run pdf-export-modernization:check` |
| Clique duplicado disparar geracoes concorrentes | `tests/ui/reportExportController.test.js` |
| Erro de dados, lazy-load ou geracao quebrar shell | `tests/ui/reportExportController.test.js` e Playwright local |
| Troca de usuario reaproveitar dados de outro owner | `tests/application/readModels/financialReportReadModel.test.js`, `tests/ui/reportExportController.test.js` e Playwright local |

Lacunas: comparacao visual pixel-perfect do PDF e validacao binaria completa permanecem fora do escopo; o conteudo e validado no report model e o fluxo/download no Playwright. Nenhum teste desta etapa usa Firebase de producao.

## Cobertura Saida do Loader Legado - 08/09/2026

- Check estrutural de contagem e camadas: `tests/architecture/legacyLoaderExit.test.js`.
- Guarda de `eval`/`new Function`: `tests/architecture/no-new-eval.test.js`.
- Smoke cobre bootstrap, navegacao, Dashboard, lazy modules e `exportPDF`.
- Playwright local cobre login, pending, inactive, Dashboard, CRUD, entradas, parcelamentos, recorrencias, horas, Planner, Configuracoes, Admin, Importacao, Backup/Restore, PDF, logout/troca de usuario e reload indireto dos fluxos.

## Cobertura Bridges e Monitor - 08/09/2026

- `tests/services/performanceMonitor.test.js` cobre adapter sem `window`, ausencia de Performance API, start/mark/measure/report, baseline local, idempotencia da instalacao e ausencia de envio externo.
- `tests/legacy/bridgeRegistry.test.js` cobre instalacao unica, reinstalacao idempotente, colisao de nomes e registry limpo para testes.
- `tests/architecture/legacyLoaderExit.test.js` agora congela `classicScriptsAfter = 24`, `evalExecutedAfter = 24`, `globals <= 50`, sem novo `eval` e sem `new Function`.

## Cobertura Loader de Bibliotecas - 08/09/2026

- `tests/services/libraryLoader.test.js` cobre allowlist HTTPS, bloqueio de host desconhecido, primeiro load, reuso de Promise, falha, retry apos falha, ausencia de `document/window` e helper especifico de XLSX.
- `tests/legacy/libraryLoaderBridge.test.js` cobre instalacao das bridges temporarias por `bridgeRegistry` e delegacao para o loader ES canonico.
- `tests/architecture/legacyLoaderExit.test.js` agora congela `classicScriptsAfter = 23`, `evalExecutedAfter = 23`, `globals <= 50`, sem novo `eval` e sem `new Function`.
- `npm run library-loader:check` valida que XLSX/PDF/Firebase seguem lazy, Chart/Lucide seguem no bootstrap local, nenhum CDN novo foi adicionado e bibliotecas pesadas nao entram no entry.

## Cobertura Correcao de Bootstrap dos Loaders - 09/09/2026

- `tests/services/libraryLoader.test.js` cobre import sem injecao de scripts, primeiro load, reuso de Promise, falha, retry e ausencia de `document/window`.
- `tests/legacy/libraryLoaderBridge.test.js` cobre instalacao sem preload, idempotencia, ausencia de listeners e delegacao sob demanda para o loader ES.
- `npm run bootstrap:check` cobre budget `430080`, `classic/eval <= 23`, globais `<= 50`, XLSX/PDF fora do entry, ausencia de import estatico do loader na bridge e ausencia de `applicationError.js` eager no loader.
- `npm run bootstrap:benchmark` cobre 10+ medicoes quando `BOOTSTRAP_BENCHMARK_RUNS=10` e registra fases inferidas por recursos do navegador.

## Cobertura Benchmark Deterministico de Bootstrap - 11/09/2026

- `tests/services/performanceMonitor.test.js` cobre derivacao de `app_bootstrap_ms`, `legacy_loader_ms`, `bridge_install_ms`, `auth_init_ms`, `first_screen_ready_ms`, `lazy_registration_ms`, `document_load_ms` e `environment_overhead_ms` a partir de Performance marks.
- `tests/playwright/regression-local.spec.js` valida que os marcadores obrigatorios aparecem uma vez, que `first-screen-ready` existe e que XLSX/PDF nao sao carregados no bootstrap inicial.
- `npm run bootstrap:benchmark` mede 10 cold + 10 warm em `vite preview`, preserva raw samples e compara apenas metricas controlaveis contra `docs/bootstrap-performance-baseline.json`.
- `npm run bootstrap:check` valida baseline versionado, marks obrigatorios, ausencia de autoatualizacao do baseline, `document_load_ms` fora do gate principal, `classic/eval <= 23`, globais `<= 50`, budget `430080`, sem novo `eval` e sem `new Function`.

## Cobertura Decomposicao `legacy-ui.js` - 11/09/2026

- `tests/ui/legacyUiBridge.test.js` cobre `installLegacyUiBridge`, reinstalacao idempotente, helpers DOM, toast legado, overlay, sidebar e tabs.
- `tests/architecture/global-api-collisions.test.js` continua protegendo inventario global sem adicionar API nova.
- `npm run legacy-loader:check` valida que `src/ui/legacy-ui.js` nao voltou ao classic/eval loader, que `classic/eval <= 22`, globais `<= 50`, nenhum novo `eval`, `new Function=0` e nenhum modulo moderno importa `legacy-ui.js`.
- Estado historico daquele lote: remocao de `window.financeUI` ainda nao era testada porque consumidores classicos reais permaneciam ativos. Atualizacao 5.20: a ausencia de `window.financeUI` no bootstrap real e coberta no Playwright de navegacao.

## Cobertura consumidores `financeUI` - 12/09/2026

- `tests/ui/financeUiConsumerAdapters.test.js` cobre o adapter visual usado por `part-03.js` e `part-29.js`: instalacao sem nova global, toast, overlay, sidebar, back button, tabs, lista/empty state e totalizador.
- Naquele lote, `npm run finance-ui-consumers:check` validava `part03FinanceUiCalls=0`, `part29FinanceUiCalls=0`, `classic/eval <= 22`, globais `<= 50`, nenhum novo `eval`, `new Function=0`, adapter sem Firebase/dataSdk/regra financeira e `wrote=false`.
- Playwright local deve continuar cobrindo dashboard, saidas, configuracoes, overlays, feedback visual, reload e ausencia de `ReferenceError`.
- Lacuna registrada naquele lote: `part-07.js`, `part-08.js`, `part-14.js` e fallbacks modernos ainda exigiam a bridge `window.financeUI`. Atualizacao 5.20: esses bloqueios foram encerrados para a exposicao publica; permanecem consumidores de `financeApp.financeUiAdapters` em `part-03.js`, `part-07.js` e `part-29.js`.

## Cobertura consumidores modernos `financeUI` - 12/09/2026

- `tests/architecture/modernFinanceUiConsumers.test.js` impede dependencia de `window.financeUI` ou `financeUiAdapters` nos modulos modernos de importacao, Month Detail, records, settings, admin, Planner, horas, relatorios e backup.
- `tests/ui/financeUiConsumerAdapters.test.js` agora tambem cobre `setHidden` e `setText`, usados pelo `part-07.js` migrado para o adapter temporario.
- Naquele lote, `npm run finance-ui-consumers:check` validava `modernFinanceUiConsumers=[]`, `part07FinanceUiCalls=0`, `part08FinanceUiCalls=9`, `part14FinanceUiCalls=4`, `remainingConsumers=["src/legacy/inline/part-08.js","src/legacy/inline/part-14.js"]`, `classic/eval <= 22`, globais `<= 50`, nenhum novo `eval`, `new Function=0` e `wrote=false`.
- Lacuna proposital daquele lote: `part-08.js` e `part-14.js` seguiam intocados e ainda bloqueavam a remocao de `window.financeUI`. Atualizacao 5.20: `window.financeUI` foi aposentada apos a etapa critica e a prova de ausencia de consumidores diretos.

## Cobertura consumidores criticos `financeUI` - 12/09/2026

- Playwright `legacy settings fallback renders people and macros without active UI loader` caracteriza o fallback classico de Configuracoes antes e depois da migracao visual.
- `tests/architecture/financeUiConsumersCheck.test.js` cobre deteccao separada de consumo direto, adapter, alias e acesso dinamico.
- `npm run finance-ui-consumers:check` valida `modernGlobalUiConsumers=[]`, `directFinanceUiConsumers=[]`, `part08FinanceUiCalls=0`, `part14FinanceUiCalls=0`, `navigationBridgeConsumers=[]`, `remainingConsumers=["src/legacy/inline/part-03.js","src/legacy/inline/part-07.js","src/legacy/inline/part-29.js"]`, `classic/eval <= 22`, globais top-level `<= 50`, nenhum novo `eval`, `new Function=0` e `wrote=false`.
- `tests/ui/navigationLazyLoad.test.js` cobre navegacao rapida A -> B -> C com B atrasado, saida antes da conclusao do loader, troca de sessao durante lazy load e falha com retry sem wrappers duplicados.
- Playwright `legacy navigation preserves hash router, back and sidebar behavior` caracteriza router/hash, repeticao de aba, Voltar e fechamento de sidebar antes e depois da migracao.
- `tests/ui/legacyUiBridge.test.js` cobre que `installLegacyUiBridge` nao reinstala `window.financeUI`, preserva `financeApp.financeUiAdapters` e e idempotente.
- Playwright `legacy navigation preserves hash router, back and sidebar behavior` valida que o bootstrap real nao expoe `window.financeUI` e ainda instala `window.financeApp.financeUiAdapters.showToast`.
- `tests/architecture/financeUiConsumersCheck.test.js` cobre `financeUiInstalled=false`, `financeUiAdaptersInstalled=true`, `removedGlobalSurface=["window.financeUI"]` e `addedGlobalSurface=[]`.
- Lacuna proposital: `part-08.js:switchTab` inteiro ainda exige lote proprio de estado de navegacao para sair do script classico.

## Cobertura E2E local com Auth/Firestore Emulator - 12/09/2026

- `tests/playwright/integration-local-finance.spec.js` valida uma jornada real no navegador com Vite local, Auth Emulator e Firestore Emulator: usuario A cria uma saida pela UI, recarrega a pagina, troca para usuario B sem vazamento, volta para usuario A e reencontra o registro uma unica vez.
- `playwright.e2e-local.config.js` sobe o app em `http://127.0.0.1:5178` com `VITE_FINANCE_USE_FIREBASE_EMULATORS=true`, `VITE_FIREBASE_PROJECT_ID=demo-finance-control-local-e2e`, Auth Emulator em `127.0.0.1:9099` e Firestore Emulator em `127.0.0.1:8080`.
- `src/services/firebase.js` ganhou somente uma rota opt-in para emuladores, protegida por `projectId` obrigatoriamente iniciado por `demo-`.
- O teste confirma que `window.financeUI` nao foi reinstalada no bootstrap real.
- Nenhum dado real de Firebase e usado; Auth e Firestore sao limpos no emulador antes/depois do cenario.

Lacunas remanescentes: edicao visual real de saida, parcelamentos, entradas, controle de horas, importacao, administracao e PDF ainda exigem jornadas E2E emuladas proprias antes de qualquer remocao adicional de legado nesses dominios.

## Cobertura E2E local de Parcelamentos - 12/09/2026

- `tests/playwright/integration-local-installments.spec.js` valida, com UI real e emuladores, a criacao de uma serie parcelada de R$ 100,00 em 3 parcelas para o usuario A.
- A jornada confirma rateio R$ 33,33 + R$ 33,33 + R$ 33,34, datas 15/09/2026, 15/10/2026 e 15/11/2026, `parent_id` compartilhado, ordem das parcelas, owner correto, cartao/forma de pagamento e soma exata de 10000 centavos.
- A jornada valida Parcelamentos e Dashboard no mes de setembro, incluindo exibicao da primeira parcela e total mensal de R$ 33,33.
- A jornada valida reload e troca A -> B -> A sem vazamento e sem duplicacao de dados.
- Atualizacao 6.1A: o pagamento da primeira parcela agora e validado como persistente pelo caminho canonico `MarkExpenseAsPaidCommand` + Firestore Rules. A parcela 1 fica `Pago` com `paid_at=2026-09-20`, reload preserva o estado e a troca A -> B -> A continua sem vazamento.
- A tela de Parcelamentos passa a validar `total comprometido` como saldo aberto (`R$ 66,67`) e `total pago` como `R$ 33,33` apos o pagamento.
- `tests/firestore/firestore-rules.test.js` cobre o payload completo de pagamento de parcela propria e negativos para nao autenticado, outro owner, pending/inactive, mutacao de owner/type, status/paid_at invalidos, campo proibido e metadata sem autorizacao.

Lacunas remanescentes especificas de Parcelamentos: reversao de pagamento, edicao/exclusao de parcelas, cenarios com primeira parcela criada paga, arredondamentos adicionais e auditoria sem colisao precisam de lote proprio com Firestore Emulator.

## Cobertura E2E local de Recorrencias Mensais - 12/09/2026

- `tests/playwright/integration-local-recurrences.spec.js` valida, com UI real e emuladores, a criacao de uma serie recorrente mensal de R$ 40,00 em 3 ocorrencias para o usuario A.
- A jornada confirma preview mensal, total R$ 120,00, primeira ocorrencia em 31/01/2026, ultima em 31/03/2026 e ajuste de fevereiro para 28/02/2026 sem perder a ancoragem mensal.
- A jornada confirma `recurrence_series_id` compartilhado, `recurrence_sequence_no` 1, 2 e 3, `recurrence_total_occurrences=3`, `recurrence_frequency=monthly`, `source_mode=recurring`, competencias `2026-01`, `2026-02` e `2026-03`, owner correto e soma exata de 12000 centavos.
- A jornada confirma que recorrencia mensal nao e tratada como parcelamento: `parent_id` vazio, `installment_no=0`, `total_installments=0` e `is_installment=false`.
- A jornada valida Saidas e Dashboard por competencia mensal, reload sem duplicacao e troca A -> B -> A sem vazamento.
- A jornada usa Firestore Rules para provar que o usuario B nao le a subcolecao de registros financeiros do usuario A.
- A jornada tambem cobre validacao de quantidade invalida e cancelamento de rascunho valido sem persistencia.
- `playwright.e2e-local.config.js` inclui `integration-local-recurrences.spec.js` na suite local emulada junto com financeiro e parcelamentos.

Lacunas remanescentes especificas de Recorrencias: edicao de serie inteira, edicao de uma ocorrencia isolada, exclusao de serie, finalizacao por data limite, frequencia anual, primeira ocorrencia paga, auditoria sem colisao e conciliacao com importacao precisam de lote proprio com Firebase Emulator.

Observacao de governanca 6.2/6.2A: a cobertura funcional de recorrencias passou. A reprovacao inicial de `npm run bootstrap:benchmark` foi investigada em `docs/bootstrap-gate-investigation-6-2.md`; a causa comprovada foi de tooling no encerramento de processos Vite no Windows. O benchmark agora encerra a arvore de processos, preserva baseline/tolerancias/budget e voltou a aprovar com o protocolo existente.

## Cobertura E2E Local de Importacao XLSX - 13/09/2026

| Risco | Cobertura local |
| --- | --- |
| Preview XLSX persistir dados antes de confirmacao | `tests/playwright/integration-local-import-xlsx.spec.js` valida 3 linhas prontas e Firestore vazio antes do commit |
| Commit XLSX duplicar registros ou fugir do pipeline canonico | `tests/playwright/integration-local-import-xlsx.spec.js` valida persistencia via UI real, `source_channel=spreadsheet_import`, `import_source=saidas_xlsx`, `import_batch_id`, `source_reference_id`, receipts e auditoria |
| Reimportacao exata gerar duplicidade | `tests/playwright/integration-local-import-xlsx.spec.js` valida `readyRows=0`, `duplicateRows=3`, commit desabilitado e IDs originais preservados |
| Mesmo conteudo com nome diferente gerar novo lote | `tests/playwright/integration-local-import-xlsx.spec.js` valida mesmo `batchId` para bytes identicos renomeados e ausencia de novos registros |
| Troca de usuario vazar preview, dashboard, saidas ou Firestore | `tests/playwright/integration-local-import-xlsx.spec.js` valida A -> B -> A no mesmo BrowserContext e bloqueio de leitura cruzada pelas Rules |
| Preview misto ocultar invalido ou duplicidade interna | `tests/playwright/integration-local-import-xlsx.spec.js` valida 3 prontas, 1 invalida, 1 duplicada e cancelamento sem persistencia |
| Suite completa depender de ordem ou carga para renderizar preview | Atualizacao 6.5A: `preparePreview` aguarda `financeApp.importActiveUi.controller.getState().previewModel` ou erro antes de validar `#modern-import-summary`; a suite E2E local completa passou 3 vezes consecutivas com `8 passed` |

Lacunas: a cobertura E2E local homologada nesta etapa e restrita a XLSX de saidas. Importacao bancaria/CSV completa, reversao/remocao de lotes, falha pos-commit, conciliacao operacional e grande volume ainda exigem cenarios especificos. Nenhum teste desta cobertura usa Firebase de producao.
## Cobertura E2E Local de Controle de Horas - 13/09/2026

| Risco | Cobertura local |
| --- | --- |
| Cadastro visual de banco de horas perder owner ou misturar financeiro | `tests/playwright/integration-local-hours.spec.js` cria pela UI ativa, valida `owner_uid`, `owner_email`, `hour_control_type=Banco de Horas`, `financial_total=0` e saldo visual separado |
| Edicao visual duplicar registro | `tests/playwright/integration-local-hours.spec.js` edita o mesmo lancamento pela janela de detalhe e confirma o mesmo `id`, uma unica linha persistida e novos minutos liquidos |
| Reload perder registro editado | `tests/playwright/integration-local-hours.spec.js` recarrega a pagina e reencontra o lancamento editado no usuario A |
| Troca A -> B -> A vazar horas | `tests/playwright/integration-local-hours.spec.js` valida Auth Emulator, Firestore Emulator, ausencia dos dados de A para B, bloqueio de leitura cruzada pelas Rules e retorno dos dados para A |
| Intervalo invalido persistir indevidamente | `tests/playwright/integration-local-hours.spec.js` valida rejeicao na UI ativa antes de persistir |

Atualizacao 6.4A: a lacuna operacional de persistencia web direta foi encerrada. `firestore.rules` foi corrigido somente no contrato de `controle_horas`, o bridge local de persistencia foi removido de `tests/playwright/integration-local-hours.spec.js` e a jornada E2E de cadastro/edicao agora grava via Firebase Web SDK real contra Auth Emulator + Firestore Emulator com Rules ativas. O diagnostico esta registrado em `docs/hour-control-rules-diagnostic.md`. Nenhum Firebase de producao e usado.

Atualizacao 6.5: a jornada E2E de Controle de Horas agora valida `audit_logs` reais no Firestore Emulator. Cadastro gera exatamente um `HOUR_ENTRY_CREATED`; edicao do mesmo registro gera exatamente um `HOUR_ENTRY_UPDATED`; os eventos possuem `event_id` distintos, mesmo `entity_id`, owner/ator coerentes, reload preservado, ausencia de vazamento A -> B e intervalo invalido sem evento financeiro de horas. Testes de servico cobrem replay compativel, conflito incompativel e falha de auditoria apos commit financeiro. O aviso `entity already exists` foi classificado em `docs/audit-emulator-collision-diagnostic.md` como replay/duplicacao interna do Firestore Emulator/WebChannel para append ja confirmado, sem perda ou colisao semantica comprovada na jornada de horas.

Lacunas remanescentes de Controle de Horas: exclusao visual emulada, conciliacao com entradas/DSR em fluxo real, auditoria server-side/confiavel futura e cenarios adicionais de Hora Extra financeira precisam de lotes proprios.

## Cobertura UX, mobile e acessibilidade local - 19/09/2026

| Risco | Cobertura local |
| --- | --- |
| Tela critica quebrar por overflow horizontal antes de staging | `tests/playwright/release-ux-accessibility.spec.js` valida desktop e mobile com massa sintetica local |
| Botao icon-only ou input visivel ficar sem nome acessivel | `tests/playwright/release-ux-accessibility.spec.js` varre controles visiveis por nome acessivel minimo |
| Acao primaria do header nao funcionar por teclado | `tests/playwright/release-ux-accessibility.spec.js` ativa Novo Lancamento e alternancia de tema por teclado |
| UX local ser confundida com homologacao real de staging | `docs/release-ux-accessibility-readiness.md` registra que a etapa e local/mocked e nao substitui staging real |

Lacunas: sem `axe-core`, sem leitor de tela real, sem comparacao pixel-perfect e sem staging real. Persistencia e permissoes seguem cobertas pelas suites com Auth Emulator e Firestore Emulator.

## Adendo 7.3 - cobertura staging real

Staging real entrou na matriz apenas como cobertura nao destrutiva de URL/configuracao/isolamento. O projeto `finance-control-staging-260919` foi criado, Firestore Database/Rules/Indexes foram provisionados e Hosting foi publicado.

Cobertura aprovada contra URL real: `tests/playwright/staging-critical.spec.js` com `playwright.staging.config.js`, validando carregamento, runtime projectId `finance-control-staging-260919` e ausencia de requests para `finance-control-cce4f`.

Coberturas de regressao autenticadas continuam locais/emuladas ate que o Firebase Auth staging seja inicializado/configurado. O bloqueio atual e `BILLING_NOT_ENABLED` em `identityPlatform:initializeAuth` e `CONFIGURATION_NOT_FOUND` em config/signup.
# Evidência adicional — 7.3H

| escopo | resultado |
| --- | --- |
| contrato de ambientes Firebase | verde |
| E2E local + captura de rede | 16/16 |
| regressão Playwright local | 47/47 |
| performance Playwright | 2/2 |
| Vitest completo | 673/673 |
| Rules Emulator + Auth Emulator | verde |
| backup parcelado e restore dry-run | verde; `wrote=false` |
# Staging 7.3I

| fluxo | resultado |
| --- | --- |
| staging critical atual | 7/7 |
| lifecycle, CRUD A/B, parcelas, recorrência, horas, backup | verde |
| XLSX, auditoria, settings/references | pendente de staging real |
| mobile | login/overflow verde; fluxos completos pendentes |
| rollback frontend | pendente |
