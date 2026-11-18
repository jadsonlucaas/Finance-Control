/**
 * Cartao principal do Inicio: saldo ate hoje e a linha do saldo no mes, com a previsao
 * (tracejada) ate o ultimo dia contando as saidas em aberto pelo vencimento.
 *
 * Aparece so quando o filtro do Dashboard cobre um unico mes. O SVG leva apenas numeros
 * e textos fixos; valores em dinheiro entram por textContent.
 */
import { buildBalanceTrajectory } from '../../application/selectors/balanceTrajectory.js';

const CARD_ID = 'dashboard-trajectory';
const DEFAULT_WIDTH = 600;
const HEIGHT = 168;
const PAD_TOP = 22;
const PAD_BOTTOM = 26;

function localToday() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function translate(text) {
  const translator = globalThis.financeI18n?.translate;
  return typeof translator === 'function' ? translator(text) : text;
}

function money(value) {
  return typeof globalThis.fmt === 'function' ? globalThis.fmt(value) : String(value);
}

const PAD_X = 10;
// Faixa de baixo onde ficam as barras de gastos do dia (fracao da area do grafico).
const BAR_BAND = 0.42;

function plotHeight() {
  return globalThis.matchMedia?.('(min-width: 768px)')?.matches ? 190 : 150;
}

export function trajectoryPaths(trajectory, WIDTH = DEFAULT_WIDTH, height = HEIGHT) {
  const { points, lastDay, todayDay } = trajectory;
  const values = points.map((point) => point.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (day) => PAD_X + ((day - 1) / Math.max(lastDay - 1, 1)) * (WIDTH - PAD_X * 2);
  const y = (value) => PAD_TOP + (1 - (value - min) / span) * (height - PAD_TOP - PAD_BOTTOM);
  const coords = points.map((point) => [x(point.day), y(point.balance)]);
  const toPath = (list) => list.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const realized = todayDay ? coords.slice(0, todayDay) : [];
  const projected = coords.slice(Math.max(todayDay - 1, 0));
  const zeroY = y(0);
  const area = realized.length
    ? `${toPath(realized)} L${realized[realized.length - 1][0].toFixed(1)} ${zeroY.toFixed(1)} L${PAD_X} ${zeroY.toFixed(1)} Z`
    : '';
  return {
    realized: realized.length > 1 ? toPath(realized) : '',
    projected: projected.length > 1 && todayDay < lastDay ? toPath(projected) : '',
    area,
    zeroY,
    coords,
    x,
    today: todayDay ? { x: coords[todayDay - 1][0], y: coords[todayDay - 1][1] } : null
  };
}

/** Barras dos gastos do dia, na faixa de baixo, com escala propria. */
export function dailyBars(dailyValues = [], trajectory, WIDTH = DEFAULT_WIDTH, height = HEIGHT) {
  const { lastDay, todayDay } = trajectory;
  const base = height - PAD_BOTTOM;
  const band = (height - PAD_TOP - PAD_BOTTOM) * BAR_BAND;
  const max = Math.max(0, ...dailyValues.map((value) => Number(value) || 0));
  const step = (WIDTH - PAD_X * 2) / Math.max(lastDay - 1, 1);
  const barWidth = Math.max(2, Math.min(14, step * 0.6));
  const bars = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const value = Number(dailyValues[day - 1]) || 0;
    if (!(value > 0) || !max) continue;
    const h = Math.max(2, (value / max) * band);
    const cx = PAD_X + (day - 1) * step;
    bars.push({ day, value, x: cx - barWidth / 2, y: base - h, width: barWidth, height: h, future: day > todayDay });
  }
  return { bars, step };
}

