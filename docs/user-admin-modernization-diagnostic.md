# Diagnostico de modernizacao da Administracao de Usuarios

Executado em: 05/09/2026

## Escopo

Esta etapa cobre apenas a interface ativa de Administracao de Usuarios e ciclo de contas. Nao altera regras financeiras, formulas, Firestore Rules, Auth Rules, Planner, Dashboard, Controle de Horas, Configuracoes gerais, importacoes, backup/restore, tributos, parcelamentos, recorrencias, materializacao percentual, WhatsApp, webhook, provider externo, telefone ou Admin SDK.

## Estado atual

| Item | Estado encontrado |
| --- | --- |
| Renderizacao da lista | Fluxo legado em `src/legacy/inline/part-03.js`, dentro da area de Configuracoes |
| Handlers | Delegacao em `src/ui/legacy-events.js` para `setManagedUserRole`, `setManagedUserStatus` e `toggleManagedUserStatus` |
| Fonte de dados | `window.userAdminSdk.listUsers()` |
| Servico canonico atual | `src/services/userAdmin.js`, instalado por `src/services/installFirebaseServices.js` |
| Persistencia atual | `users/{uid}` no Firestore via `getDocs`, `getDoc`, `setDoc` e `updateDoc` dentro do service |
| Paginacao | `listUsers()` carrega todos os usuarios e ordena localmente por email; nao usa `limit`/cursor |
| Campos exibidos | uid/email, role, status e acoes derivadas do estado |
| Acoes existentes | Aprovar, desativar, reativar e alterar role quando ja exposto pelo painel |
| Auditoria | `userAdmin.updateUser` chama `auditService.logLater` depois do update confirmado |
| Double click | Protegido parcialmente na UI/testes existentes por desabilitacao visual durante chamada |
| Erros | Erros de update preservam estado visual anterior em testes Playwright |
| UI decide autoridade | A UI decide botoes por estado local; a autoridade real continua nas Rules/service |
| Firebase direto na UI | O caminho legado nao importa Firebase direto, mas depende de `window.userAdminSdk` global |
| `window.financeApp` | Nao deve ser dependencia de negocio em modulos modernos; pode aparecer apenas em composition root/bridge |
| Scripts classicos envolvidos | Principalmente `part-03.js`; handlers em `legacy-events.js` |
| Bridges globais | `setManagedUserRole`, `setManagedUserStatus`, `toggleManagedUserStatus` |

## Politica existente preservada

- `pending`, `active` e `inactive` preservam os significados documentados em `docs/account-lifecycle.md`.
- Usuario comum nao administra perfis.
- Admin por role so administra quando seu perfil esta `active`.
- `owner` equivale a autoridade administrativa por perfil ativo.
- Admin por custom claim e autoridade confiavel para bootstrap/recuperacao.
- Cliente nao cria, edita ou simula custom claim.
- Usuario comum nao altera proprio role/status.
- Role e claim permanecem conceitos distintos.

## Riscos

- `listUsers()` sem paginacao real pode escalar mal e incentiva slice local.
- A UI legada acopla renderizacao e handlers globais, dificultando prova de ausencia de duplicidade.
- Payload manipulado precisa continuar sendo barrado no service/Rules, nao apenas por botao oculto.
- Cache/lista administrativa deve ser limpo em logout e troca de sessao para evitar vazamento visual.
- Falha de rede nao pode exibir sucesso nem emitir auditoria de sucesso.
- Role admin inactive nao pode administrar se a autoridade vier apenas do perfil.

## Sequencia segura

1. Criar read model puro para lista, filtros, pagina e allowed actions refletidos.
2. Criar adapter/repository web lazy que encapsula `userAdminSdk` e usa query paginada quando disponivel.
3. Criar controller/presenter modernos com `AsyncViewState`, pending action e reset de lifecycle.
4. Instalar active UI lazy por bridge sem criar novo global.
5. Manter `userAdminSdk.updateUser` como autoridade de update/auditoria.
6. Validar com Vitest, Playwright local, bundle budget e Auth/Rules Emulator.
