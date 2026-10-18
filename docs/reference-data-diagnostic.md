# Diagnostico de referencias globais e pessoais

Gerado em: 2026-07-18

## Comportamento atual encontrado

- Macros e categorias sao renderizadas a partir de `allRecords`, que combina registros pessoais e colecoes `shared_macros`/`shared_categories`.
- `dataSdk.create` enviava qualquer `type=macro` para `shared_macros` e qualquer `type=categoria` para `shared_categories`, mesmo quando a acao vinha de usuario comum.
- `firestore.rules` ja negava escrita comum em `shared_*`, criando divergencia entre botao visivel, destino de gravacao e permissao.
- `ensureDefaultSharedReferences` tentava inicializar defaults globais para qualquer usuario autenticado, dependendo de Rules para negar.
- Registros legados podem existir sem `shared_scope`, `macro_id` ou `category_id`.
- Lancamentos financeiros preservam `macro_category`, `subcategory`, `category_name`, `category_color` e `category_icon`, permitindo exibicao historica mesmo se uma referencia for excluida.

## Inconsistencias

- Usuario comum via UI parecia criar macro/categoria global, mas as Rules rejeitavam.
- Itens globais e pessoais apareciam misturados sem identificacao clara de origem.
- Botoes de editar/excluir podiam aparecer para referencia global em contexto comum.
- A combinacao antiga removia duplicatas por nome de forma silenciosa, favorecendo globais e escondendo pessoais conflitantes.
- Defaults globais eram tentados no cliente sem autoridade explicita.

## Dados legados previstos pelo codigo

- `type=macro` em `users/{uid}/finance_records`.
- `type=categoria` em `users/{uid}/finance_records`.
- `shared_macros` e `shared_categories` com `shared_scope=global`.
- Registros antigos sem `shared_scope`, sem `macro_id` e sem `category_id`.
- Lancamentos com apenas `macro_category` e `subcategory`.

## Riscos

- Vazamento logico se referencias pessoais de outro usuario forem combinadas.
- Falha de permissao para usuario comum tentando gravar global.
- Exclusao de macro/categoria ainda usada por lancamentos.
- Colisao de nomes entre global e pessoal com efeitos diferentes.
- Backend futuro duplicar regras se nao consumir o mesmo contrato efetivo.

## Politica proposta

- Referencias globais vivem apenas em `shared_macros` e `shared_categories`, com `shared_scope=global`.
- Referencias pessoais vivem em `users/{uid}/finance_records`, com `shared_scope=personal`.
- Usuario comum cria pessoal por padrao.
- Admin pode criar/manter global apenas por escolha explicita.
- Pending/inactive nao leem nem mantem referencias financeiras.
- Colisoes legadas sao reportadas, nao apagadas automaticamente.
- Exclusao destrutiva e bloqueada quando ha lancamento usando a referencia.

## Impactos de migracao

- Nao ha migracao automatica nesta etapa.
- Registros sem `shared_scope` sao tratados como pessoais no contrato local.
- IDs ausentes sao reportados pelo dry-run.
- A etapa futura deve classificar legados com backup, dry-run e validacao pos-migracao.

## Rollback

- O rollback local e voltar o commit desta etapa.
- Como nenhum dado real e migrado, nao ha rollback de dados.
- Em producao futura, rollback deve restaurar backup das colecoes e manter leitura por snapshot nos lancamentos.
