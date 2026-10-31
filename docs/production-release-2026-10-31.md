# Primeiro go-live de produção — tentativa de 31/10/2026

Issue: #19  
Branch: `release/production-first-go-live`  
Candidato: `ff240e66caa691391ed728add40be67f7a890597`

## Resultado

Status: **BLOCKED BEFORE MUTATION / NO DEPLOY**.

A autorização P5 foi recebida, mas os gates bloqueantes do próprio preflight não estavam materializados. Nenhuma alteração de Auth, Firestore, Rules, indexes, Hosting, billing ou dados foi executada.

## Evidências confirmadas

| Item | Estado |
| --- | --- |
| Git worktree inicial | clean |
| CI do candidato na `main` | success |
| STAGING VALIDATED | incorporado à `main` |
| Observabilidade no código | incorporada à `main` |
| Target pretendido | `finance-control-cce4f` |
| Hosting site | `finance-control-cce4f` |
| URL | `https://finance-control-cce4f.web.app` |
| Release Hosting anterior | inexistente |
| Billing | desabilitado |
| Bucket GCS para export | inexistente/indisponível |
| `VITE_SENTRY_DSN` seguro | não configurado no ambiente de release |
| Segundo executor/observador | não registrado |

## Blockers

### Backup abrangente

O preflight exige export abrangente do Firestore antes da primeira mutação. O projeto não possui billing habilitado nem bucket GCS disponível para o export. Habilitar billing/criar infraestrutura envolve custo e autorização adicional e não foi inferido a partir do P5.

### Rollback Hosting

O canal live não possui release anterior. A holding/rollback candidate prevista no runbook ainda não existe e não foi testada.

### Sentry production

A integração está no código, mas o ambiente de release não fornece `VITE_SENTRY_DSN`. Sem DSN, o adaptador permanece noop e a observabilidade mínima ativa exigida pelo P5 não pode ser comprovada.

### Operação em duas pessoas

O preflight exige segundo executor/observador registrado. Somente o owner primário está definido.

## Condições para retomar

- autorização explícita para a solução de backup, incluindo billing/custo se essa for a opção escolhida;
- bucket protegido e export Firestore concluído, com manifest/hash e validação de leitura;
- rollback candidate Hosting criada e validada;
- DSN do projeto Sentry production injetado fora do Git;
- segundo executor/observador e janela calendarizada registrados na Issue #19;
- novo CI/build/guard/scan no SHA final.

Somente após esses itens o P5 pode retomar antes da primeira mutação. P6 não foi executado porque não houve deploy.
