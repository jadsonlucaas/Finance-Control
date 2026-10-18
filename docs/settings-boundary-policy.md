# Politica de fronteiras de Configuracoes

Data: 04/09/2026

## Matriz

| Configuracao | Classificacao | Escopo | Fonte | Quem le | Quem altera | Autoridade |
| --- | --- | --- | --- | --- | --- | --- |
| Pessoas | PERSONAL_REFERENCE | Owner | `users/{uid}/finance_records type=pessoa` | Usuario ativo dono | Usuario ativo dono | Firestore Rules, contratos e repository/use case |
| Categorias Macro pessoais | PERSONAL_REFERENCE | Owner | `users/{uid}/finance_records type=macro shared_scope=personal` | Usuario ativo dono | Usuario ativo dono | ReferenceData + Rules |
| Categorias pessoais | PERSONAL_REFERENCE | Owner | `users/{uid}/finance_records type=categoria shared_scope=personal` | Usuario ativo dono | Usuario ativo dono | ReferenceData + Rules |
| Categorias Macro globais | SHARED_REFERENCE | Global | `shared_macros` | Usuarios ativos | Admin autorizado | Rules e politica de referencias |
| Categorias globais | SHARED_REFERENCE | Global | `shared_categories` | Usuarios ativos | Admin autorizado | Rules e politica de referencias |
| Regras percentuais | FINANCIAL_RULE_CONFIG | Owner | `users/{uid}/finance_records type=percentage_rule` | Usuario ativo dono | Fluxo existente autorizado | Casos de uso de regras percentuais |
| Parametros INSS/IRRF legados | ADMIN_CONFIG | Local/legado | `finance-control-tax-settings-v1` e `tax_parameters` quando exposto | UI legada atual | Fluxo legado atual/admin quando aplicavel | Politica tributaria versionada |
| Tipos de H.E. | LOCAL_SETTING | Local | `finance-control-overtime-types-v1` | Usuario ativo | Usuario ativo no fluxo atual | Politica de Controle de Horas |
| Importar Saidas/Entradas | READ_ONLY_SYSTEM | Operacional | Fluxos de importacao existentes | Usuario ativo | Fluxos de importacao existentes | Pipeline de importacao |
| Historico | READ_ONLY_SYSTEM | Operacional | Registros do owner | Usuario ativo dono | Fluxo legado existente | Repositorio/Rules |

## Regras

- A UI nao concede permissao; ela apenas reflete `permissions` recebidas da camada autorizada.
- Referencias pessoais nunca sao misturadas com `shared_*` sem preservar origem.
- Usuario comum ativo cria e mantem referencias pessoais por padrao.
- Referencias globais exigem autorizacao administrativa ja existente.
- Regras percentuais nao podem ser materializadas, recalculadas ou reinterpretadas pela UI de Configuracoes.
- Parametros tributarios nao recalculam historico a partir da tela.
- Configuracoes locais com risco de usuario devem ser owner-scoped quando houver store moderno; legado sem owner nao e atribuido automaticamente.

## Politica de criacao de referencias por escopo

Usuario comum ativo pode criar apenas referencias `personal`. A UI deve mostrar que o escopo efetivo sera `Pessoal` e nao deve oferecer opcao global habilitada. Se um payload externo, manual ou manipulado solicitar `global`, a camada de aplicacao rejeita com `SETTINGS_SHARED_REFERENCE_FORBIDDEN`; o pedido nao pode ser convertido silenciosamente para `personal`.

Quando o escopo for omitido em criacao de macro ou categoria, o contrato documentado permite default explicito para `personal`. Esse default e registrado por `resolveReferenceWriteScope` como `DEFAULT_PERSONAL_SCOPE`.

Admin ativo pode criar `personal` e pode criar `global` somente quando escolhe `global` explicitamente. Escopo omitido por admin tambem resolve para `personal`; o sistema nao assume `global` por padrao.

Leitura de referencias globais por usuario comum permanece permitida conforme politica atual. Visualizar `global` nao concede edicao, exclusao ou criacao compartilhada.
