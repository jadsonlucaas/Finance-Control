# Firebase e Regras de Seguranca

## Objetivo

O app usa Firebase como banco principal. Importar Firebase por dependencia local (`firebase/*`) nao troca o projeto nem corta vinculo com o banco: apenas coloca o SDK dentro do build do Vite.

## Arquivos

- `src/services/firebase.js`: inicializacao do app Firebase.
- `src/services/auth.js`: autenticacao.
- `src/services/dataSdk.js`: leitura, cache local por usuario e escrita de registros financeiros.
- `src/services/userAdmin.js`: perfis de usuario e administracao.
- `src/services/audit.js`: registro de auditoria de acoes criticas.
- `firestore.rules`: regras Firestore versionadas.

## Modelo de acesso

- Cada usuario le e escreve somente `users/{uid}/finance_records`.
- `owner_uid` e `owner_email` sao gravados pelo app e nao podem ser alterados em updates.
- `local_storage` sincronizado fica em `users/{uid}/local_storage`.
- Auditoria fica em `users/{uid}/audit_logs`, com escrita append-only pelo usuario logado.
- `shared_macros` e `shared_categories` sao globais; leitura comum exige perfil ativo e escrita exige custom claim `admin: true` ou perfil ativo `admin`/`owner`.
- Perfis ficam em `users/{uid}` com `role` e `status`.

## Regras reforcadas

- lookup de perfil usa verificacao previa com `exists(...)`;
- admin por claim e por perfil foram separados em helpers dedicados;
- custom claim `admin: true` e autoridade administrativa independente para bootstrap/recuperacao;
- acesso pessoal a subcolecoes proprias continua exigindo perfil `active`;
- `finance_records` exigem `type`, `owner_uid` e `owner_email` na escrita;
- `owner_uid` e `owner_email` ficam imutaveis em updates;
- `local_storage` exige `key`, `value`, `updated_at`, `owner_uid` e `owner_email`;
- escritas fora das colecoes permitidas continuam bloqueadas por deny-all final.

## Cache local por usuario

- o cache de registros usa chave por usuario: `finance-control-user-records-cache-v1-{uid}`;
- o cache local tem expiracao automatica de 15 minutos;
- caches expirados sao descartados antes de hidratar a UI;
- o estado da origem dos dados fica exposto em `window.__financeCacheState`;
- a aplicacao dispara o evento `financeCacheStateChanged` sempre que alterna entre cache local, Firebase ou logout;
- o logout limpa cache de registros, ponteiros ativos e dados locais sincronizados do usuario.

## Eventos auditados

- autenticacao: login, cadastro, logout;
- lancamentos: criar, editar, excluir, arquivar, reabrir, marcar pago;
- importacoes: inicio de importacao, criacao de registros importados e remocao;
- configuracoes: pessoa, macro, categoria, salario historico, tipos de hora extra;
- regras percentuais: salvar, atualizar e excluir;
- admin: alteracao de perfil, papel e status;
- PDF: solicitacao de exportacao.

## Bootstrap de admin

As regras bloqueiam elevacao de privilegio pelo cliente. Em modo empresarial, o primeiro admin deve ser criado por caminho confiavel:

1. Console do Firebase.
2. Script administrativo com Firebase Admin SDK.
3. Custom claim `admin: true`.

Politica adotada: custom claim confiavel independente. Um usuario com `admin: true` pode administrar perfis mesmo sem perfil Firestore ou com perfil `inactive`, permitindo bootstrap e recuperacao. Roles `admin` e `owner` gravadas em `users/{uid}` so concedem administracao quando o perfil esta `active`.

Isso nao libera acesso pessoal do usuario as proprias subcolecoes quando o perfil esta `inactive` ou ausente. Tambem nao permite que o cliente crie claims; claims devem ser emitidas por Console Firebase, script com Firebase Admin SDK ou outro backend confiavel.

Futura integracao WhatsApp/chatbot deve usar credencial server-side confiavel. Firebase Admin SDK server-side normalmente ignora Firestore Rules do cliente, mas as Rules continuam fechadas para navegadores e clientes nao confiaveis. Nenhum codigo de chatbot deve ser implementado no frontend para simular autoridade.

## Deploy

Instale/autentique Firebase CLI e rode:

```bash
npm run firebase:login
npm run firestore:deploy-rules
```

O projeto padrao ja esta apontado em `.firebaserc` para:

```text
finance-control-cce4f
```

Isso e importante porque o alerta do console Firebase sobre expiracao do modo de teste so desaparece depois que as regras versionadas de `firestore.rules` forem efetivamente publicadas no projeto real.

Antes de aplicar em producao, valide no Rules Playground:

- usuario comum cria e edita os proprios registros;
- usuario comum nao altera `owner_uid`;
- usuario comum nao escreve em `shared_macros` ou `shared_categories`;
- admin consegue gerenciar macros e categorias globais;
- usuario inativo nao le referencias globais;
- logout limpa dados financeiros locais do usuario anterior;
- cache expirado nao hidrata a tela.

## Administracao de Usuarios

Em 05/09/2026, `userAdminSdk.listUsers(query)` passou a aceitar consulta paginada com `limit`, `cursor`, `status` e `role`, mantendo `listUsers()` sem argumentos para compatibilidade legada. A mutacao de perfil/status continua em `userAdminSdk.updateUser` e a autorizacao definitiva permanece nas Firestore Rules.

Busca textual por nome/email ainda nao deve ser tratada como autorizacao nem como consulta global garantida: no painel moderno ela e filtro de UI sobre os itens retornados. Indices e consultas compostas devem ser validados com Firebase Emulator antes de qualquer uso de producao.
