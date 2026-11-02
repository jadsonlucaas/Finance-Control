# Release de produção — Hosting-only

Este procedimento é um overlay restrito aos arquivos estáticos do Firebase Hosting. Ele não autoriza alterações em Auth, Firestore, Rules, indexes, Functions, Storage, dados ou configurações do projeto.

## Classificação dos gates

| Gate | Hosting estático | Operações mutáveis |
| --- | --- | --- |
| projeto explícito, production e emuladores desligados | HARD_SECURITY | HARD_SECURITY |
| CI verde, commit exato, árvore limpa e build validado | HARD_TECHNICAL | HARD_TECHNICAL |
| Firebase, dual-write/shadow-read desligados | HARD_SECURITY | HARD_SECURITY |
| bundle sem segredo, staging, Supabase ou emulator | HARD_SECURITY | HARD_SECURITY |
| rollback por commit anterior reproduzível | HARD_TECHNICAL | HARD_TECHNICAL |
| backup integral de dados | aviso operacional | HARD_SECURITY |
| Sentry sem DSN, operando em noop | OPTIONAL_OBSERVABILITY | conforme risco |
| segundo executor/observador | aviso operacional | conforme runbook |

A dispensa de backup vale somente porque Hosting estático não grava dados. Não vale para Rules, indexes, Auth, migrações ou qualquer mutação de dados.

## Comando permitido

Após `HOSTING DEPLOY GO`, o único comando autorizado é:

```text
firebase deploy --only hosting --project finance-control-cce4f
```

Aliases, escopos combinados e outros projetos são proibidos. O preflight roda na `main`, limpa, no commit aprovado e exige CI verde. `VITE_DATA_BACKEND=firebase`, `VITE_DATA_DUAL_WRITE=false` e `VITE_DATA_SHADOW_READ=false` são obrigatórias.

## Rollback e smoke

Antes do deploy, preservar o artefato reproduzível do commit anterior. Em regressão de bootstrap, login, autorização ou assets, publicar esse artefato com o mesmo escopo Hosting-only. Após o deploy, verificar carregamento, requests e login inválido; perfis active/pending/inactive só com credenciais sintéticas preexistentes. Não criar ou alterar usuários de produção para gerar evidência.