function svgMarkup(trajectory, WIDTH = DEFAULT_WIDTH, height = HEIGHT, dailyValues = []) {
  const paths = trajectoryPaths(trajectory, WIDTH, height);
  const { bars, step } = dailyBars(dailyValues, trajectory, WIDTH, height);
  const today = paths.today;
  const labelX = today ? Math.min(today.x + 8, WIDTH - 40) : 0;
  const base = height - PAD_BOTTOM;
  const hits = trajectory.points.map((point) => {
    const cx = paths.x(point.day);
    return `<rect class="trajectory-hit" data-trajectory-day="${point.day}" x="${(cx - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${base}"></rect>`;
  }).join('');
  return `
    <svg class="trajectory-chart" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" aria-hidden="true" focusable="false">
      <line class="trajectory-zero" x1="${PAD_X}" x2="${WIDTH - PAD_X}" y1="${paths.zeroY.toFixed(1)}" y2="${paths.zeroY.toFixed(1)}"></line>
      ${bars.map((bar) => `<rect class="trajectory-bar${bar.future ? ' is-future' : ''}" data-bar-day="${bar.day}" x="${bar.x.toFixed(1)}" y="${bar.y.toFixed(1)}" width="${bar.width.toFixed(1)}" height="${bar.height.toFixed(1)}" rx="2"></rect>`).join('')}
      ${paths.area ? `<path class="trajectory-area" d="${paths.area}"></path>` : ''}
      ${paths.realized ? `<path class="trajectory-line" d="${paths.realized}"></path>` : ''}
      ${paths.projected ? `<path class="trajectory-forecast-line" d="${paths.projected}"></path>` : ''}
      ${today ? `<line class="trajectory-today" x1="${today.x.toFixed(1)}" x2="${today.x.toFixed(1)}" y1="6" y2="${base}"></line>
      <circle class="trajectory-dot" cx="${today.x.toFixed(1)}" cy="${today.y.toFixed(1)}" r="5"></circle>
      <text class="trajectory-text" data-trajectory-today-label x="${labelX.toFixed(1)}" y="14"></text>` : ''}
      <line class="trajectory-guide" data-trajectory-guide x1="0" x2="0" y1="6" y2="${base}"></line>
      <circle class="trajectory-hover-dot" data-trajectory-hover-dot cx="0" cy="0" r="4.5"></circle>
      <text class="trajectory-text" x="${PAD_X}" y="${height - 6}">1</text>
      <text class="trajectory-text" x="${WIDTH - PAD_X}" y="${height - 6}" text-anchor="end">${trajectory.lastDay}</text>
      <g class="trajectory-hits">${hits}</g>
    </svg>`;
}

/** Separa "R$ 1.234,56" em { main: "R$ 1.234", cents: ",56", suffix: "" } para os centavos menores. */
export function splitMoney(text) {
  const value = String(text ?? '');
  const match = value.match(/^(.*?\d)([.,]\d{2})(\D*)$/);
  if (!match) return { main: value, cents: '', suffix: '' };
  return { main: match[1], cents: match[2], suffix: match[3] };
}

function paintMoney(element, amount) {
  const parts = splitMoney(money(amount));
  element.replaceChildren();
  element.append(parts.main);
  if (parts.cents) {
    const cents = element.ownerDocument.createElement('span');
    cents.className = 'money-cents';
    cents.textContent = parts.cents;
    element.append(cents);
  }
  if (parts.suffix) element.append(parts.suffix);
  element.setAttribute('aria-label', money(amount));
}

function ensureCard(documentRef) {
  let card = documentRef.getElementById(CARD_ID);
  if (card) return card;
  // Primeiro bloco do Inicio: o saldo vem antes dos filtros.
  const view = documentRef.getElementById('view-dashboard');
  const summary = documentRef.getElementById('summary-cards');
  const anchor = view?.firstElementChild || summary;
  if (!anchor?.parentElement) return null;
  card = documentRef.createElement('section');
  card.id = CARD_ID;
  card.className = 'trajectory-card hero-card';
  card.innerHTML = `
    <div class="hero-main">
      <div class="hero-top">
        <p class="hero-label" data-trajectory-label></p>
        <span class="hero-chip" data-trajectory-chip><span class="hero-chip-dot" aria-hidden="true"></span><span data-trajectory-chip-text></span></span>
      </div>
      <p class="trajectory-value hero-value" data-trajectory-value></p>
      <p class="hero-sub"><span>Previsão para o fim do mês:</span> <strong data-trajectory-forecast></strong></p>
      <div class="hero-panel">
        <div class="hero-panel-text">
          <p class="hero-panel-label">A pagar no mês</p>
          <p class="hero-panel-value" data-trajectory-open></p>
          <p class="hero-panel-meta" data-trajectory-open-meta></p>
        </div>
        <button type="button" class="hero-cta" data-trajectory-cta>Ver contas</button>
      </div>
    </div>
    <div class="hero-plot-wrap">
      <div class="trajectory-plot hero-plot" data-trajectory-plot tabindex="0" role="group" aria-label="Saldo e gastos por dia. Use as setas para trocar o dia e Enter para ver os gastos."></div>
      <div class="trajectory-tip hidden" data-trajectory-tip role="status" aria-live="polite">
        <p class="trajectory-tip-day" data-tip-day></p>
        <p class="trajectory-tip-row"><span class="trajectory-key is-line" aria-hidden="true"></span><span data-tip-balance-label>Saldo</span><strong data-tip-balance></strong></p>
        <p class="trajectory-tip-row"><span class="trajectory-key is-bar" aria-hidden="true"></span><span>Gastos do dia</span><strong data-tip-spent></strong></p>
        <p class="trajectory-tip-hint" data-tip-hint></p>
      </div>
      <p class="trajectory-legend" aria-hidden="true"><span><span class="trajectory-key is-line"></span>Saldo</span><span><span class="trajectory-key is-bar"></span>Gastos do dia</span></p>
    </div>`;
  anchor.parentElement.insertBefore(card, anchor);
  card.querySelector('[data-trajectory-cta]').addEventListener('click', () => {
    if (typeof globalThis.switchTab === 'function') globalThis.switchTab('saidas');
  });
  return card;
}

