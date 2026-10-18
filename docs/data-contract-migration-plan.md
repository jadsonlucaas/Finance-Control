# Plano de migracao dos contratos financeiros

Atualizado em: 18/07/2026

## Escopo desta etapa

Esta etapa cria contratos, validadores, normalizadores e dry-run local. Nenhum dado real foi migrado, nenhum Firestore real foi escrito e nenhuma rotina de producao foi criada.

## Dry-run

Usar `buildFinanceRecordDryRun(records)` com fixtures locais ou JSON exportado manualmente para memoria. O dry-run classifica cada item como:

- `valid_current`;
- `valid_legacy_with_warning`;
- `invalid`.

Tambem registra campo desconhecido, alias convertido, enum invalido, data invalida, owner ausente, `schema_version` ausente, metadata futura invalida e inconsistencias entre campos derivados.

## Estrategia futura

1. Exportar backup completo antes de qualquer migracao real.
2. Rodar dry-run local sobre copia sem credenciais de producao no cliente.
3. Revisar relatorio por tipo e corrigir contratos que estejam rigidos demais.
4. Criar script administrativo separado, idempotente e reversivel, se uma migracao real for aprovada.
5. Migrar primeiro aliases inofensivos em memoria; depois preencher `schema_version`.
6. Manter leitura de legado ate smoke, Rules, Vitest e Playwright passarem.

## Ordem sugerida

1. `macro` e `categoria`, ja cobertas pela politica global/pessoal.
2. `pessoa` e `salario_historico`.
3. `saida` e importacoes.
4. `entrada` e consolidacao.
5. `controle_horas`.
6. `percentage_rule` e materializacao de saidas.

## Backup e rollback

Toda migracao futura precisa de backup por colecao e por usuario. Rollback deve restaurar documentos originais por ID e remover apenas campos adicionados pela migracao aprovada.

## Criterios de corte

Nenhuma migracao deve ocorrer se houver:

- erro de contrato sem decisao documentada;
- divergencia de calculo;
- perda de owner;
- mudanca de `type`;
- falha em Rules, Auth Flow, Vitest, build, smoke ou Playwright.

## Proibicao de producao

E proibido executar este plano em producao nesta etapa. Tambem nao foi implementado WhatsApp, webhook, chatbot, Meta API, Firebase Admin SDK ou armazenamento de telefone.
