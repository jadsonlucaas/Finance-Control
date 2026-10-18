# Medicao de Performance

Este documento define como medir o sistema antes e depois de cada refatoracao.

## Status do baseline

Nao existe um baseline historico gravado antes das etapas 1 a 9. A partir da etapa 10, o projeto passa a ter instrumentacao para registrar snapshots comparaveis.

Use este ponto como `baseline-pos-etapa-9` antes de novas refatoracoes de UI, handlers dinamicos ou dashboard.

## Metricas coletadas

- Tamanho inicial carregado: `resources.transferKB`, `resources.encodedKB`, `resources.decodedKB`.
- Tempo ate primeira tela: `timing.firstContentfulPaint` e `timing.firstScreenApproximation`.
- Tempo para trocar abas: `summary.switchTab`.
- Tempo para renderizar dashboard: `summary.renderDashboard`.
- Tempo para importar XLSX: `summary.importSaidasSpreadsheet` e `summary.importEntradasSpreadsheet`.
- Tempo para gerar PDF: `summary.exportPDF`.
- Uso de memoria: `memory.usedJSHeapSize`, quando o navegador expuser `performance.memory`.
- Quantidade de renders por mudanca de filtro: `counts.dashboardFilterChanges`, `counts.renderDashboard` e `dashboardRendersByFilterChange`.

## Como coletar manualmente

1. Abra a aplicacao no navegador.
2. Execute os fluxos da checklist em `docs/behavior-freeze.md`.
3. No DevTools, rode:

```js
window.financePerformance.getReport('baseline-pos-etapa-9')
```

4. Para salvar um snapshot no `localStorage`:

```js
window.financePerformance.saveBaseline('baseline-pos-etapa-9')
```

5. Depois de uma nova refatoracao, colete outro snapshot:

```js
const before = window.financePerformance.getBaselines().find((item) => item.label === 'baseline-pos-etapa-9');
window.financePerformance.compareReports(before, window.financePerformance.getReport('after-refactor'))
```

## Como coletar via automacao

Quando Node/npm estiver disponivel:

```bash
npm install
npm run dev
```

Em outro terminal:

```bash
npm run perf:audit
```

Por padrao, o teste usa `http://127.0.0.1:5173`. Para outro endereco:

```bash
PERF_APP_URL=http://127.0.0.1:4173 npm run perf:audit
```

## Criterios de regressao

Use os limites abaixo como alerta, nao como bloqueio automatico enquanto o app ainda esta em migracao:

- Aumento de mais de 15% no `resources.transferKB`.
- Aumento de mais de 20% em `summary.switchTab.average`.
- Aumento de mais de 20% em `summary.renderDashboard.average`.
- Mais de 1 render de dashboard por mudanca simples de filtro, salvo quando houver atualizacao explicita de graficos.
- Crescimento continuo de `memory.usedJSHeapSize` apos navegar repetidamente entre as telas.

## Observacoes tecnicas

- `performance.memory` nao existe em todos os navegadores.
- Importacao XLSX e PDF so geram metricas depois que o usuario executa os fluxos.
- O monitor nao envia dados para fora do navegador.
- A coleta usa uma fila em memoria limitada a 300 medidas recentes para evitar crescimento indefinido.
