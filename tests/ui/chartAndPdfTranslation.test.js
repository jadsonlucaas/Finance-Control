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

describe('PDF: leitura gerencial com valores no meio', () => {
  it('traduz frases montadas e itens com marcador', async () => {
    const { translateText } = await import('../../src/core/i18n.js');
    await setLocale('es-ES');
    expect(translateText('• Situação geral: superávit de 4.048,48 € no recorte analisado.'))
      .toBe('• Situación general: superávit de 4.048,48 € en el periodo analizado.');
    expect(translateText('• Comportamento relevante: maior concentração em sem concentração relevante.'))
      .toBe('• Comportamiento relevante: mayor concentración en sin concentración relevante.');
    expect(translateText('• Cobertura financeira de 10,00x para obrigações pagas e em aberto.'))
      .toBe('• Cobertura financiera de 10,00x para obligaciones pagadas y pendientes.');
    expect(translateText('• Categoria dominante: nenhuma categoria dominante, com 0,00 €.'))
      .toBe('• Categoría dominante: ninguna categoría dominante, con 0,00 €.');
    expect(translateText('• Natureza do resultado: pontual no recorte analisado.'))
      .toBe('• Naturaleza del resultado: puntual en el periodo analizado.');
    // Frase fixa do dicionario, agora tambem com marcador.
    expect(translateText('• O consumo discricionário está controlado dentro do recorte atual.')).not.toContain('consumo discricionário está');
    await setLocale('pt-BR');
    expect(translateText('• Situação geral: superávit de R$ 10,00 no recorte analisado.')).toBe('• Situação geral: superávit de R$ 10,00 no recorte analisado.');
  });
});
