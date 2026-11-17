/**
 * Trajetoria do saldo no mes: saldo acumulado dia a dia ate hoje e a previsao ate o fim
 * do mes, contando as saidas em aberto pelo vencimento.
 *
 * Funcao pura: recebe os lancamentos ja filtrados do Dashboard (entradas e saidas da
 * competencia escolhida) e devolve pontos prontos para desenhar.
 */
const OPEN_STATUSES = new Set(['Em aberto', 'Pendente', 'Atrasado']);

function daysInMonth(month) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function dayOf(dateText, month) {
  const text = String(dateText || '');
  if (text.slice(0, 7) !== month) return null;
  const day = Number(text.slice(8, 10));
  return Number.isInteger(day) && day >= 1 ? day : null;
}

function amountOf(record) {
  const value = Number(record?.amount);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function recordDay(record, month, lastDay, preferDue) {
  const first = preferDue ? record?.due_date : record?.occurred_date;
  const second = preferDue ? record?.occurred_date : record?.due_date;
  const day = dayOf(first, month) ?? dayOf(second, month) ?? 1;
  return Math.min(day, lastDay);
}

/**
 * @param {{ month: string, today: string, entradas?: object[], saidas?: object[] }} input
 * month = 'AAAA-MM'; today = 'AAAA-MM-DD'.
 */
export function buildBalanceTrajectory({ month, today, entradas = [], saidas = [] }) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return null;
  const lastDay = daysInMonth(month);
  const todayMonth = String(today || '').slice(0, 7);
  const todayDay = todayMonth === month
    ? Math.min(Number(String(today).slice(8, 10)) || 1, lastDay)
    : (todayMonth > month ? lastDay : 0);

  const delta = new Array(lastDay + 1).fill(0);
  const events = [];
  let openTotal = 0;
  let openCount = 0;
  for (const record of entradas) {
    if (OPEN_STATUSES.has(record?.status)) continue;
    const value = amountOf(record);
    if (!value) continue;
    delta[recordDay(record, month, lastDay, false)] += value;
  }
  for (const record of saidas) {
    const value = amountOf(record);
    if (!value) continue;
    const open = OPEN_STATUSES.has(record?.status);
    const day = recordDay(record, month, lastDay, open);
    delta[day] -= value;
    if (open) {
      openTotal += value;
      openCount += 1;
    }
    if (open && day > todayDay) events.push({ day, amount: value });
  }

  const points = [];
  let running = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    running += delta[day];
    points.push({ day, balance: Math.round(running * 100) / 100, projected: day > todayDay });
  }
  const todayPoint = todayDay ? points[todayDay - 1] : null;
  const biggestUpcoming = events.sort((a, b) => b.amount - a.amount)[0] || null;
  return {
    month,
    lastDay,
    todayDay,
    current: todayPoint ? todayPoint.balance : 0,
    projectedEnd: points[points.length - 1]?.balance ?? 0,
    biggestUpcoming,
    openTotal: Math.round(openTotal * 100) / 100,
    openCount,
    points
  };
}
