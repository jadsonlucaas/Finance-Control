# Diagnostico da Materializacao de Regras Percentuais

Executado em: 22/08/2026

## Fluxo atual

As regras percentuais sao registros financeiros com `type: percentage_rule`. Elas sao criadas, editadas, listadas e excluidas principalmente em `src/legacy/inline/part-29.js`.

O fluxo atual possui duas camadas:

- Regra persistida: salva por `upsertPercentageExitRule`, com `window.dataSdk.upsert`, usando um ID derivado de nome, pessoa, percentual, base, categoria, ciclo e vigencia inicial.
- Saida derivada: gerada por `buildPercentageExitRecord` e persistida por `materializePercentageExitRulesForRange`, tambem com `window.dataSdk.upsert`.

O dashboard tambem cria saidas virtuais por `getDashboardGeneratedPercentageSaidas` em `src/ui/dashboard/dashboardData.js`. Essas saidas virtuais sao apenas para visualizacao quando ainda nao existe ocorrencia persistida.

## Campos reais de `percentage_rule`

Campos observados no contrato, no legado e nos testes:

- `id`
- `type`
- `name`
- `person`
- `percentage`
- `percentual`
- `base`
- `base_type`
- `macro`
- `macro_category`
- `category`
- `category_id`
- `category_name`
- `subcategory`
- `cycle`
- `status`
- `startCompetence`
- `endCompetence`
- `start_competence`
- `end_competence`
- `active`
- `createdAt`
- `updatedAt`
- campos comuns: `owner_uid`, `owner_email`, `schema_version`, `created_at`, `updated_at`, metadata operacional.

## Aliases legados

O contrato central aceita:

- `percentual` como alias de `percentage`;
- `base` como alias de `base_type`;
- `startCompetence` e `start_competence`;
- `endCompetence` e `end_competence`.

No legado, a regra ainda usa majoritariamente `base`, `macro`, `category`, `createdAt` e `updatedAt`. O payload salvo tambem preenche campos de saida vazios para manter compatibilidade com filtros e referencias.

## Semantica atual do percentual

O formato canonico atual de `percentage_rule` e percentual em pontos percentuais:

- `10` significa 10%;
- `12.5` significa 12,5%.

Essa semantica aparece em `getPercentageRuleAmount`, que calcula `base * (percentage / 100)`, e nas Firestore Rules, que aceitam `percentage` e `percentual` entre 0 e 100.

Formatos como `0.10` sao ambiguos neste dominio: pela formula atual significariam 0,10%, mas em outros dominios poderiam significar 10%. Formatos como `1.10` tambem sao ambiguos para migracao, pois significariam 1,10% na regra percentual. O formato `110` e invalido para `percentage_rule` pelo limite atual de 100; valores acima de 100 pertencem a outros dominios, como hora extra, e nao devem ser reinterpretados aqui.

## Bases existentes

As bases encontradas em `src/domain/percentage-rules.js` e no legado sao:

- `liquido`: receita liquida do trabalho;
- `bruta`: receita bruta do trabalho;
- `base_total`: base de trabalho;
- `salario`: salario base;
- `extra`: H.E. + DSR.

Para regras de macro/categoria/nome que indiquem `RESERVA` ou `INVEST`, a base padrao respeita a regra legada: quinzena usa `adiantamentoQuinzena`; inicio do mes usa liquido do trabalho.

## Ciclos e vigencia

Os ciclos efetivamente usados pela UI sao:

- `INICIO_MES`;
- `QUINZENA`.

As Rules tambem aceitam aliases historicos (`FIM_MES`, `MENSAL`, `inicio`, `quinzena`, `fim`), mas o legado normaliza tudo que nao e `QUINZENA` para `INICIO_MES`.

A vigencia inicial usa `startCompetence`. O contrato tambem conhece `endCompetence`, mas o materializador legado so verifica a competencia inicial.

## Regra por pessoa