export function renderBalanceTrajectoryCard({ entradas = [], saidas = [], daily = null, documentRef = globalThis.document, today = localToday() } = {}) {
  if (!documentRef) return null;
  renderQuickAccess(documentRef);
  const start = documentRef.getElementById('f-comp-start')?.value || '';
  const end = documentRef.getElementById('f-comp-end')?.value || '';
  const month = start && (!end || end === start) ? start : '';
  const trajectory = month ? buildBalanceTrajectory({ month, today, entradas, saidas }) : null;
  const existing = documentRef.getElementById(CARD_ID);
  if (!trajectory) {
    existing?.classList.add('hidden');
    return null;
  }
  const card = ensureCard(documentRef);
  if (!card) return null;
  card.classList.remove('hidden');
  const isCurrentMonth = trajectory.todayDay > 0 && trajectory.todayDay < trajectory.lastDay;
  const headline = isCurrentMonth ? trajectory.current : trajectory.projectedEnd;
  card.querySelector('[data-trajectory-label]').textContent = isCurrentMonth ? 'Saldo até hoje' : 'Saldo do mês';
  paintMoney(card.querySelector('[data-trajectory-value]'), headline);
  const healthy = trajectory.projectedEnd >= 0;
  card.querySelector('[data-trajectory-chip]').classList.toggle('is-warning', !healthy);
  card.querySelector('[data-trajectory-chip-text]').textContent = healthy ? 'Mês no azul' : 'Atenção ao saldo';
  const forecastRow = card.querySelector('[data-trajectory-forecast]').parentElement;
  forecastRow.classList.toggle('hidden', !isCurrentMonth && trajectory.todayDay !== 0);
  card.querySelector('[data-trajectory-forecast]').textContent = money(trajectory.projectedEnd);
  paintMoney(card.querySelector('[data-trajectory-open]'), trajectory.openTotal);
  const meta = card.querySelector('[data-trajectory-open-meta]');
  meta.replaceChildren();
  if (trajectory.openCount) {
    const count = documentRef.createElement('span');
    count.textContent = String(trajectory.openCount);
    const label = documentRef.createElement('span');
    label.textContent = trajectory.openCount === 1 ? 'conta em aberto' : 'contas em aberto';
    meta.append(count, ' ', label);
  } else {
    const label = documentRef.createElement('span');
    label.textContent = 'Nada em aberto neste mês';
    meta.append(label);
  }
  card.querySelector('[data-trajectory-cta]').classList.toggle('hidden', !trajectory.openCount);
  const plot = card.querySelector('[data-trajectory-plot]');
  plot.__trajectory = trajectory;
  plot.__daily = daily && daily.month === trajectory.month ? daily : null;
  bindPlotInteractions(plot);
  drawPlot(plot);
  // Redesenha na largura real (o SVG nao estica o texto) quando a tela muda de tamanho.
  if (!plot.__trajectoryObserved && typeof globalThis.ResizeObserver === 'function') {
    plot.__trajectoryObserved = true;
    let lastWidth = plot.clientWidth;
    new globalThis.ResizeObserver(() => {
      if (Math.abs(plot.clientWidth - lastWidth) < 4) return;
      lastWidth = plot.clientWidth;
      drawPlot(plot);
    }).observe(plot);
  }
  return trajectory;
}

