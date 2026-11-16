/**
 * Janela de historico dos lancamentos carregados pelo Dashboard.
 *
 * Antes, ao abrir o app, o Dashboard escutava a colecao inteira
 * `users/{uid}/finance_records` (1 leitura por documento, todo o historico).
 * Agora ele carrega so os meses recentes e o que continua relevante fora deles:
 *
 * - lancamentos com competencia, vencimento ou data a partir do inicio da janela
 *   (inclui todos os meses futuros);
 * - contas ainda nao pagas, de qualquer epoca (vencidas continuam aparecendo);
 * - parcelamentos (todas as parcelas, para o progresso "3/10" ficar certo);
 * - tudo que nao e lancamento (pessoas, categorias, regras, horas, salarios).
 *
 * Meses mais antigos sao carregados sob demanda (`ensureFrom`) ou de uma vez
 * (`ensureFull`, usado por backup, importacao e exclusao de categoria).
 *
 * Este modulo e puro: monta as consultas como dados; quem executa e o dataSdk.
 */

export const DEFAULT_HISTORY_WINDOW_MONTHS = 12;
export const HISTORY_MODE_WINDOW = 'window';
export const HISTORY_MODE_FULL = 'full';
export const HISTORY_WINDOW_EVENT = 'financeHistoryWindowChanged';

export const TRANSACTION_RECORD_TYPES = Object.freeze(['saida', 'entrada']);
// Status "em aberto" de saidas (Em aberto/Vencido/vazio) e entradas (Pendente).
// Status vazio conta como em aberto nas consultas do WhatsApp (EXPENSE_OPEN_STATUSES).
export const OPEN_RECORD_STATUSES = Object.freeze(['Em aberto', 'Vencido', 'Pendente', '']);

const COMPETENCE_RE = /^\d{4}-\d{2}$/;

/** Le o tamanho da janela (meses). 0 ou invalido-negativo = historico completo (modo antigo). */
export function normalizeHistoryWindowMonths(value, fallback = DEFAULT_HISTORY_WINDOW_MONTHS) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 600);
}

/** 'AAAA-MM' de uma data AAAA-MM ou AAAA-MM-DD; '' quando nao reconhece. */
export function toCompetence(value = '') {
  const raw = String(value || '').trim();
  if (COMPETENCE_RE.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 7);
  return '';
}

export function shiftCompetence(competence, offset) {
  const key = toCompetence(competence);
  if (!key) return '';
  const [year, month] = key.split('-').map(Number);
  const index = year * 12 + (month - 1) + Number(offset || 0);
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Primeiro mes da janela: com 12 meses e mes atual 2026-11, devolve 2025-12
 * (o mes atual mais os 11 anteriores). 0 meses = '' (sem janela).
 */
export function historyWindowStart(currentCompetence, months = DEFAULT_HISTORY_WINDOW_MONTHS) {
  const size = normalizeHistoryWindowMonths(months);
  const current = toCompetence(currentCompetence);
  if (!size || !current) return '';
  return shiftCompetence(current, -(size - 1));
}

/**
 * Consultas que, juntas, formam o conjunto da janela. Cada item vira um
 * `query(colecao, where(field, op, value))`. Todas usam indice de campo unico
 * (criado automaticamente pelo Firestore): nenhum indice composto e necessario.
 */
export function buildHistoryWindowQueries(start) {
  const competence = toCompetence(start);
  if (!competence) return [{ key: 'all' }];
  const firstDay = `${competence}-01`;
  return [
    { key: 'competence', field: 'competence', op: '>=', value: competence },
    { key: 'due_date', field: 'due_date', op: '>=', value: firstDay },
    { key: 'occurred_date', field: 'occurred_date', op: '>=', value: firstDay },
    { key: 'open', field: 'status', op: 'in', value: [...OPEN_RECORD_STATUSES] },
    { key: 'installments', field: 'total_installments', op: '>', value: 1 },
    { key: 'non_transactions', field: 'type', op: 'not-in', value: [...TRANSACTION_RECORD_TYPES] }
  ];
}

/** Junta os resultados das consultas sem repetir documento (por id). */
export function mergeRecordSets(sets = []) {
  const byId = new Map();
  const withoutId = [];
  sets.forEach((records) => {
    (records || []).forEach((record) => {
      if (!record) return;
      if (record.id) byId.set(record.id, record);
      else withoutId.push(record);
    });
  });
  return [...byId.values(), ...withoutId];
}

/** O mes pedido ja esta coberto pelo que foi carregado? */
export function isCompetenceLoaded(competence, state = {}) {
  if (state.mode === HISTORY_MODE_FULL || !state.start) return true;
  const key = toCompetence(competence);
  if (!key) return true;
  return key >= state.start;
}

/** Proximo inicio de janela para cobrir `competence` (nunca encolhe a janela). */
export function nextHistoryStart(competence, state = {}) {
  const key = toCompetence(competence);
  if (!key || isCompetenceLoaded(key, state)) return state.start || '';
  return key < state.start ? key : state.start;
}

/**
 * Consultas para ler lancamentos a partir de um mes sem trazer o historico inteiro
 * (usado pela whatsapp-api): competencia/vencimento/data a partir de `start` e as
 * contas ainda em aberto de qualquer epoca. O resultado e um superconjunto: quem
 * consome ainda filtra pelo periodo exato.
 */
export const RECENT_RECORD_QUERY_KEYS = Object.freeze(['competence', 'due_date', 'occurred_date', 'open']);

export function buildRecentRecordQueries(start) {
  if (!toCompetence(start)) return [{ key: 'all' }];
  return buildHistoryWindowQueries(start).filter((item) => RECENT_RECORD_QUERY_KEYS.includes(item.key));
}

/** Mesmo criterio de buildRecentRecordQueries, em memoria (store de testes). */
export function matchesRecentRecordQueries(record = {}, start = '') {
  const competence = toCompetence(start);
  if (!competence) return true;
  const firstDay = `${competence}-01`;
  const text = (value) => (typeof value === 'string' ? value : null);
  return (text(record.competence) !== null && record.competence >= competence)
    || (text(record.due_date) !== null && record.due_date >= firstDay)
    || (text(record.occurred_date) !== null && record.occurred_date >= firstDay)
    || OPEN_RECORD_STATUSES.includes(record.status);
}
