import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCompetenceLabel, setLocale } from '../../src/core/i18n.js';
import {
  chartTranslationPlugin,
  registerChartTranslation,
  translatePdfDocument
} from '../../src/ui/i18n/chartAndPdfTranslation.js';

afterEach(async () => { await setLocale('pt-BR'); });

describe('meses no idioma da conta', () => {
  it('formata a competencia com o mes do idioma', async () => {
    expect(formatCompetenceLabel('2026-02')).toBe('fev/2026');
    await setLocale('es-ES');
    expect(formatCompetenceLabel('2026-02')).toBe('feb/2026');
    expect(formatCompetenceLabel('2026-12')).toBe('dic/2026');
    expect(formatCompetenceLabel('invalido')).toBe('invalido');
  });
});

describe('graficos', () => {
  it('em es-ES traduz rotulos e series; em pt-BR nao mexe', async () => {
    const chart = () => ({ data: { labels: ['Sem dados', 'Mercado'], datasets: [{ label: 'Gastos diários' }, { label: 'Entradas' }] } });
    const pt = chart();
    chartTranslationPlugin.beforeUpdate(pt);
    expect(pt.data.labels).toEqual(['Sem dados', 'Mercado']);
    await setLocale('es-ES');
    const es = chart();
    chartTranslationPlugin.beforeUpdate(es);
    expect(es.data.labels).toEqual(['Sin datos', 'Mercado']);
    expect(es.data.datasets.map((d) => d.label)).toEqual(['Gastos diarios', 'Ingresos']);
  });

  it('registra o plugin uma vez so', () => {
    const Chart = { register: vi.fn() };
    expect(registerChartTranslation(Chart)).toBe(true);
    expect(registerChartTranslation(Chart)).toBe(false);
    expect(Chart.register).toHaveBeenCalledTimes(1);
  });
});

describe('PDF', () => {
  function fakeDoc() {
    const calls = { text: [], table: [] };
    return {
      calls,
      text(value) { calls.text.push(value); },
      splitTextToSize(value) { return [value]; },
      autoTable(options) { calls.table.push(options); }
    };
  }

  it('em es-ES traduz titulos e tabelas; em pt-BR escreve igual', async () => {
    const pt = translatePdfDocument(fakeDoc());
    pt.text('Lancamentos', 0, 0);
    expect(pt.calls.text).toEqual(['Lancamentos']);

    await setLocale('es-ES');
    const doc = translatePdfDocument(fakeDoc());
    doc.text('Lancamentos', 0, 0);
    doc.text(doc.splitTextToSize('Resumo executivo', 100), 0, 0);
    doc.autoTable({ head: [['Data', 'Valor']], body: [['Receitas', 'R$ 1,00'], [{ content: 'Saldo projetado' }, 'x']] });
    expect(doc.calls.text).toEqual(['Movimientos', ['Resumen ejecutivo']]);
    expect(doc.calls.table[0].head).toEqual([['Fecha', 'Importe']]);
    expect(doc.calls.table[0].body).toEqual([['Ingresos', 'R$ 1,00'], [{ content: 'Saldo previsto' }, 'x']]);
  });

  it('traduz cabecalho com data e periodo', async () => {
    await setLocale('es-ES');
    const doc = translatePdfDocument(fakeDoc());
    doc.text('Gerado em 13/11/2026 | Periodo 2026-01 ate fim', 0, 0);
    expect(doc.calls.text[0]).toBe('Generado el 13/11/2026 | Periodo 2026-01 hasta fin');
  });
});
