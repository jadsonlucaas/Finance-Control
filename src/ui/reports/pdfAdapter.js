import { formatCurrency as formatDisplayCurrency } from '../../core/formatters.js';
import { translatePdfDocument } from '../i18n/chartAndPdfTranslation.js';
import { DEFAULT_LOCALE, formatCompetenceLabel, getLocale } from '../../core/i18n.js';
function formatCurrency(value = 0) {
  return formatDisplayCurrency(value);
}

function formatDate(value = '') {
  if (!value) return '-';
  const [date] = String(value).split('T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.split('-').reverse().join('/');
  return String(value);
}

// "2026-11" -> "nov/2026" (ou "nov/2026" em espanhol); outros valores ficam como vieram.
function formatPeriod(value, fallback) {
  if (!value) return fallback;
  return /^\d{4}-\d{2}$/.test(String(value)) ? formatCompetenceLabel(value) : String(value);
}

// Nome do arquivo no idioma da conta: em espanhol, "informe-financiero-...".
export function localizedPdfFilename(filename, locale = getLocale()) {
  const name = filename || 'relatorio-financial.pdf';
  if (locale === DEFAULT_LOCALE) return name;
  return name.replace(/^relatorio-financial/, 'informe-financiero');
}

function getAutoTable(doc, jspdf) {
  return doc.autoTable || jspdf.autoTable || jspdf.jsPDF?.API?.autoTable;
}

export async function createPdfReport(reportModel, {
  target = globalThis,
  ensurePdfLibraries = target.ensurePdfLibraries,
  filename = reportModel?.metadata?.filename
} = {}) {
  if (!reportModel?.tables) throw new Error('REPORT_MODEL_REQUIRED');
  if (typeof ensurePdfLibraries === 'function') await ensurePdfLibraries();
  if (!target.jspdf?.jsPDF) throw new Error('PDF_LIBRARY_NOT_READY');

  const { jsPDF } = target.jspdf;
  const doc = translatePdfDocument(new jsPDF('l', 'pt', 'a4'));
  const autoTable = getAutoTable(doc, target.jspdf);
  if (!autoTable) throw new Error('PDF_AUTOTABLE_NOT_READY');

  doc.setFontSize(18);
  doc.text(reportModel.title || 'Relatorio Financeiro Gerencial', 32, 40);
  doc.setFontSize(9);
  doc.text(`Gerado em ${formatDate(reportModel.generatedAt)} | Periodo ${formatPeriod(reportModel.period?.start, 'inicio')} ate ${formatPeriod(reportModel.period?.end, 'fim')}`, 32, 58);

  autoTable.call(doc, {
    startY: 82,
    head: [['Indicador', 'Valor']],
    body: reportModel.tables.summaryRows.map(([label, value]) => [
      label,
      label === 'Comprometimento' ? `${Number(value || 0).toFixed(1).replace('.', ',')}%` : formatCurrency(value)
    ]),
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] }
  });

  const rows = reportModel.tables.detailedRows.map((row) => [
    formatDate(row.data),
    row.tipo,
    row.pessoa,
    row.categoria,
    row.descricao,
    formatCurrency(row.valor),
    row.status,
    row.competencia
  ]);

  doc.addPage();
  doc.setFontSize(16);
  doc.text('Lancamentos', 32, 40);
  autoTable.call(doc, {
    startY: 62,
    head: [['Data', 'Tipo', 'Pessoa', 'Categoria', 'Descricao', 'Valor', 'Status', 'Competencia']],
    body: rows,
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 46 },
      2: { cellWidth: 80 },
      3: { cellWidth: 100 },
      4: { cellWidth: 270 },
      5: { cellWidth: 74, halign: 'right' },
      6: { cellWidth: 72 },
      7: { cellWidth: 72 }
    }
  });

  const finalName = localizedPdfFilename(filename);
  doc.save(finalName);
  return { success: true, filename: finalName, pages: doc.getNumberOfPages?.() || 0 };
}
