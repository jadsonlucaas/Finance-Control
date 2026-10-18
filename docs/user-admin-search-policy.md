# Politica de busca administrativa de usuarios

Gerado em: 2026-09-05

## Suporte atual

| Busca/filtro | Suporte | Politica |
| --- | --- | --- |
| `status` | Server-side | Permitido por `where status == valor` |
| `role` | Server-side | Permitido por `where role == valor` |
| `status + role` | Server-side | Permitido com indice composto declarado |
| Ordenacao | Server-side | Campo canonico `email asc`, tie-breaker `__name__ asc` |
| UID exato | Server-side pontual | Usar `getProfile(uid)` quando houver fluxo especifico |
| Nome/email substring | Nao escalavel nesta fase | Apenas filtro local sobre pagina carregada |

## Regras

- Nao chamar busca por nome/email de full-text enquanto nao houver infraestrutura dedicada.
- Nao carregar todos os usuarios para simular busca global.
- Nao aplicar `getAll + filter` para esconder ausencia de indice.
- Busca textual no campo da UI deve ser apresentada como "Buscar na pagina".
- Filtros `status`, `role` e `status + role` resetam cursor e iniciam nova consulta server-side.
- Cursor e opaco para UI/application; nenhum `DocumentSnapshot` deve sair do adapter.

## Estrategia futura

Busca global por nome/email deve ser feita em etapa separada, com uma destas opcoes:

- backend confiavel com campos normalizados e consultas de prefixo planejadas;
- provedor externo de busca com sincronizacao e governanca propria;
- indice auxiliar server-side, com testes de consistencia e autorizacao.

Nenhuma dessas opcoes foi implementada nesta fase.

