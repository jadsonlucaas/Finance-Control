# Fase 9: HTML Como Estrutura

## Migrado neste lote

A tela de autenticacao saiu do `index.html` estatico e foi para:

- `src/ui/templates/authTemplate.js`

O `index.html` agora mantem apenas:

```html
<div id="auth-root"></div>
```

E o bootstrap instala o template com:

```js
installInitialTemplates(document);
```

## Arquivo de instalacao

`src/ui/templates/installInitialTemplates.js` centraliza a montagem inicial dos templates que ainda precisam existir antes dos scripts legados conectarem eventos.

## Regra para os proximos templates

Migrar um bloco por vez e validar com smoke:

1. dashboard
2. saidas
3. entradas
4. configuracoes
5. modais compartilhados

O objetivo principal segue sendo tirar logica JS do HTML. A reducao de markup deve acontecer gradualmente, sem quebrar IDs usados pelo legado.
