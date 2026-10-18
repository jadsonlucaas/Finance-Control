# Fase 8: Chart.js E Lucide Locais

## Migrado

Chart.js e Lucide deixaram de ser carregados por CDN no `index.html`.

Removido:

```html
<script src="https://cdn.jsdelivr.net/npm/lucide@.../lucide.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/.../chart.min.js"></script>
```

## Dependencias locais

Instalado via npm:

```txt
chart.js
lucide
```

## Bridge de compatibilidade

`src/services/localVisualLibraries.js` importa:

```js
import { Chart } from 'chart.js/auto';
import { createIcons, icons } from 'lucide';
```

`src/app.js` instala essa bridge no bootstrap e publica:

```js
window.Chart = Chart;
window.lucide = { createIcons, icons };
```

O wrapper de `lucide.createIcons()` injeta `icons` automaticamente para preservar a API legada que chama `lucide.createIcons()` sem argumentos.

## Observacao

`src/services/libraryLoader.global.js` ainda carrega bibliotecas de PDF/planilha sob demanda via CDN. Essa fase removeu apenas Chart.js e Lucide, que eram dependencias visuais centrais da tela.
