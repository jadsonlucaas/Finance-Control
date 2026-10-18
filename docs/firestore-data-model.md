# Modelo De Dados Firestore

Este documento registra o modelo atual observado no codigo. Ele deve ser usado antes de qualquer migration para evitar perda de dados.

## Colecoes

### `users/{uid}/finance_records`

Registros privados do usuario autenticado.

Tipos principais:

- `saida`
- `entrada`
- `pessoa`
- `controle_horas`
- `salario_historico`
- regras e registros auxiliares com `type` especifico

Campos comuns:

- `type`
- `person`
- `macro_category`
- `subcategory`
- `description`
- `amount`
- `status`
- `payment_method`
- `occurred_date`
- `due_date`
- `competence`
- `paid_at`
- `installment_no`
- `total_installments`
- `parent_id`
- `earning_type`
- `cycle`
- `recurrence`
- `created_at`
- `archived`
- `archived_at`
- `owner_uid`
- `owner_email`

### `users/{uid}/local_storage`

Espelho em nuvem das chaves `finance-control-*`.

Campos:

- `key`
- `value`
- `updated_at`
- `owner_uid`
- `owner_email`

### `shared_macros`

Categorias macro globais compartilhadas.

Campos relevantes:

- `type: "macro"`
- `macro_category`
- `shared_scope: "global"`
- `owner_uid`
- `owner_email`

### `shared_categories`

Categorias globais compartilhadas.

Campos relevantes:

- `type: "categoria"`
- `macro_category`
- `category_name`
- `category_color`
- `category_icon`
- `shared_scope: "global"`
- `owner_uid`
- `owner_email`

## Indices Recomendados

Para bases maiores, revisar indices compostos:

- `users/{uid}/finance_records`: `type`, `competence`
- `users/{uid}/finance_records`: `type`, `person`, `competence`
- `users/{uid}/finance_records`: `type`, `status`, `competence`
- `users/{uid}/finance_records`: `type`, `archived`, `competence`
- `users/{uid}/finance_records`: `import_source`, `import_signature`
- `users/{uid}/finance_records`: `generated_percentage_rule`, `percentage_rule_id`

## Regras De Seguranca Recomendadas

As regras do Firestore devem garantir:

- usuario le e escreve apenas `users/{request.auth.uid}/...`;
- `owner_uid` de registros privados corresponde a `request.auth.uid`;
- colecoes compartilhadas aceitam escrita apenas de usuarios autorizados;
- exclusoes em massa exigem usuario autenticado;
- campos sensiveis de perfil/admin nao podem ser alterados por usuarios comuns.

## Migracoes Futuras

Antes de qualquer migration:

- exportar backup;
- rodar smoke;
- migrar em lote pequeno;
- registrar versao de schema no proprio registro;
- manter compatibilidade com registros sem versao;
- validar duplicidade por assinatura antes de criar registros novos.
