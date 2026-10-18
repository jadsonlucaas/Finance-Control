# Plano de provisionamento de staging

Executado em: 19/09/2026

Este plano e operacional e futuro. Ele nao executa criacao de projeto, login, deploy, rules deploy, indexes deploy ou escrita em Firebase real.

## Sequencia segura

1. Criar projeto Firebase isolado de staging fora deste fluxo local.
2. Registrar owner responsavel pelo projeto e pela janela de homologacao.
3. Criar Web App de staging e registrar somente configuracoes web publicas.
4. Configurar Authentication somente com provedores necessarios para homologacao.
5. Aplicar `firestore.rules` e `firestore.indexes.json` no projeto staging por processo revisado, sempre com `--project <staging-project-id>`.
6. Criar usuarios ficticios de staging e perfis `users/{uid}` correspondentes.
7. Popular somente massa sintetica descrita em `docs/staging-synthetic-data-plan.md`.
8. Executar smoke pos-deploy descrito em `docs/staging-post-deploy-smoke.md`.
9. Registrar GO/NO-GO em `docs/staging-go-no-go.md`.

## Regras de alvo

- Nunca usar o default de `.firebaserc` para staging.
- Nunca executar comando sem `--project <staging-project-id>` em operacoes Firebase.
- Nunca usar service account no frontend.
- Nunca emitir custom claim pelo cliente.
- Nunca restaurar backup real sem runbook e backend confiavel.

## Inventario Firestore

| Arquivo | Uso | Observacao |
| --- | --- | --- |
| `firestore.rules` | regras de acesso | aplicar somente apos revisao manual e testes com Emulator |
| `firestore.indexes.json` | indices compostos | contem 3 indices em `users` para filtros administrativos |

## Lacunas antes de producao

- Staging real ainda nao homologado.
- Build com configuracao Firebase staging ainda nao publicado.
- Monitoramento real, rollback operacional e comunicacao de release ainda nao definidos.
- Dados historicos reais ainda nao auditados nem migrados.
