# Politica de modernizacao da Administracao de Usuarios

Gerado em: 2026-09-05

## Escopo

A modernizacao da Administracao de Usuarios e local, incremental e limitada a leitura, apresentacao e orquestracao do painel existente em Configuracoes. Nenhuma regra financeira, formula, Firestore Rule, Firebase real, deploy, WhatsApp, webhook, telefone, provider externo ou Admin SDK foi alterado ou adicionado.

## Fronteiras

- `src/application/userAdmin/userAdminPermissions.js` resolve permissoes de UI a partir de perfil e claims ja recebidos.
- `src/application/readModels/userAdminReadModel.js` monta lista, resumo, filtros, paginacao e acoes visuais sem DOM, `window` ou Firebase.
- `src/ui/admin/userAdminController.js` orquestra carregamento, duplo clique, erro e refresh por dependencias injetadas.
- `src/ui/admin/userAdminPresenter.js` renderiza o painel preservando seletores e atributos legados.
- `src/ui/admin/userAdminActiveUi.js` preserva as bridges `refreshManagedUsers`, `renderManagedUsers`, `setManagedUserRole`, `setManagedUserStatus` e `toggleManagedUserStatus`.

## Autoridade

A UI nao concede autoridade administrativa. Ela apenas reflete a Politica A ja adotada:

- `admin: true` em custom claim permite bootstrap e recuperacao administrativa.
- `role=admin` ou `role=owner` por perfil so administra quando o proprio perfil esta `active`.
- perfil `inactive` sem custom claim nao administra usuarios.
- perfil `inactive` com custom claim pode recuperar administrativamente, mas nao ganha acesso pessoal aos dados financeiros.

## Persistencia

`userAdminSdk.updateUser` continua sendo o ponto de mutacao. A validacao final permanece nas Rules e/ou em backend confiavel futuro. O adapter de Firestore para `listUsers({ pageSize, cursor, filters })` aceita `status` e `role` server-side, preservando `listUsers()` legado sem argumentos apenas para compatibilidade.

## Guardrails

- Nao criar API global nova.
- Nao mover bridges sem busca completa de consumidores.
- Nao usar Firebase direto nos modulos modernos de UI/read model.
- Nao carregar painel admin no bootstrap inicial.
- Nao emitir custom claim no cliente.
- Nao usar banco de producao em testes.

## Lacunas

A busca textual por nome/email no painel moderno e aplicada sobre o conjunto retornado pela fonte atual. Busca global indexada e validacao completa de indices compostos devem ser tratadas em etapa futura com Firebase Emulator antes de producao.

## Queries e busca - 05/09/2026

`status`, `role` e `status + role` foram validados no Firestore Emulator com 1.000 perfis sinteticos. Os indices compostos minimos estao declarados em `firestore.indexes.json` e documentados em `docs/user-admin-query-index-diagnostic.md`.

Busca por nome/email continua limitada a pagina carregada e aparece na UI como "Buscar na pagina". Nao ha full-text nativo Firestore, provider externo, backend ou scan completo nesta fase.
