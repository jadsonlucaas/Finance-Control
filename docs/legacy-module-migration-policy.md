# Politica de migracao de scripts legados para ES Modules

Esta politica orienta a reducao incremental do carregamento classico baseado em `eval` em `src/legacy/classicScripts.js`.

## Principios

- Migrar grupos pequenos, com baixo acoplamento e comportamento coberto por smoke/testes.
- Preservar ordem de bootstrap: modulos modernos instalam bridges antes dos scripts legados que ainda dependem delas.
- Nao remover o loader inteiro enquanto houver scripts `?raw` pendentes.
- Implementacao canonica deve ficar em ES Module com `export`/`import` explicitos.
- Import de modulo migrado nao deve executar side effects automaticos; bootstrap chama `installXxx()` explicitamente.
- Bridges em `window` sao temporarias e mantidas somente quando consumidores legados ainda exigem.
- Nenhuma regra financeira, tributaria, de horas, parcelamentos, recorrencias, importacao ou relatorio deve ser alterada durante migracao mecanica.
- Nenhum novo `eval`, `new Function` ou injeção de script por string e permitido.

## Whitelist de execucao dinamica

A unica execucao dinamica permitida nesta etapa e o loader legado documentado em `src/legacy/classicScripts.js`. O teste `tests/architecture/no-new-eval.test.js` bloqueia novas ocorrencias fora dessa whitelist.

## Bridge temporaria

Padrao para consumidores legados:

```js
export function installX(target = globalThis) {
  target.nomeGlobal = (...args) => nomeCanonico(...args);
}
```

No grupo migrado desta etapa, a bridge preservada e `target.financeEvents`, instalada por `installLegacyEventBindings(target)`.

## Compatibilidade futura

O backend futuro deve importar apenas dominio/aplicacao/casos de uso. Ele nao deve carregar `src/legacy/inline`, `classicScripts.js` nem bridges de UI. Nenhum WhatsApp, webhook, telefone, Meta API ou Firebase Admin SDK foi implementado.
