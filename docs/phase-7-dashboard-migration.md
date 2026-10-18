# Fase 7: Migracao Do Dashboard

## Modulos criados

- `src/ui/dashboard/dashboardFilters.js`
- `src/ui/dashboard/dashboardData.js`
- `src/ui/dashboard/dashboardCards.js`
- `src/ui/dashboard/dashboardCharts.js`
- `src/ui/dashboard/dashboardEvents.js`
- `src/ui/dashboard/dashboardRenderer.js`

## Carregamento

O script classico `src/legacy/inline/part-32.js` foi removido.

O dashboard agora e instalado por:

```html
<script type="module" src="/src/ui/dashboard/dashboardRenderer.js"></script>
```

Ele fica depois dos scripts legados restantes para capturar funcoes ainda necessarias, como o render legado do grafico de tendencia e dos cards por pessoa.

## Compatibilidade mantida

Durante a transicao, `dashboardRenderer.js` ainda expoe:

- `window.renderDashboard`
- `window.scheduleDashboardRender`
- `window.shiftDashboardCompetenceRange`
- `window.getDashboardBaseSaidas`
- `window.getDashboardBaseEntradas`
- `window.getDashboardEntradasSummary`
- `window.getDashboardPersonBalances`
- `window.getDashboardAggregations`
- `window.renderDashboardChartsFromAggregations`
- `window.renderTrendChartByDashboardFilter`
- `window.upsertDashboardChart`

Tambem cria `window.financeDashboard` como API modular do bloco.

## Performance

Os graficos principais continuam usando `upsertDashboardChart()` com `update('none')`, evitando destruir e recriar Chart.js quando muda apenas o filtro.

## Proximo passo

Substituir as dependencias legadas ainda chamadas pelo dashboard:

- grafico de tendencia vindo de `part-25.js`
- cards por pessoa vindos de scripts anteriores
- modais de detalhe de despesas
