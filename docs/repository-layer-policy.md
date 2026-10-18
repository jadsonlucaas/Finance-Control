# Politica da camada formal de repositorios

A camada formal de repositorios fica em `src/application/repositories`. A escolha por `application` e intencional: os contratos descrevem portas da aplicacao, nao entidades puras de dominio nem detalhes de infraestrutura.

## Principios

- Interfaces nao importam Firebase, DOM, `window`, componentes de UI ou localStorage.
- Casos de uso e handlers recebem repositorios por dependencia.
- Firebase Web SDK e `dataSdk` ficam encapsulados em adaptadores.
- In-memory e somente para testes, desenvolvimento isolado e simulacoes.
- Erros de infraestrutura viram codigos estaveis de repositorio antes de chegar ao gateway.
- Regras financeiras permanecem acima da infraestrutura; repositorio nao recalcula impostos, parcelamentos, recorrencias ou horas.
- Casos de uso em `src/application/useCases` sao os consumidores canonicos das interfaces de repositorio para comandos financeiros.
- `source_channel` e metadado, nao permissao e nao seletor de repositorio privilegiado.
- `ownerUid` vem do contexto autenticado/autorizado, nao de texto livre de payload.

## Implementacoes

- `InMemory*Repository`: deterministicas, isoladas por owner e sem Firebase.
- `Firebase*Repository`: adaptadores web sobre os facades atuais (`FinanceRepository`, `dataSdk`, `userAdminSdk`, `cloudLocalStorageSync`, `auditSdk`).
- `createApplicationDependencies()`: composition root que escolhe explicitamente modo `web` ou `test`.

## Fluxo de arquitetura

```text
UI / Future Backend
        |
        v
Application Gateway
        |
        v
Handlers
        |
        v
Use Cases
        |
        v
Repository Interfaces
       / \
      /   \
InMemory   Firebase Web Adapter
(test)     (web runtime)
               |
               v
          dataSdk / Firestore
```

## Legado

`window.dataSdk`, `window.financeRepository` e bridges globais continuam existindo. Eles sao compatibilidade durante a migracao. A implementacao canonica do gateway passa a receber `repositories.financeRecords`, mas o adapter web ainda pode reutilizar `FinanceRepository`/`dataSdk` internamente ate a migracao completa.

## Fora do escopo

- Firebase Admin SDK.
- Backend server-side real.
- WhatsApp, webhook, Meta API, provedor externo, telefone ou mensagem.
- Nova permissao publica.
- Reescrita do cache/snapshot.
- Alteracao de regras financeiras.
