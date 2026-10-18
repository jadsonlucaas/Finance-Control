# Politica de Conectividade

Data: 2026-08-30

## Contrato

`ConnectivityService` expoe:

- `getStatus()`;
- `isOnline()`;
- `subscribe(listener)`.

Implementacoes:

- `BrowserConnectivityService`;
- `InMemoryConnectivityService`.

## Regras

- Somente o adapter browser acessa `navigator.onLine` e eventos `online`/`offline`.
- Dominio, aplicacao, repositorios e use cases nao acessam `navigator` diretamente.
- Estado offline nao altera dados financeiros.
- Nao existe fila automatica de mutacoes offline nesta etapa.
- UI pode preservar formulario e mostrar estado offline/stale.
- Operacao nao salva nao deve ser apresentada como sucesso.

## Estados

| Estado | Uso |
| --- | --- |
| `online` | Cliente com conectividade conhecida. |
| `offline` | Cliente sem conectividade conhecida. |
| `unknown` | Ambiente sem API de navegador ou estado indeterminado. |

## Testes

Coberto por Vitest em `tests/application/resilience/errorResilience.test.js`, teste arquitetural em `tests/architecture/resilience-architecture.test.js` e pilotos Playwright locais.

