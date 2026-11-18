/**
 * Distribuicao dos gastos no Inicio: por categoria (barra segmentada), por pessoa e por
 * subcategoria (barras em ranking). HTML puro no lugar dos graficos em canvas: cada linha
 * mostra valor e % do total, abre os lancamentos ao clicar e funciona por teclado.
 *
 * Valores entram por textContent; o HTML fixo nao leva dados do usuario.
 */
import { dashboardAggregationItems } from '../../domain/dashboard.js';

const SUBCATEGORY_PREVIEW = 8;

function money(value) {
  return typeof globalThis.fmt === 'function' ? globalThis.fmt(value) : `R$ ${Number(value || 0).toFixed(2)}`;
}

function translate(text) {
  const translator = globalThis.financeI18n?.translate;
  return typeof translator === 'function' ? translator(text) : text;
}

export function percentLabel(value, total) {
  if (!total) return '0%';
  const pct = (value / total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return `${String(rounded).replace('.', ',')}%`;
}

/** "VARIAVEL" -> "Variável", "FIXO" -> "Fixo"; nomes ja escritos pela pessoa ficam como estao. */
export function displayLabel(label = '') {
  const text = String(label || '').trim();
  const known = { VARIAVEL: 'Variável', FIXO: 'Fixo', FIXA: 'Fixo', INVESTIMENTO: 'Investimento', INVESTIMENTOS: 'Investimentos' };
  if (known[text.toUpperCase()]) return known[text.toUpperCase()];
  if (text && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return text.charAt(0) + text.slice(1).toLowerCase();
  }
  return text || 'Sem categoria';
}

/** Monta os itens de cada quadro com a fatia de cada um no total. */
export function buildBreakdowns(aggregations = {}) {
  const total = Number(aggregations.total) || 0;
  // Nomes que viram o mesmo rotulo (ex.: FIXO e FIXA) somam numa linha so.
  const withShare = (items) => {
    const merged = new Map();
    items.forEach((item) => {
      const name = displayLabel(item.label);
      const current = merged.get(name);
      if (current) {
        current.value = Math.round((current.value + item.value) * 100) / 100;
        current.records = [...current.records, ...item.records];
      } else {
        merged.set(name, { ...item, name, records: [...(item.records || [])] });
      }
    });
    return [...merged.values()]
      .sort((a, b) => b.value - a.value)
      .map((item) => ({ ...item, share: total ? item.value / total : 0 }));
  };
  return {
    total,
    categories: withShare(dashboardAggregationItems(aggregations.porCategoria || {}, aggregations.registrosPorCategoria || {})),
    subcategories: withShare(dashboardAggregationItems(aggregations.porSubcategoria || {}, aggregations.registrosPorSubcategoria || {})),
    people: withShare(dashboardAggregationItems(aggregations.porPessoa || {}, aggregations.registrosPorPessoa || {}))
  };
}

function el(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function emptyState(documentRef) {
  return el(documentRef, 'p', 'breakdown-empty', translate('Nenhum gasto no período filtrado.'));
}

function openDetail(prefix, item) {
  globalThis.openDashboardSaidasDetail?.(`${prefix}: ${item.name}`, item.records);
}

/** Linha clicavel: nome, valor, % e a barra de proporcao. */
function rankRow(documentRef, item, maxValue, { prefix, slot = 1 } = {}) {
  const row = el(documentRef, 'button', 'breakdown-row');
  row.type = 'button';
  row.style.setProperty('--series', `var(--series-${slot})`);
  const head = el(documentRef, 'span', 'breakdown-row-head');
  head.append(el(documentRef, 'span', 'breakdown-row-name', item.name));
  const figures = el(documentRef, 'span', 'breakdown-row-figures');
  figures.append(el(documentRef, 'span', 'breakdown-row-value', money(item.value)));
  figures.append(el(documentRef, 'span', 'breakdown-row-share', percentLabel(item.value, maxValue.total)));
  head.append(figures);
  const track = el(documentRef, 'span', 'breakdown-track');
  const fill = el(documentRef, 'span', 'breakdown-fill');
  fill.style.width = `${Math.max((item.value / (maxValue.max || 1)) * 100, 1.5).toFixed(2)}%`;
  track.append(fill);
  row.append(head, track);
  row.setAttribute('aria-label', `${item.name}: ${money(item.value)}, ${percentLabel(item.value, maxValue.total)} ${translate('do total')}. ${translate('Ver lançamentos')}`);
  row.addEventListener('click', () => openDetail(prefix, item));
  return row;
}

function renderCategories(container, data) {
  const documentRef = container.ownerDocument;
  container.replaceChildren();
  const items = data.categories;
  if (!items.length) {
    container.append(emptyState(documentRef));
    return;
  }
  // Barra unica dividida pelas categorias (parte de um todo), com legenda clicavel embaixo.
  const bar = el(documentRef, 'div', 'breakdown-stack');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', items.map((item) => `${item.name} ${percentLabel(item.value, data.total)}`).join(', '));
  items.forEach((item, index) => {
    const segment = el(documentRef, 'span', 'breakdown-stack-segment');
    segment.style.flexGrow = String(item.value);
    segment.style.setProperty('--series', `var(--series-${Math.min(index + 1, 6)})`);
    bar.append(segment);
  });
  const lead = items[0];
  const insight = el(documentRef, 'p', 'breakdown-insight');
  insight.append(el(documentRef, 'strong', '', percentLabel(lead.value, data.total)));
  const plural = { Fixo: 'fixos', 'Variável': 'variáveis' }[lead.name];
  if (plural) {
    insight.append(` ${translate('dos gastos são')} ${translate(plural)}`);
  } else {
    insight.append(` ${translate('dos gastos estão em')} `);
    insight.append(el(documentRef, 'strong', '', lead.name));
  }
  const legend = el(documentRef, 'div', 'breakdown-legend');
  items.forEach((item, index) => {
    const row = el(documentRef, 'button', 'breakdown-legend-row');
    row.type = 'button';
    row.style.setProperty('--series', `var(--series-${Math.min(index + 1, 6)})`);
    row.append(el(documentRef, 'span', 'breakdown-swatch'));
    row.append(el(documentRef, 'span', 'breakdown-row-name', item.name));
    row.append(el(documentRef, 'span', 'breakdown-row-value', money(item.value)));
    row.append(el(documentRef, 'span', 'breakdown-row-share', percentLabel(item.value, data.total)));
    row.setAttribute('aria-label', `${item.name}: ${money(item.value)}, ${percentLabel(item.value, data.total)}. ${translate('Ver lançamentos')}`);
    row.addEventListener('click', () => openDetail('Categoria', item));
    legend.append(row);
  });
  container.append(insight, bar, legend);
}

function renderRanking(container, items, data, { prefix, insightFor, preview = 0 }) {
  const documentRef = container.ownerDocument;
  container.replaceChildren();
  if (!items.length) {
    container.append(emptyState(documentRef));
    return;
  }
  const scale = { max: items[0].value, total: data.total };
  const insight = insightFor?.(items, data);
  if (insight) container.append(insight);
  const list = el(documentRef, 'div', 'breakdown-list');
  const expanded = container.dataset.expanded === 'true';
  const visible = preview && !expanded ? items.slice(0, preview) : items;
  visible.forEach((item) => list.append(rankRow(documentRef, item, scale, { prefix })));
  container.append(list);
  if (preview && items.length > preview) {
    const toggle = el(documentRef, 'button', 'breakdown-more', expanded
      ? translate('Mostrar menos')
      : `${translate('Ver todas')} (${items.length})`);
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.addEventListener('click', () => {
      container.dataset.expanded = expanded ? 'false' : 'true';
      renderRanking(container, items, data, { prefix, insightFor, preview });
    });
    container.append(toggle);
  }
}

function insightLine(documentRef, strongText, rest) {
  const p = el(documentRef, 'p', 'breakdown-insight');
  p.append(el(documentRef, 'strong', '', strongText));
  p.append(` ${rest}`);
  return p;
}

export function renderDashboardBreakdowns(aggregations, documentRef = globalThis.document) {
  if (!documentRef) return null;
  const data = buildBreakdowns(aggregations);
  const category = documentRef.getElementById('dash-category-breakdown');
  const people = documentRef.getElementById('dash-person-breakdown');
  const subcategories = documentRef.getElementById('dash-subcategory-breakdown');
  const totalEl = documentRef.getElementById('dash-breakdown-total');
  if (totalEl) totalEl.textContent = money(data.total);

  if (category) renderCategories(category, data);
  if (people) {
    renderRanking(people, data.people, data, {
      prefix: 'Pessoa',
      insightFor: (items) => (items.length > 1
        ? insightLine(documentRef, items[0].name, `${translate('concentra')} ${percentLabel(items[0].value, data.total)} ${translate('dos gastos')}`)
        : null)
    });
  }
  if (subcategories) {
    renderRanking(subcategories, data.subcategories, data, {
      prefix: 'Subcategoria',
      preview: SUBCATEGORY_PREVIEW,
      insightFor: (items) => {
        if (items.length < 4) return null;
        const top = items.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
        return insightLine(documentRef, percentLabel(top, data.total), translate('dos gastos estão nas 3 maiores subcategorias'));
      }
    });
  }
  return data;
}
