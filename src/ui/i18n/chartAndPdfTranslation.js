/**
 * Traducao do que nao passa pelo DOM: textos desenhados nos graficos (Chart.js, canvas)
 * e no PDF (jsPDF). Usa o mesmo dicionario das telas; em pt-BR nada muda.
 */
import { DEFAULT_LOCALE, getLocale, translateText } from '../../core/i18n.js';

const active = () => getLocale() !== DEFAULT_LOCALE;

function translateValue(value) {
  if (typeof value === 'string') return translateText(value);
  if (Array.isArray(value)) return value.map(translateValue);
  return value;
}

/** Plugin do Chart.js: traduz rotulos do eixo/legenda e nomes das series antes de desenhar. */
export const chartTranslationPlugin = Object.freeze({
  id: 'financeI18n',
  beforeUpdate(chart) {
    if (!active() || !chart?.data) return;
    if (Array.isArray(chart.data.labels)) chart.data.labels = chart.data.labels.map(translateValue);
    (chart.data.datasets || []).forEach((dataset) => {
      if (typeof dataset?.label === 'string') dataset.label = translateText(dataset.label);
    });
  }
});

export function registerChartTranslation(Chart) {
  if (!Chart?.register || Chart.__financeI18nRegistered) return false;
  Chart.register(chartTranslationPlugin);
  Chart.__financeI18nRegistered = true;
  return true;
}

function translateCell(cell) {
  if (typeof cell === 'string') return translateText(cell);
  if (cell && typeof cell === 'object' && typeof cell.content === 'string') return { ...cell, content: translateText(cell.content) };
  return cell;
}

function translateRows(rows) {
  return Array.isArray(rows) ? rows.map((row) => (Array.isArray(row) ? row.map(translateCell) : row)) : rows;
}

/** Opcoes do autoTable com cabecalho e corpo traduzidos. */
export function translateAutoTableOptions(options = {}) {
  if (!active() || !options || typeof options !== 'object') return options;
  return { ...options, head: translateRows(options.head), body: translateRows(options.body), foot: translateRows(options.foot) };
}

/**
 * Faz um documento jsPDF traduzir o que escreve: doc.text, doc.splitTextToSize e doc.autoTable.
 * Deve ser chamado logo depois de `new jsPDF()`, antes de guardar referencia ao autoTable.
 */
export function translatePdfDocument(doc) {
  if (!doc || doc.__financeI18n) return doc;
  const { text, splitTextToSize, autoTable } = doc;
  if (typeof text === 'function') {
    doc.text = function translatedText(value, ...rest) {
      return text.call(this, active() ? translateValue(value) : value, ...rest);
    };
  }
  if (typeof splitTextToSize === 'function') {
    doc.splitTextToSize = function translatedSplit(value, ...rest) {
      return splitTextToSize.call(this, active() ? translateValue(value) : value, ...rest);
    };
  }
  if (typeof autoTable === 'function') {
    doc.autoTable = function translatedAutoTable(options, ...rest) {
      return autoTable.call(this, translateAutoTableOptions(options), ...rest);
    };
  }
  doc.__financeI18n = true;
  return doc;
}
