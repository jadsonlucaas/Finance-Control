# Fase 4: Migracao Dos Scripts Pequenos

## Migrado neste lote

| Origem antiga | Novo modulo | Responsabilidade | Status |
| --- | --- | --- | --- |
| `src/legacy/inline/part-01.js` | `src/legacy/storageSync.js` | Virtualizacao em memoria das chaves `finance-control-*` do `localStorage` e ponte com `cloudLocalStorageSync`. | Migrado e removido do HTML. |
| `src/legacy/inline/part-02.js` | `src/legacy/iconScheduler.js` | Coalescer chamadas vazias de `lucide.createIcons()` em um unico `requestAnimationFrame`. | Migrado e removido do HTML. |

Os dois modulos sao instalados pelo bootstrap em `src/app.js`, antes dos servicos Firebase:

```js
installCloudMemoryStorage(globalThis);
installLucideIconScheduler(globalThis);
```

## Compatibilidade preservada

`storageSync.js` continua expondo as APIs usadas pelo servico de dados:

- `window.__financeCloudMemoryStorage`
- `window.__financeCloudLocalKeys`
- `window.__financeCloudLocalEntries`
- `window.__financeCloudSetMemoryStorage`
- `window.__financeCloudRemoveMemoryStorage`
- `window.__cloudLocalStorageVirtualInstalled`

`iconScheduler.js` continua usando:

- `window.__financeLucideSchedulerInstalled`
- `window.lucide.createIcons`

## Fora deste lote

`part-03.js` continua intocado porque e o maior bloco legado e concentra renderizacao, eventos e estado compartilhado.

Arquivos pequenos que sobrescrevem funcoes definidas por scripts anteriores tambem ficaram para lotes seguintes. Eles precisam de uma estrategia de instalacao apos os scripts legados carregarem, para nao mudar a ordem de execucao sem querer.

## Validacao

Executado em 2026-04-14:

```txt
npm.cmd run inventory:globals  OK, 64 entradas globais
npm.cmd test                   OK, 14 arquivos / 43 testes
npm.cmd run build              OK
npm.cmd run smoke              OK
```

O build ainda mostra warnings dos scripts classicos restantes, mas `part-01.js` e `part-02.js` ja nao aparecem mais nessa lista.
