# Homologacao local de Administracao de Usuarios

Executado em: 19/09/2026

## Objetivo

Homologar os limites da Administracao de Usuarios no ambiente local, usando UI real com Vite, Auth Emulator e Firestore Emulator, sem Firebase real, sem Admin SDK, sem deploy e sem alterar Firestore Rules, Auth, politica administrativa, interface funcional, regras financeiras, budget, baseline, timeout ou retry.

## Ambiente

- Aplicacao local: `http://127.0.0.1:5178`
- Auth Emulator: `127.0.0.1:9099`
- Firestore Emulator: `127.0.0.1:8080`
- Projeto emulado: `demo-finance-control-local-e2e`
- Configuracao Playwright: `playwright.e2e-local.config.js`
- Spec: `tests/playwright/integration-local-user-admin.spec.js`

## Cobertura homologada

1. Usuario comum ativo autentica, acessa Configuracoes e nao visualiza o painel `#admin-users-panel`.
2. Usuario comum nao consegue listar `users` via `userAdminSdk.listUsers`.
3. Usuario comum nao consegue promover outro usuario via `userAdminSdk.updateUser`.
4. Usuario comum nao consegue ler ou escrever a colecao global `users` diretamente pelas Firestore Rules.
5. Usuario pending autentica no Auth Emulator, mas fica bloqueado na tela de acesso e nao entra na aplicacao.
6. Usuario inactive autentica no Auth Emulator, mas fica bloqueado na tela de acesso e nao entra na aplicacao.
7. Usuarios pending/inactive nao conseguem executar operacao administrativa nem leitura global de `users`.
8. Admin autorizado por perfil ativo em Firestore acessa a UI real de Administracao de Usuarios.
9. Listagem administrativa exibe pagina de 50 registros, com itens unicos, botao Proxima habilitado e Anterior desabilitado na primeira pagina.
10. Paginacao para segunda pagina nao duplica usuarios da primeira pagina.
11. Retorno para a pagina anterior preserva o conjunto original de usuarios.
12. Filtro server-side por `status=pending` retorna somente usuarios pending.
13. Filtro combinado `status=pending` e `role=admin` retorna somente usuarios pending com role admin.
14. Reset dos filtros volta para primeira pagina com 50 registros.
15. Busca textual continua explicitamente page-local: encontra usuario visivel na pagina atual e nao busca usuario de outra pagina.
16. Botao de autoatribuicao de role admin para o proprio admin permanece desabilitado quando presente na pagina.
17. Dados financeiros privados de outro usuario nao aparecem no DOM nem em `window.allRecords`.
18. O cliente nao expoe setter de custom claims.
19. O cliente nao importa Firebase Admin SDK.
20. Claims do token nao recebem `admin`, `role` ou `status` criados pelo cliente.

## Dados de teste

- Usuarios criados exclusivamente no Auth Emulator.
- Perfis e registros semeados exclusivamente no Firestore Emulator com `withSecurityRulesDisabled` para preparo de massa.
- Massa financeira privada criada em `users/{uid}/finance_records` somente para provar ausencia de vazamento na UI admin.
- Auth Emulator limpo antes/depois dos cenarios.
- Firestore Emulator limpo antes de cada teste.

## Lacunas preservadas

- Emissao real de custom claims por autoridade confiavel continua fora do cliente e exige backend/Admin SDK em ambiente controlado futuro.
- Busca textual global por nome/email continua nao implementada; a UI promete apenas busca na pagina atual.
- Edicao positiva de todos os estados/roles pela UI completa pode receber cenario dedicado futuro se a politica administrativa mudar.
- Nenhum teste desta etapa usa Firebase de producao ou dados reais.

## Resultado focado

| Comando | Resultado |
| --- | --- |
| `npx.cmd firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "npx.cmd playwright test tests/playwright/integration-local-user-admin.spec.js --config=playwright.e2e-local.config.js --reporter=line"` | Aprovado. `2 passed (17.5s)`, `Script exited successfully (code 0)`. Logs `PERMISSION_DENIED` fazem parte das tentativas negativas esperadas para provar bloqueios de privilegio. |

## Confirmacao

Nenhum deploy, push, pull, fetch, Firebase real, dado real, webhook, WhatsApp, telefone, provider externo ou Admin SDK foi executado nesta homologacao. Nenhuma regra financeira, Firestore Rules, Auth, politica administrativa, interface funcional, custom claim, budget, baseline, timeout ou retry foi alterado.
