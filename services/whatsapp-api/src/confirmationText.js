import { formatMoney } from './money.js';

/**
 * Frase curta de confirmacao do cadastro automatico, ja no idioma do usuario.
 * O agente do WhatsApp repassa este texto como esta, sem montar lista nem copiar status.
 */
export const ES_CATEGORIES = Object.freeze({
  'Alimentação': 'Alimentación',
  'Reserva de emergência': 'Fondo de emergencia',
  'Investimentos': 'Inversiones',
  'Transporte': 'Transporte',
  'Habitação': 'Vivienda',
  'Assinaturas': 'Suscripciones',
  'Lazer': 'Ocio',
  'Vestuário': 'Ropa',
  'Cuidados pessoais': 'Cuidado personal',
  'Educação': 'Educación',
  'Saúde': 'Salud',
  'Outros': 'Otros'
});

function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

// "bank:mercado_pago" -> "Mercado pago"; textos livres ficam como estao.
function paymentLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const name = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1).replace(/_/g, ' ') : raw;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** @param {object} publicRecord saida de toPublicRecord; @param {string} locale 'es-ES' ou 'pt-BR' */
export function registrationConfirmation(publicRecord, locale = 'pt-BR') {
  const es = String(locale || '').toLowerCase().startsWith('es');
  const category = publicRecord.categoria ? (es ? ES_CATEGORIES[publicRecord.categoria] || publicRecord.categoria : publicRecord.categoria) : '';
  const what = publicRecord.descricao || category;
  const showCategory = category && category.toLowerCase() !== String(what).toLowerCase();
  const income = publicRecord.tipo === 'receita';
  const parts = [];
  if (es) {
    parts.push(`Apuntado: ${income ? 'ingreso de ' : ''}${publicRecord.valor_formatado} en ${what}${showCategory ? ` (${category})` : ''}.`);
    const payment = paymentLabel(publicRecord.forma_pagamento);
    if (payment) parts.push(`Pago: ${payment}.`);
    const due = formatDate(publicRecord.vencimento);
    if (due) parts.push(`Vence el ${due}.`);
  } else {
    parts.push(`Anotado: ${income ? 'receita de ' : ''}${publicRecord.valor_formatado} em ${what}${showCategory ? ` (${category})` : ''}.`);
    const payment = paymentLabel(publicRecord.forma_pagamento);
    if (payment) parts.push(`Pagamento: ${payment}.`);
    const due = formatDate(publicRecord.vencimento);
    if (due) parts.push(`Vence em ${due}.`);
  }
  return parts.join(' ');
}

/**
 * Confirmacao de compra parcelada: quantidade, valor de cada parcela, total e periodo.
 * @param {object} firstRecord toPublicRecord da 1a parcela; @param {object} serie resultado.parcelamento
 */
export function installmentConfirmation(firstRecord, serie, locale = 'pt-BR') {
  const es = String(locale || '').toLowerCase().startsWith('es');
  const what = String(firstRecord.descricao || '').replace(/\s*\(\d+\/\d+\)\s*$/, '');
  const category = firstRecord.categoria ? (es ? ES_CATEGORIES[firstRecord.categoria] || firstRecord.categoria : firstRecord.categoria) : '';
  const showCategory = category && category.toLowerCase() !== what.toLowerCase();
  const part = formatMoney(serie.valor_parcela);
  const total = formatMoney(serie.valor_total);
  const lastDiffers = Math.round(serie.ultima_parcela * 100) !== Math.round(serie.valor_parcela * 100);
  const first = formatDate(serie.primeiro_vencimento);
  const last = formatDate(serie.ultimo_vencimento);
  if (es) {
    return [
      `Apuntado: ${what}${showCategory ? ` (${category})` : ''} en ${serie.parcelas} cuotas de ${part}${lastDiffers ? ` (la última de ${formatMoney(serie.ultima_parcela)})` : ''}, total ${total}.`,
      `Primera cuota el ${first}, última el ${last}.`
    ].join(' ');
  }
  return [
    `Anotado: ${what}${showCategory ? ` (${category})` : ''} em ${serie.parcelas}x de ${part}${lastDiffers ? ` (a última de ${formatMoney(serie.ultima_parcela)})` : ''}, total ${total}.`,
    `1ª parcela vence em ${first} e a última em ${last}.`
  ].join(' ');
}
