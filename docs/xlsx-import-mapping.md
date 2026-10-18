# Mapeamento de importacao XLSX

Executado em: 22/08/2026

Escopo: importacao local de planilhas de saidas e entradas usando `src/application/imports/spreadsheetImportParser.js`, `PrepareImportBatch` e `CommitImportBatch`. Nenhum Firebase real, webhook, telefone, WhatsApp, provider externo, Admin SDK ou deploy faz parte deste fluxo.

## Saidas XLSX

Colunas aceitas:

| Campo canonico | Aliases aceitos | Obrigatorio | Destino |
| --- | --- | --- | --- |
| `date` | `Data`, `Date`, `Dt` | Sim | `occurred_date`, `paid_at` quando status `Pago` |
| `description` | `Descricao`, `Description`, `Historico` | Sim | `description` |
| `amount` | `Valor Orcado`, `Valor`, `Amount` | Sim | `amount` |
| `person` | `Quem paga`, `Pessoa`, `Responsavel` | Sim | `person` |
| `macro_category` | `Categoria_macro`, `Categoria macro`, `Macro` | Sim | `macro_category` |
| `category_name` | `Categoria`, `Subcategoria` | Sim | `category_name`, `subcategory` |
| `competence` | `Data competencia`, `Competencia` | Sim | `competence`, `due_date` quando aplicavel |
| `status` | `Status`, `Situacao` | Nao | `status`, padrao `Em aberto` |
| `payment_method` | `Pagamento`, `Metodo de pagamento` | Nao | `payment_method` |
| `cycle` | `Classe`, `Ciclo` | Nao | `cycle` |
| `installment` | `Parcela` | Nao | `installment_no`, `total_installments` |
| `external_id` | `Id`, `Identificador`, `source_reference_id`, `Referencia` | Nao | `source_reference_id` |

Campos fixos do pipeline:

- `type=saida`
- `import_source=saidas_xlsx`
- `source_channel=spreadsheet_import`
- `source_mode=import`
- `schema_version=1`

## Entradas XLSX

Colunas aceitas:

| Campo canonico | Aliases aceitos | Obrigatorio | Destino |
| --- | --- | --- | --- |
| `competence` | `Competencia` | Sim | `competence`, `occurred_date`, `due_date` |
| `description` | `Desc`, `Descricao`, `Description` | Sim | `description`, `earning_type`, `macro_category`, `cycle` quando suportado |
| `amount` | `Valores`, `Valor`, `Amount` | Sim | `amount` |
| `person` | `Pessoa`, `Quem recebe`, `Responsavel` | Sim | `person` |
| `external_id` | `Id`, `Identificador`, `source_reference_id` | Nao | `source_reference_id` |

Descricoes de entrada suportadas:

| Entrada na planilha | Payload normalizado |
| --- | --- |
| `Inicio do mes` | `description=Inicio do mes`, `earning_type=Inicio do mes`, `macro_category=Rendimento`, `cycle=INICIO_MES` |
| `Quinzena` | `description=Quinzena`, `earning_type=Quinzena`, `macro_category=Rendimento`, `cycle=QUINZENA` |
| `HE` | `description=Hora Extra`, `earning_type=Hora Extra`, `macro_category=Rendimento` |
| `DSR H.E`, `DSR H E`, `DSR HE` | `description=DSR H.E.`, `earning_type=DSR H.E.`, `macro_category=Rendimento` |
| `Salario Base` | `description=Salario Base`, `earning_type=Salario Base`, `macro_category=Referencia Salarial` |
| `Salario Bruto` | `description=Salario Bruto`, `earning_type=Salario Bruto`, `macro_category=Referencia Salarial` |

Campos fixos do pipeline:

- `type=entrada`
- `status=Pago`
- `import_source=entradas_xlsx`
- `source_channel=spreadsheet_import`
- `source_mode=import`
- `schema_version=1`

## Idempotencia e compatibilidade

- O mesmo conteudo com outro nome de arquivo gera o mesmo fingerprint canonico.
- Linhas com o mesmo `source_reference_id` e payload equivalente viram `duplicate_in_file`, `already_imported` ou `legacy_match`.
- Mesma identidade com payload diferente vira `conflict`.
- `legacy_import_signature` e `legacy_import_core_signature` sao usados somente para reconhecer registros antigos e nao entram no payload financeiro persistido.
- Linhas com erro de parser ficam visiveis no preview como `invalid` e nao sao persistidas.

## Interface ativa - 06/09/2026

O mapeamento XLSX continua centralizado em `src/application/imports/spreadsheetImportParser.js`. A UI ativa carrega esse parser de forma dinamica somente quando o usuario seleciona planilha e nao duplica aliases, normalizacao, fingerprints, regras de status ou deduplicacao.

O caminho visual novo e:

`loadImportActiveUi` -> `importActiveUi` -> `importController` -> `spreadsheetImportParser` -> `PrepareImportBatch` -> `importPreviewReadModel` -> `importPresenter` -> `CommitImportBatch`.

Importacao bancaria/CSV permanece no renderer legado compatibilizado e nao compartilha fingerprints com XLSX fora dos contratos existentes.