const QUICK_ID = 'dashboard-quick-access';
const QUICK_ITEMS = [
  { key: 'saida', label: 'Novo gasto', icon: 'arrow-up-right', tone: 'danger' },
  { key: 'entrada', label: 'Nova entrada', icon: 'arrow-down-left', tone: 'success' },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: 'credit-card', tone: 'accent' },
  { key: 'orcamentos', label: 'Orçamentos', icon: 'pie-chart', tone: 'accent' }
];

/** Atalhos 2x2 do Inicio. Usam as mesmas funcoes do app (bloqueios do plano continuam valendo). */
export function renderQuickAccess(documentRef = globalThis.document) {
  if (!documentRef || documentRef.getElementById(QUICK_ID)) return;
  const view = documentRef.getElementById('view-dashboard');
  if (!view) return;
  const section = documentRef.createElement('section');
  section.id = QUICK_ID;
  section.className = 'quick-access';
  section.setAttribute('aria-labelledby', `${QUICK_ID}-title`);
  section.innerHTML = `
    <h3 class="quick-access-title" id="${QUICK_ID}-title">Acesso rápido</h3>
    <div class="quick-access-grid">
      ${QUICK_ITEMS.map((item) => `
        <button type="button" class="quick-tile" data-quick="${item.key}">
          <span class="quick-tile-icon is-${item.tone}" aria-hidden="true"><i data-lucide="${item.icon}" class="w-5 h-5"></i></span>
          <span class="quick-tile-label">${item.label}</span>
        </button>`).join('')}
    </div>`;
  const hero = documentRef.getElementById(CARD_ID);
  if (hero) hero.after(section);
  else view.insertBefore(section, view.firstElementChild);
  section.addEventListener('click', (event) => {
    const tile = event.target.closest('[data-quick]');
    if (!tile) return;
    const key = tile.dataset.quick;
    if (key === 'saida' || key === 'entrada') {
      if (typeof globalThis.openNewRecordFlow === 'function') globalThis.openNewRecordFlow(key);
      return;
    }
    if (typeof globalThis.switchTab === 'function') globalThis.switchTab(key);
  });
  globalThis.lucide?.createIcons?.();
  globalThis.financeApp?.icons?.refresh?.();
}

function drawPlot(plot) {
  const trajectory = plot.__trajectory;
  if (!trajectory) return;
  const width = Math.max(Math.round(plot.clientWidth || DEFAULT_WIDTH), 200);
  plot.innerHTML = svgMarkup(trajectory, width, plotHeight(), plot.__daily?.values || []);
  const todayLabel = plot.querySelector('[data-trajectory-today-label]');
  if (todayLabel && trajectory.todayDay) todayLabel.textContent = translate('hoje');
  if (plot.__activeDay) setActiveDay(plot, plot.__activeDay, { keepTip: true });
}

function dayLabel(month, day) {
  return `${String(day).padStart(2, '0')}/${month.slice(5)}`;
}

function dayRecords(plot, day) {
  const daily = plot.__daily;
  if (!daily) return [];
  const key = daily.detailKeys?.[day - 1];
  return (key && daily.recordsByDate?.[key]) || [];
}

