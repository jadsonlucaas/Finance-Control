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

export function trajectoryPaths(trajectory, WIDTH = DEFAULT_WIDTH) {
  const { points, lastDay, todayDay } = trajectory;
  const values = points.map((point) => point.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (day) => ((day - 1) / Math.max(lastDay - 1, 1)) * WIDTH;
  const y = (value) => PAD_TOP + (1 - (value - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const coords = points.map((point) => [x(point.day), y(point.balance)]);
  const toPath = (list) => list.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const realized = todayDay ? coords.slice(0, todayDay) : [];
  const projected = coords.slice(Math.max(todayDay - 1, 0));
  const zeroY = y(0);
  const area = realized.length
    ? `${toPath(realized)} L${realized[realized.length - 1][0].toFixed(1)} ${zeroY.toFixed(1)} L0 ${zeroY.toFixed(1)} Z`
    : '';
  return {
    realized: realized.length > 1 ? toPath(realized) : '',
    projected: projected.length > 1 && todayDay < lastDay ? toPath(projected) : '',
    area,
    zeroY,
    today: todayDay ? { x: coords[todayDay - 1][0], y: coords[todayDay - 1][1] } : null
  };
}

function svgMarkup(trajectory, WIDTH = DEFAULT_WIDTH) {
  const paths = trajectoryPaths(trajectory, WIDTH);
  const today = paths.today;
  const labelX = today ? Math.min(today.x + 8, WIDTH - 40) : 0;
  return `
    <svg class="trajectory-chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-hidden="true" focusable="false">
      <line class="trajectory-zero" x1="0" x2="${WIDTH}" y1="${paths.zeroY.toFixed(1)}" y2="${paths.zeroY.toFixed(1)}"></line>
      ${paths.area ? `<path class="trajectory-area" d="${paths.area}"></path>` : ''}
      ${paths.realized ? `<path class="trajectory-line" d="${paths.realized}"></path>` : ''}
      ${paths.projected ? `<path class="trajectory-forecast-line" d="${paths.projected}"></path>` : ''}
      ${today ? `<line class="trajectory-today" x1="${today.x.toFixed(1)}" x2="${today.x.toFixed(1)}" y1="6" y2="${HEIGHT - PAD_BOTTOM}"></line>
      <circle class="trajectory-dot" cx="${today.x.toFixed(1)}" cy="${today.y.toFixed(1)}" r="5"></circle>
      <text class="trajectory-text" x="${labelX.toFixed(1)}" y="14"></text>` : ''}
      <text class="trajectory-text" x="0" y="${HEIGHT - 6}">1</text>
      <text class="trajectory-text" x="${WIDTH}" y="${HEIGHT - 6}" text-anchor="end">${trajectory.lastDay}</text>
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
    <div class="trajectory-plot hero-plot" data-trajectory-plot></div>`;
  anchor.parentElement.insertBefore(card, anchor);
  card.querySelector('[data-trajectory-cta]').addEventListener('click', () => {
    if (typeof globalThis.switchTab === 'function') globalThis.switchTab('saidas');
  });
  return card;
}

export function renderBalanceTrajectoryCard({ entradas = [], saidas = [], documentRef = globalThis.document, today = localToday() } = {}) {
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
  plot.innerHTML = svgMarkup(trajectory, width);
  const todayLabel = plot.querySelector('text.trajectory-text');
  if (todayLabel && trajectory.todayDay) todayLabel.textContent = translate('hoje');
}
