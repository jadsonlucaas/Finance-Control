# Politica de contratos dos registros financeiros

Atualizado em: 18/07/2026

## Objetivo

Todos os registros financeiros devem passar por contratos centrais em `src/domain/records`. Esses contratos sao independentes de DOM, classes CSS, modais, `window` e Firebase, para poderem ser usados pelo app web e por um backend confiavel futuro.

## API central

- `getFinanceRecordSchema(type)`: retorna o schema declarativo.
- `normalizeFinanceRecord(input, context)`: aplica aliases legados, defaults compatíveis e tipos basicos.
- `validateFinanceRecord(input, context)`: retorna `{ isValid, normalized, errors, warnings, schemaVersion }`.
- `assertFinanceRecord(input, context)`: lanca erro estruturado `FINANCE_RECORD_CONTRACT_INVALID`.
- `detectLegacyFinanceRecordIssues(record)`: lista erros e warnings de compatibilidade.
- `migrateFinanceRecordInMemory(record)`: normaliza em memoria sem escrever.
- `buildFinanceRecordDryRun(records)`: gera relatorio local deterministico sem Firestore.

## Campos comuns

`type`, `owner_uid`, `owner_email`, `created_at`, `updated_at`, `schema_version`, `archived`, `description` e `observation`.

Em persistencia, `owner_uid` e `owner_email` sao aplicados pelo servico a partir do usuario autenticado e sao imutaveis em update. `type` tambem e imutavel em update.

## Metadata multicanal opcional

Campos permitidos: `source_channel`, `source_reference_id`, `created_by_type`, `created_by_id`, `idempotency_key`, `correlation_id`, `received_at`, `processed_at`.

`source_channel`: `web`, `bank_import`, `spreadsheet_import`, `system`, `migration`, `future_integration`.

`created_by_type`: `user`, `admin`, `system`, `integration`.

Esses campos sao opcionais, nao alteram calculos financeiros, nao concedem autorizacao e nao substituem autenticacao. Strings tecnicas como `source_reference_id`, `idempotency_key`, `correlation_id` e `created_by_id` nao podem ser vazias quando presentes.

## Tipos

`saida`: valida `amount` finito, nao negativo e com no maximo duas casas, status permitido, datas, competencia, parcelas, recorrencia, importacao e snapshot de categoria. `installment_no` e `total_installments` devem ser inteiros; series novas exigem `parent_id`. `paid_at` incoerente gera warning de compatibilidade quando tratado no dominio.

`entrada`: valida valores monetarios finitos, competencia, status, tipo de rendimento, campos manuais e campos derivados persistidos. O contrato nao recalcula INSS, IRRF ou liquido; divergencias geram warning. Metadados opcionais `inss_parameter_version`, `irrf_parameter_version`, `tax_calculated_at` e `tax_calculation_schema_version` rastreiam a versao tributaria usada na consolidacao.

`pessoa`: valida nome nao vazio e salario base finito e nao negativo. Duplicidade logica e checada no dominio/caso de uso quando registros existentes sao informados.

`controle_horas`: valida competencia, data, enum de hora, natureza de banco, horas nao negativas, percentuais razoaveis e valores calculados finitos. Divergencia entre quantidade numerica e formatada gera warning.

`salario_historico`: valida pessoa, salario positivo e vigencia coerente. Aliases `amount`, `start_date` e `end_date` continuam legiveis.

`percentage_rule`: valida percentual, base, ciclo, status e intervalo de competencia. O contrato nao materializa saidas.

Saidas geradas por regra percentual continuam `type: saida` e aceitam metadata de origem percentual: `generated_percentage_rule`, `percentage_rule_id`, `percentage_occurrence_key`, `percentage_rule_version`, `percentage_materialized_at`, `percentage_calculation_version`, `percentage_rate`, `percentage_base`, `percentage_base_amount`, `percentage_base_amount_cents` e `percentage_calculated_amount_cents`. A unicidade nao e imposta pelas Rules; ela fica em ID deterministico, `createIfAbsent` e `IdempotencyRepository`.

`macro` e `categoria`: seguem a politica de referencias globais/pessoais ja aprovada, com `shared_scope`, owner coerente e nomes nao vazios.

## Aliases legados

- `subcategory` pode alimentar `category_name`.
- `amount` pode alimentar `salary_base` em historico salarial.
- `start_date`/`end_date` podem alimentar `vigencia_inicio`/`vigencia_fim`.
- `hour_entry_type` pode alimentar `hour_control_type`.
- `financial_total` pode alimentar `valorTotalCalculado`.
- `percentual` pode alimentar `percentage`.
- `base` pode alimentar `base_type`.
- O percentual canonico de `percentage_rule` usa pontos percentuais: `10` significa 10%. Formatos fracionarios como `0.10` sao tratados como ambiguos pelo materializador novo.

Aliases sao normalizados em memoria e reportados como warnings. Nenhuma migracao real e executada nesta etapa.

## Erros e warnings

Erros estruturados possuem `field`, `code`, `message` e `severity`. Warnings usam a mesma forma e cobrem legado sem `schema_version`, aliases convertidos, campos desconhecidos e divergencias derivadas.

## Limites das Rules

`firestore.rules` valida shape minimo, tipos, enums simples, owner, metadata e imutabilidade de owner/type. As Rules nao tentam validar unicidade, relacoes complexas entre documentos, calculos financeiros ou consistencia historica que exigiria consultas caras.

## Uso futuro por integracoes