/** Marca o dia no grafico e mostra saldo e gastos dele. */
export function setActiveDay(plot, day, { keepTip = false } = {}) {
  const trajectory = plot.__trajectory;
  if (!trajectory) return;
  const wrap = plot.parentElement;
  const tip = wrap?.querySelector('[data-trajectory-tip]');
  const guide = plot.querySelector('[data-trajectory-guide]');
  const dot = plot.querySelector('[data-trajectory-hover-dot]');
  if (!day) {
    plot.__activeDay = 0;
    guide?.classList.remove('is-visible');
    dot?.classList.remove('is-visible');
    plot.querySelectorAll('.trajectory-bar.is-active').forEach((bar) => bar.classList.remove('is-active'));
    tip?.classList.add('hidden');
    return;
  }
  const point = trajectory.points[day - 1];
  if (!point) return;
  plot.__activeDay = day;
  const width = Math.max(Math.round(plot.clientWidth || DEFAULT_WIDTH), 200);
  const paths = trajectoryPaths(trajectory, width, plotHeight());
  const [cx, cy] = paths.coords[day - 1];
  guide?.setAttribute('x1', cx.toFixed(1));
  guide?.setAttribute('x2', cx.toFixed(1));
  guide?.classList.add('is-visible');
  dot?.setAttribute('cx', cx.toFixed(1));
  dot?.setAttribute('cy', cy.toFixed(1));
  dot?.classList.add('is-visible');
  plot.querySelectorAll('.trajectory-bar').forEach((bar) => bar.classList.toggle('is-active', Number(bar.dataset.barDay) === day));
  if (!tip) return;
  const spent = Number(plot.__daily?.values?.[day - 1]) || 0;
  tip.querySelector('[data-tip-day]').textContent = point.projected
    ? `${dayLabel(trajectory.month, day)} · ${translate('previsão')}`
    : dayLabel(trajectory.month, day);
  tip.querySelector('[data-tip-balance-label]').textContent = point.projected ? translate('Saldo previsto') : translate('Saldo');
  tip.querySelector('[data-tip-balance]').textContent = money(point.balance);
  tip.querySelector('[data-tip-balance]').classList.toggle('is-negative', point.balance < 0);
  tip.querySelector('[data-tip-spent]').textContent = spent > 0 ? money(spent) : translate('Sem gastos');
  const canHover = Boolean(globalThis.matchMedia?.('(hover: hover)')?.matches);
  tip.querySelector('[data-tip-hint]').textContent = dayRecords(plot, day).length
    ? translate(canHover ? 'Clique para ver os gastos' : 'Toque de novo para ver os gastos')
    : '';
  tip.classList.remove('hidden');
  // Caixa fica ao lado do dia (direita ou esquerda), sem cobrir o ponto nem sair do cartao.
  const tipWidth = tip.offsetWidth || 180;
  const right = cx + 14;
  const left = right + tipWidth <= width ? right : Math.max(cx - 14 - tipWidth, 0);
  tip.style.left = `${left.toFixed(0)}px`;
  if (!keepTip) tip.dataset.day = String(day);
}

function openDayDetail(plot, day) {
  const records = dayRecords(plot, day);
  if (!records.length) return false;
  const title = `${translate('Gastos do dia')}: ${dayLabel(plot.__trajectory.month, day)}`;
  const subtitle = `${records.length} despesa(s) no dia selecionado`;
  const sorted = typeof globalThis.sortRecordsNewestFirst === 'function' ? globalThis.sortRecordsNewestFirst(records) : records;
  globalThis.openDashboardExpenseRecordsModal?.(title, subtitle, sorted);
  return true;
}

function bindPlotInteractions(plot) {
  if (plot.__trajectoryBound) return;
  plot.__trajectoryBound = true;
  const dayFromEvent = (event) => Number(event.target?.closest?.('[data-trajectory-day]')?.dataset.trajectoryDay) || 0;
  plot.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const day = dayFromEvent(event);
    if (day && day !== plot.__activeDay) setActiveDay(plot, day);
  });
  plot.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') setActiveDay(plot, 0);
  });
  plot.addEventListener('click', (event) => {
    const day = dayFromEvent(event);
    if (!day) return;
    // Mouse: o clique abre os gastos do dia. Toque: o 1o toque mostra os valores, o 2o abre.
    const mouse = event.pointerType === 'mouse' || (!event.pointerType && event.detail > 0 && plot.__activeDay === day);
    if ((mouse || plot.__activeDay === day) && openDayDetail(plot, day)) return;
    setActiveDay(plot, day);
  });
  plot.addEventListener('keydown', (event) => {
    const trajectory = plot.__trajectory;
    if (!trajectory) return;
    const current = plot.__activeDay || trajectory.todayDay || 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = Math.min(Math.max(current + (event.key === 'ArrowRight' ? 1 : -1), 1), trajectory.lastDay);
      setActiveDay(plot, plot.__activeDay ? next : current);
    } else if (event.key === 'Enter' && plot.__activeDay) {
      event.preventDefault();
      openDayDetail(plot, plot.__activeDay);
    } else if (event.key === 'Escape') {
      setActiveDay(plot, 0);
    }
  });
  plot.addEventListener('blur', () => setActiveDay(plot, 0));
}
