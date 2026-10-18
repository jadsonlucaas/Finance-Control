# Criterios GO/NO-GO de staging

Executado em: 19/09/2026

## Decisao local atual

GO para provisionar staging isolado: sim.

GO para producao: nao.

GO para deploy automatico a partir desta maquina: nao.

## GO para iniciar homologacao em staging

- Worktree limpo e commit aprovado.
- Manifest gerado e conferido.
- Build local aprovado.
- Vitest, smoke, gates de arquitetura e E2E em Emulator aprovados.
- Homologacao local de UX/mobile/acessibilidade aprovada em `tests/playwright/release-ux-accessibility.spec.js`.
- Projeto staging separado confirmado.
- Comandos Firebase futuros sempre com `--project <staging-project-id>`.
- Massa sintetica preparada.

## NO-GO imediato

- Qualquer falha em Rules/Auth/E2E local.
- Build com variaveis de Emulator ativas para staging real.
- Comando Firebase sem `--project` explicito.
- Uso de dados reais.
- Necessidade de alterar regra financeira, Firestore Rules, Auth ou budget para passar teste.
- Restore real sem backend confiavel.
- Presenca de credencial, service account ou chave privada no repositório.

## GO para producao futura

Somente apos staging aprovado, UX/manual em staging real assinado, rollback ensaiado, monitoramento definido, dados historicos auditados, responsavel de release nomeado e checklist de deploy futuro totalmente assinado.

## Adendo 7.3

Decisao atual: STAGING NOT VALIDATED.

Motivo: projeto staging real criado e separado da producao; Firestore Database, Rules, Indexes e Hosting staging foram provisionados. O bloqueio atual e Firebase Auth: `identityPlatform:initializeAuth` retornou `BILLING_NOT_ENABLED`, e signup/configuracao retornaram `CONFIGURATION_NOT_FOUND`.

Enquanto Auth nao for resolvido, permanecem NO-GO: usuarios sinteticos, dados sinteticos autenticados, smoke real autenticado, E2E staging completa, isolamento A -> B, import XLSX, horas, backup/dry-run e admin em staging.

Validacao parcial aprovada: URL real staging carrega, runtime Firebase usa `finance-control-staging-260919`, e o teste Playwright de staging nao detectou requests para `finance-control-cce4f`.

Producao continua NO-GO para deploy.
# Atualização 7.3F

**NO-GO / STAGING NOT VALIDATED.** O lifecycle de autenticação foi estabilizado e passou em três rodadas consecutivas, mas o backup produzido pela UI é rejeitado pela própria validação com `ORPHAN_REFERENCE` em parcelas cujo `parent_id` não possui pai correspondente no snapshot. Dry-run e homologação integral permanecem bloqueados. Produção continua `NOT READY FOR PRODUCTION DEPLOY`.
# Decisão após 7.3H

O isolamento local está validado, porém staging continua **NO-GO / NOT VALIDATED** até a retomada explícita dos fluxos cloud em outra execução. Produção continua fora de escopo e **NOT READY**.
# Decisão 7.3I

**NO-GO / STAGING NOT VALIDATED** apesar do staging-critical 7/7. Bloqueadores: XLSX real, auditoria real, settings/references real, cobertura mobile ampliada e rollback frontend ainda não revalidados. Produção permanece **NOT READY FOR PRODUCTION DEPLOY**.
