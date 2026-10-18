# Fase 6: Store Simples De Estado Global

## Criado

O store central foi criado em `src/state/appState.js`.

Estado inicial:

```js
export const appState = {
  allRecords: [],
  currentTab: 'dashboard',
  chartInstances: {},
  editingRecordId: null,
  focusedDashboardCard: null
};
```

## Compatibilidade durante a transicao

`installAppStateGlobals()` instala accessors na `window` para manter os scripts legados funcionando:

- `window.allRecords`
- `window.currentTab`
- `window.chartInstances`
- `window.editingRecordId`
- `window.focusedDashboardCard`

Esses nomes continuam podendo ser lidos e atribuidos pelos scripts antigos, mas agora escrevem no `appState`.

## Bootstrap

`src/app.js` instala o store antes das outras bridges:

```js
installAppStateGlobals(globalThis, appState);
```

## Ajuste no legado

As declaracoes locais desses cinco estados foram removidas de `src/legacy/inline/part-03.js`.

Isso evita sombra lexical e permite que todos os `part-*` acessem os accessors globais ligados ao store.

## Proxima troca incremental

A partir daqui, cada area pode trocar gradualmente:

```js
allRecords
```

por:

```js
appState.allRecords
```

Ordem recomendada:

1. dashboard
2. entradas
3. saidas
4. configuracoes
5. horas
6. auth/importacao
