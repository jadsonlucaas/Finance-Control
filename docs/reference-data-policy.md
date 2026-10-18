# Politica de referencias globais e pessoais

Gerado em: 2026-07-18

## Escopos

`global` representa referencias compartilhadas por todos os usuarios ativos. `personal` representa referencias privadas do usuario autenticado.

## Modelo de dados

Macro global:

- colecao: `shared_macros`
- `type=macro`
- `macro_id`, `macro_category`, `shared_scope=global`, `owner_uid`, `owner_email`, `created_at`, `updated_at`, `schema_version`

Categoria global:

- colecao: `shared_categories`
- `type=categoria`
- `category_id`, `category_name`, `macro_id`, `macro_category`, `category_color`, `category_icon`, `shared_scope=global`, `owner_uid`, `owner_email`, `created_at`, `updated_at`, `schema_version`

Macro/categoria pessoal:

- colecao: `users/{uid}/finance_records`
- `shared_scope=personal`
- `owner_uid` deve ser o uid do caminho
- invisivel para outros usuarios

## Permissoes

- Usuario `active` le referencias globais e suas proprias referencias pessoais.
- Usuario comum `active` cria, edita e exclui apenas referencias pessoais.
- Usuario comum nao cria, edita ou exclui `shared_*`.
- Admin por custom claim ou perfil `admin/owner active` mantem referencias globais.
- `pending`, `inactive` e usuario sem perfil nao acessam referencias financeiras.

## Criacao

- Sem `shared_scope`, macro/categoria criada no cliente e normalizada como `personal`.
- `shared_scope=global` so deve ser usado em area administrativa explicita.
- `ensureDefaultSharedReferences` nao tenta escrita global para usuario comum.

## Edicao

- Edicao preserva escopo.
- Nao ha conversao silenciosa entre `personal` e `global`.
- Mudanca de escopo futura deve ser caso de uso proprio.

## Exclusao

- Referencia global exige admin.
- Referencia pessoal exige proprietario `active`.
- Se houver lancamento usando a macro/categoria, a exclusao e bloqueada para preservar historico.
- Nenhum lancamento financeiro e apagado ao excluir referencia.

## Combinacao

`buildEffectiveReferences(globalReferences, personalReferences)` produz `effectiveMacros` e `effectiveCategories` de forma deterministica, sem depender da ordem do snapshot.

- Duplicatas exatas sao deduplicadas.
- Colisoes sao reportadas em `collisions`.
- Itens de outro `owner_uid` sao descartados da lista pessoal.
- Cada item preserva `reference_origin`.

## Legados

- Referencias sem `shared_scope` sao interpretadas como pessoais em modo de compatibilidade.
- Ausencia de `macro_id` ou `category_id` e reportada pelo dry-run.
- Lancamentos antigos continuam visiveis por `macro_category`, `subcategory`, `category_name`, cor e icone salvos no proprio registro.

## Referencias historicas

`resolveRecordCategory(record, effectiveReferences)` prioriza ID estavel, usa fallback por nome normalizado e retorna `orphaned` quando nao encontra referencia. Mesmo orfao, o lancamento nao desaparece.

## Uso futuro por integracoes

- Backend futuro deve consultar `effectiveMacros` e `effectiveCategories`.
- Chatbot nao cria regra paralela.
- Categorias nao pertencem ao canal.
- Identidade externa nao altera `owner_uid`.
- Nenhum codigo de WhatsApp foi implementado.
- Nenhum telefone deve ser armazenado em macros, categorias ou lancamentos por causa do canal.