Quando `person` esta preenchido, a regra e aplicada somente a essa pessoa. Quando `person` esta vazio, a regra e aplicada para todas as pessoas retornadas por `getPeopleRecords()`.

## Calculo atual

A formula atual e:

```text
amount = roundCurrency(baseValue * (percentage / 100))
```

O valor-base vem de `consolidarEntradaMensal(person, competence)` no legado e dos helpers de base percentual. O dominio moderno ja possui `consolidatePersonMonthlyEntry`, mas a escrita atual ainda depende do browser legado.

## Persistencia e gatilhos atuais

`materializePercentageExitRulesForRange` delega a gravacao para `financeApp.percentageRuleMaterializationRunner.runForRange`, que chama o use case moderno. A renderizacao nao deve materializar por efeito colateral.

Os gatilhos atuais incluem:

- migracao de regras de `localStorage` para Firebase;
- salvar regra percentual;
- renderizacao de configuracoes;
- fluxo de dashboard/filtros em `part-29.js`;
- API global `schedulePercentageExitMaterialization`, que preserva a bridge legada sem gravar por renderizacao.

O risco original era a renderizacao disparar escrita; a politica atual exige materializacao explicita pelo runner/use case.

## Identificacao atual da ocorrencia

A ocorrencia derivada usa ID `percentage_exit_...`, derivado de regra, pessoa e competencia. Tambem existem chaves semanticas por descricao, pessoa, competencia, macro, categoria, percentual, base e ciclo.

Campos de ligacao observados:

- `generated_percentage_rule`;
- `percentage_rule_id`;
- `percentage_rate`;
- `percentage_base`;
- `percentage_base_amount`;
- `recurrence: mensal_percentual`;
- `cycle`;
- `competence`.

Existe `percentage_occurrence_key` canonica no fluxo moderno. Ela e construida por owner, regra, pessoa e competencia e acompanha o ID deterministico da saida materializada.

## Comportamento de existentes

O legado chama `preservePersistedPercentageExitState`, preservando alguns campos de uma ocorrencia ja persistida, como status, `paid_at`, arquivamento e `created_at`. Ainda assim, o fluxo usa `upsert`, o que deixa risco de reescrita de campos de valor, categoria e descricao.

Ocorrencias pagas e arquivadas devem passar a ser reconhecidas e preservadas sem overwrite. Ocorrencias manualmente editadas ou divergentes devem gerar aviso/conflito, sem recalculo silencioso.

## Edicao e exclusao da regra

Ao editar uma regra, o comportamento seguro e aplicar a nova configuracao somente a ocorrencias futuras ou ainda ausentes. Historico materializado nao deve ser alterado automaticamente.

Ao excluir uma regra, o codigo atual chama `deleteGeneratedPercentageExitRecordsForRule`, removendo saidas derivadas. Isso e risco de integridade historica. A politica proposta para esta etapa e preservar ocorrencias ja materializadas e impedir apenas novas materializacoes.

## Riscos

- Escrita acoplada a renderizacao e abertura de tela.
- `upsert` pode sobrescrever ocorrencia existente.
- Duas abas ou dispositivos podem competir pela mesma ocorrencia.
- Crash entre criacao e finalizacao do receipt pode gerar nova tentativa inconsistente se nao houver ID deterministico.
- Edicao de regra pode afetar historico se a ocorrencia for regravada.
- Exclusao da regra apaga historico derivado no fluxo legado atual.
- `localStorage` ainda participa como backup/migracao de regras.

## Validacao de concorrencia real no Emulator

`tests/firestore/percentage-rule-materialization-concurrency.test.js` fecha a lacuna de concorrencia real para a materializacao percentual. O teste usa Firestore Emulator, dados sinteticos, perfil `active`, `FirebaseFinanceRecordRepository`, `FirebaseWebIdempotencyRepository`, `FirebaseAuditRepository` e chama `MaterializePercentageRulesForCompetence`.

Coberturas:

- duas execucoes simultaneas da mesma regra/pessoa/competencia geram exatamente uma saida;
- tres execucoes simultaneas geram exatamente uma saida;
- a saida usa o ID deterministico esperado;
- a saida usa a occurrence key esperada;
- retry posterior retorna existente/replay seguro sem recriar;
- ocorrencia paga preserva `status`, `paid_at` e valor editado;
- ocorrencia manualmente editada preserva valor/categoria e retorna warnings;
- existe somente um receipt idempotente para a chave canonica;
- existe somente uma auditoria `PERCENTAGE_RULE_OCCURRENCE_CREATED`.

Janela de corrida identificada: duas execucoes podem listar ausencia da ocorrencia antes da primeira escrita. A protecao efetiva acontece depois, na reserva atomica do receipt e no `createIfAbsent` com ID deterministico.

## Janela createIfAbsent -> receipt.complete

Comportamento anterior: depois de `reserve`, uma falha entre `FinanceRecordRepository.createIfAbsent` e `IdempotencyRepository.complete` deixava a saida deterministica criada e o receipt em `processing`. No retry, o fluxo podia encontrar a ocorrencia e retornar existente sem completar o receipt, ou encontrar o receipt `processing` e tratar como conflito sem reconciliacao. Na pratica, o receipt poderia ficar bloqueado indefinidamente.

Comportamento atual: o retry calcula o mesmo ID deterministico e a mesma occurrence key. Se encontrar receipt `processing` com o mesmo fingerprint e a ocorrencia ja existir, valida owner, regra, pessoa, competencia e occurrence key antes de completar o receipt como `RECONCILED_EXISTING`. A reconciliacao nao cria nova saida e nao duplica auditoria financeira de criacao. Se a ocorrencia estiver ausente, vale a politica de `processing` existente. Se existir documento incompativel no ID deterministico, o fluxo retorna `CONFLICT`, nao sobrescreve e nao completa o receipt falsamente.

O teste `tests/firestore/percentage-rule-materialization-concurrency.test.js` usa o hook injetavel `afterCreateBeforeReceiptComplete` para reproduzir a falha controlada no Firestore Emulator. O runtime padrao nao injeta falha, nao expoe global e nao depende de variavel de ambiente.

## APIs globais envolvidas

- `getSyncedPercentageExitRules`
- `savePercentageExitRule`
- `editPercentageExitRule`
- `deletePercentageExitRule`
- `cancelEditPercentageExitRule`
- `syncPercentageRuleCategoryOptions`
- `buildPercentageExitRecord`
- `hasPersistedPercentageExitRecord`
- `dedupePercentageExitRecords`
- `filterOrphanPercentageExitRecords`
- `schedulePercentageExitMaterialization`
- `materializePercentageExitRulesForRange`
- `__financeGetPercentageExitRecord`
- `__financeHandlePercentageExitRowAction`

Essas bridges devem permanecer compativeis enquanto houver consumidores legados.

## Politica proposta

Materializacao cria faltantes; nao reescreve existentes.

A nova arquitetura deve usar:

- motor puro de calculo;
- chave logica deterministica por owner, regra, pessoa e competencia;
- ID deterministico derivado da chave;
- reserva de idempotencia;
- criacao somente se ausente;
- reconhecimento de existentes por ID, occurrence key e campos legados;
- auditoria resumida;
- dry-run com `wrote: false`;
- runner local reutilizavel por futuro backend confiavel.

## Compatibilidade

A ocorrencia continua sendo `type: saida` para dashboard e listas. Os campos legados existentes devem ser preservados. Novos metadados devem ser adicionais e minimos.

Nao foi identificado motivo para criar colecao financeira paralela, integrar WhatsApp, criar webhook, usar Admin SDK ou abrir Rules publicas.

## Rollback

Rollback local seguro:

- reverter os novos arquivos de dominio/use case/dry-run;
- restaurar chamadas antigas de `schedulePercentageExitMaterialization` apenas se for necessario recuperar o comportamento de materializacao por renderizacao;
- manter registros existentes intactos, pois a politica nova nao remove ocorrencias historicas.
