# Diagnostico de contratos dos registros financeiros

Executado em: 18/07/2026

## Estado atual

O projeto ja possui um contrato inicial em `src/domain/schemas/financeRecordSchema.js` e normalizacao em `src/domain/normalizers/financeRecordNormalizer.js`. A persistencia passa por `src/services/firestoreSanitizer.js` antes de chegar ao `dataSdk`, e as regras do Firestore bloqueiam usuario sem perfil `active`, tipo desconhecido, `owner_uid` divergente e alteracao de `owner_uid`/`owner_email`.

O ponto fraco atual e que o contrato ainda e generico: `hasValidFinanceShape()` aceita a maior parte dos tipos com a mesma regra minima, e alguns payloads legados ainda sao montados diretamente em modulos inline. Isso permite detectar tipo/owner/amount basico, mas nao expressa as diferencas reais entre `saida`, `entrada`, `pessoa`, `controle_horas`, `salario_historico`, `percentage_rule`, `macro` e `categoria`.

## Inventario por tipo

| Tipo | Campos principais usados | Aliases/legado | Risco atual |
| --- | --- | --- | --- |
| `saida` | `person`, `amount`, `description`, `macro_category`, `subcategory`, `category_id`, `category_name`, `status`, `payment_method`, `occurred_date`, `due_date`, `competence`, `paid_at`, `installment_no`, `total_installments`, `parent_id`, `recurrence`, `cycle`, `import_source`, `import_signature`, snapshots de categoria | `subcategory` ainda representa categoria historica; parcelas antigas podem ter `status` vazio | Rules nao validam status, datas, competencia, parcela ou metadata por tipo. |
| `entrada` | `person`, `amount`, `description`, `competence`, `status`, `earning_type`, `salary_base`, campos de proventos/descontos, INSS/IRRF/liquido persistidos, campos de hora extra e origem | Campos calculados variam entre legado e consolidacao; outras receitas usam mesma estrutura de entrada | Divergencias entre campos derivados podem passar sem warning central. |
| `pessoa` | `person`, `salary_base`, `receiving_type`, `created_at`, `updated_at` | `amount` aparece como default legado | Duplicidade logica fica dispersa em UI/caso de uso. |
| `controle_horas` | `person`, `competence`, `occurred_date`, `hour_control_type`, `horaInicial`, `horaFinal`, `quantidadeHoras`, `quantidadeHorasFormatada`, `bank_nature`, `percentualUsado`, `valorBaseHora`, `valorHoraCalculado`, `valorTotalCalculado` | `hour_entry_type`, `financial_total` em leituras antigas | Campos calculados e formatados nao possuem warning central de divergencia. |
| `salario_historico` | `person`, `person_id`, `salary_base`, `amount`, `start_date`, `end_date`, `vigencia_inicio`, `vigencia_fim`, `observation` | `start_date`/`end_date` convivem com `vigencia_inicio`/`vigencia_fim`; existe leitura de `salario_historico_legacy` | Vigencias invalidas podem chegar perto da persistencia sem diagnostico padronizado. |
| `percentage_rule` | `person`, `percentage`, `percentual`, `base`, `base_type`, `cycle`, `macro`, `category`, `startCompetence`, `endCompetence`, `status`, `active` | `base` e `base_type`; `percentage` e `percentual` | Validacao de intervalo/ciclo/base nao esta centralizada. |
| `macro` | `macro_id`, `macro_category`, `shared_scope`, `owner_uid`, `owner_email`, `schema_version` | Sem `shared_scope` legado e tratado como pessoal | Politica global/pessoal ja existe, mas precisa integrar ao contrato financeiro central. |
| `categoria` | `category_id`, `category_name`, `macro_id`, `macro_category`, `category_color`, `category_icon`, `shared_scope`, `owner_uid`, `owner_email`, `schema_version` | `subcategory` pode representar `category_name` | Politica global/pessoal ja existe; exclusao em uso e bloqueada no servico. |

## Inconsistencias

- `amount` e alguns inteiros sao convertidos implicitamente pelo normalizador atual; isso e util para legado, mas nao diferencia erro fatal de compatibilidade.
- `firestore.rules` valida poucos enums e nao separa os tipos financeiros por contrato.
- Payloads ainda sao criados em trechos legados inline, importacao e builders modernos.
- Campos tecnicos futuros ainda nao tinham contrato explicito de tipo, tamanho e enum.
- Registros historicos sem `schema_version` precisam continuar legiveis e diagnosticaveis, sem migracao automatica.

## Politica proposta

- Criar contratos centrais independentes do DOM para normalizacao, validacao, assertion e diagnostico.
- Preservar leitura de legado com warnings estruturados.
- Rejeitar no cliente, antes do Firestore, shapes invalidos em create/update/upsert.
- Manter `owner_uid`, `owner_email`, `type` e `shared_scope` protegidos contra troca silenciosa.
- Validar metadata multicanal opcional sem conceder autorizacao nem alterar calculos.

## Compatibilidade e rollback

Nenhum dado real sera migrado nesta etapa. O rollback e reverter os arquivos de contrato, Rules, dataSdk e testes deste commit local. Registros legados continuam legiveis porque o diagnostico reporta warnings e a normalizacao em memoria preserva aliases sem gravar migracoes automaticas.

## Riscos para integracao server-side futura

Um backend futuro deve usar os mesmos contratos de dominio antes de persistir. `source_channel`, `idempotency_key` e `correlation_id` sao metadados de rastreio, nao identidade nem autorizacao. Telefone, WhatsApp, webhook, provedor externo e Admin SDK nao fazem parte dos registros financeiros nesta etapa.
