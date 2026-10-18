# Plano de migracao de referencias

Gerado em: 2026-07-18

## Estado desta etapa

Nenhuma migracao real foi executada. A rotina disponivel e `buildReferenceDataDryRun(records, options)`, que aceita fixtures ou registros em memoria e retorna diagnostico sem escrita.

## Dry-run

O dry-run reporta:

- macros globais;
- categorias globais;
- macros pessoais;
- categorias pessoais;
- registros sem `shared_scope`;
- IDs ausentes;
- duplicidades;
- colisoes;
- referencias orfas;
- sugestoes de acao.

## Estrategia futura

1. Exportar backup completo das colecoes afetadas.
2. Rodar dry-run em copia local ou fixture sanitizada.
3. Classificar cada referencia legada como `global` ou `personal`.
4. Gerar IDs estaveis quando ausentes.
5. Resolver colisoes manualmente.
6. Validar que lancamentos continuam exibindo snapshots historicos.
7. Executar migracao idempotente apenas com ferramenta confiavel.
8. Rodar Rules, Vitest, Playwright e smoke.

## Idempotencia

Operacoes futuras devem usar IDs deterministas e nao duplicar referencias ja migradas.

## Rollback

Rollback deve restaurar backup das colecoes e manter lancamentos intocados. Como esta etapa nao escreveu dados reais, nao ha rollback operacional.

## Proibicao

E proibido executar este plano em producao nesta etapa. Tambem nao foi implementado Firebase Admin SDK, webhook, chatbot ou integracao WhatsApp.