Consumidores server-side usarao os mesmos schemas de dominio. Frontend e chatbot futuro nao terao contratos divergentes. Telefone nao integra o registro financeiro. `source_channel` nao concede autorizacao. `idempotency_key` nao substitui autenticacao. Nenhum codigo de WhatsApp, webhook, Meta API, provedor externo ou Firebase Admin SDK foi implementado.

## Fronteira de aplicacao multicanal

Em 21/08/2026, `ApplicationCommandGateway` passou a ser o ponto de entrada local para comandos e consultas de aplicacao. O gateway recebe envelopes padronizados, valida ator/origem/correlacao, aplica autorizacao por contexto autenticado, delega a handlers explicitos e normaliza o resultado.

Essa fronteira nao altera o contrato dos registros financeiros. Metadados como `source_channel`, `created_by_type`, `idempotency_key` e `correlation_id` continuam opcionais, nao recalculam valores, nao concedem permissao e nao substituem o usuario autenticado. `owner_uid` continua controlado pelo contexto de autenticacao e nao por payload livre.

`future_integration` e apenas um canal tecnico reservado para backend confiavel futuro. Nao existe implementacao de WhatsApp, telefone, webhook, provider externo, NLP, mensagem ou colecao de identidade externa nesta etapa.

## Parcelamentos

Parcelamentos usam `CreateInstallmentSeries` em `src/domain/installmentSeries.js`. O calculo monetario ocorre em centavos inteiros; o residuo fica na ultima parcela por padrao; datas sao avancadas por calendario com clamp para o ultimo dia valido do mes. O Firestore continua persistindo `amount` em reais para compatibilidade, sem adicionar `amount_cents` nesta fase.

## Recorrencias

Recorrencias novas usam `CreateRecurrenceSeries` em `src/domain/recurrenceSeries.js`. O contrato de `saida` aceita campos opcionais `recurrence_frequency`, `recurrence_count`, `recurrence_end_date`, `recurrence_series_id`, `recurrence_sequence_no` e `recurrence_total_occurrences`.

Registros legados com apenas `recurrence` continuam validos. Para series novas (`source_mode=recurring` ou metadata de serie presente), o dominio exige frequencia `monthly`/`yearly`, identificador de serie, sequencia positiva e total positivo. `parent_id` permanece reservado a parcelamentos e nao deve ser usado em recorrencias novas.

As Rules validam formato e limites dos campos opcionais sem exigir migracao de registros antigos.

## Parametros tributarios

INSS, IRRF e salario liquido usam o motor versionado em `src/domain/taxEngine.js`; a politica esta em `docs/tax-parameter-policy.md`. As tabelas atuais foram classificadas como `legado sem fonte` e existem apenas para preservar compatibilidade numerica. A base tributaria de entradas permanece `salario + hora extra + DSR`; outras receitas ficam visiveis e entram no liquido, mas nao compoem a base de INSS/IRRF.

## Controle de horas

Em 21/08/2026, `controle_horas` passou a aceitar campos canonicos de jornada sem remover campos legados. O contrato moderno inclui `start_time`, `end_time`, `crosses_midnight`, `break_minutes`, `gross_minutes`, `net_minutes`, `bank_minutes`, `overtime_percentage`, `base_hourly_rate_cents`, `calculated_value_cents`, `dsr_value_cents`, `calculation_version` e `salary_source_record_id`.

As Rules validam apenas shape, tipos e isolamento; elas nao recalculam jornada. O calculo canonico fica em `CalculateWorkSession`, documentado em `docs/hour-control-policy.md`. Campos legados como `horaInicial`, `horaFinal`, `quantidadeHoras`, `quantidadeHorasFormatada`, `percentualUsado`, `valorBaseHora`, `valorHoraCalculado` e `valorTotalCalculado` continuam legiveis para compatibilidade.

## Planner local

Eventos manuais do Planner e feriados customizados nao sao registros financeiros canonicos e nao pertencem a `finance_records`. Enquanto permanecerem no navegador, devem usar armazenamento local V2 escopado por owner autenticado:

- `finance-control-planner-events-v2:{ownerHash}`;
- `finance-control-custom-holidays-v2:{ownerHash}`.

As chaves V1 globais nao possuem `owner_uid` e ficam classificadas como legado nao atribuido. Nenhum fluxo deve migrar esses dados automaticamente para o usuario atual. Quando houver caso de uso persistido futuro, ele devera receber `ownerUid` do contexto autenticado, nao do payload livre.

## Configuracoes e referencias

A tela de Configuracoes consome os contratos existentes; ela nao cria um contrato financeiro novo.

- Pessoas, macros e categorias pessoais continuam em `users/{uid}/finance_records` e exigem `owner_uid` coerente com o contexto autenticado.
- Macros e categorias globais continuam classificadas como referencias compartilhadas e exigem autorizacao administrativa para manutencao.
- `settingsReadModel` apenas monta leitura separada por classificacao: `PERSONAL_REFERENCE`, `LOCAL_SETTING`, `FINANCIAL_RULE_CONFIG` e `ADMIN_CONFIG`.
- Regras percentuais e parametros tributarios aparecem como configuracao, mas nao sao recalculados nem materializados pela UI de Configuracoes.
- Configuracoes locais continuam locais ao navegador enquanto nao houver repositorio canonico persistido.

Qualquer persistencia futura deve reutilizar os validadores e casos de uso existentes, recebendo owner e permissoes do contexto autenticado, nao do payload livre.
